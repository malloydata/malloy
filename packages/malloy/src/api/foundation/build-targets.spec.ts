/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Model} from './core';
import {mkBuildTargets, resolvePersistWalk} from './build_targets';
import type {BuildTarget, BuildTargets, ConnectionBuild} from './types';
import type {LogMessage} from '../../lang';
import type {GivenValue} from '../../model';
import {bindGivens} from '../../model/given_binding';
import {TestTranslator} from '../../lang/test/test-translator';

const DIGESTS = {
  _db_: 'digest-of-db',
  _db2_: 'digest-of-db2',
};

const GIVENS = ['experimental.givens'];

// A build target is an artifact, not a source, and the difference only shows
// up once the SQL has been hashed. These tests take the long way — a real
// translate, a real compile — because hand-built input could not tell the
// difference between two sources that share a table and two that don't.
function modelOf(src: string, compilerFlags: string[] = []): Model {
  const tt = new TestTranslator(`##! experimental.persistence\n${src}`, {
    compilerFlags,
  });
  const compiled = tt.translate();
  if (!compiled.modelDef) {
    const problems = (compiled.problems ?? []).map(p => p.message).join('\n');
    throw new Error(`source did not translate:\n${problems}\n${src}`);
  }
  return new Model(compiled.modelDef, [], []);
}

/** What a build of `src` would plan, under `givens` if any. */
function planOf(
  src: string,
  opts: {flags?: string[]; givens?: Record<string, GivenValue>} = {}
): Pick<BuildTargets, 'connections' | 'unbuildable'> {
  const model = modelOf(src, opts.flags);
  const log: LogMessage[] = [];
  return mkBuildTargets(resolvePersistWalk(model, log), DIGESTS, {
    resolvedGivens: bindGivens(opts.givens, model._modelDef),
  });
}

function connectionsOf(src: string): ConnectionBuild[] {
  return planOf(src).connections;
}

function connectionNamed(
  connections: ConnectionBuild[],
  name: string
): ConnectionBuild {
  const found = connections.find(c => c.connectionName === name);
  if (!found) {
    throw new Error(
      `no build for '${name}'; connections are ` +
        connections.map(c => c.connectionName).join(', ')
    );
  }
  return found;
}

/** The targets for a model that uses exactly one connection. */
function targetsOf(src: string): BuildTarget[] {
  const connections = connectionsOf(src);
  if (connections.length === 0) return [];
  if (connections.length > 1) {
    throw new Error(
      `expected one connection, got ${connections.map(c => c.connectionName).join(', ')}`
    );
  }
  return connections[0].targets;
}

function names(target: BuildTarget): string[] {
  return target.sources.map(s => s.name).sort();
}

/** The source names of each target, in the order they are to be built. */
function order(targets: BuildTarget[]): string[][] {
  return targets.map(names);
}

function findTarget(
  connections: ConnectionBuild[],
  sourceName: string
): BuildTarget {
  const all = connections.flatMap(c => c.targets);
  const found = all.find(t => names(t).includes(sourceName));
  if (!found) {
    throw new Error(
      `no target holds '${sourceName}'; targets are ` +
        all.map(t => names(t).join('+')).join(', ')
    );
  }
  return found;
}

const ROLLUP = `
  #@ persist name=rollup
  source: rollup is _db_.table('aTable') -> {
    group_by: astr
    aggregate: n is count()
  }
`;

/** A persisted source whose SQL reads a given; needs the `givens` flag. */
const SCOPED = `
  given: TENANT :: string
  #@ persist name=scoped
  source: scoped is _db_.table('aTable') -> {
    where: astr = $TENANT
    group_by: astr
  }
`;

describe('sources collapse onto the artifacts they build', () => {
  test('an extension of a persisted source is not a second table', () => {
    // `#@ persist` is inherited and `extend` does not change the SQL, so
    // `reader` names the same table `rollup` does.
    const targets = targetsOf(`
      ${ROLLUP}
      source: reader is rollup extend {
        dimension: loud is upper(astr)
      }
      run: reader -> { select: * }
    `);

    expect(targets).toHaveLength(1);
    expect(names(targets[0])).toEqual(['reader', 'rollup']);
    // The extension depends on its base, but they are one table: an edge here
    // would be a table waiting on itself.
    expect(targets[0].dependsOn).toEqual([]);
  });

  test('a rename is not a second table', () => {
    const targets = targetsOf(`
      ${ROLLUP}
      source: same_thing is rollup
      run: same_thing -> { select: * }
    `);

    expect(targets).toHaveLength(1);
    expect(names(targets[0])).toEqual(['rollup', 'same_thing']);
  });

  test('a deliberate second name collapses, and both names survive', () => {
    // BuildID is content, so asking for two tables of one computation gets one
    // table. Both requests survive in `sources`, which is the only place a
    // builder can see the disagreement and reject it.
    const targets = targetsOf(`
      ${ROLLUP}
      #@ persist name=rollup_again
      source: rollup_again is rollup
      run: rollup_again -> { select: * }
    `);

    expect(targets).toHaveLength(1);
    const target = targets[0];
    expect(names(target)).toEqual(['rollup', 'rollup_again']);
    const requested = target.sources.map(s =>
      s.annotations.parseAsTag('@').tag.text('name')
    );
    expect(requested.sort()).toEqual(['rollup', 'rollup_again']);
  });

  test('identical SQL on two connections stays two tables', () => {
    // And they land in separate ConnectionBuilds, which is the point of the
    // top-level split: neither waits on the other for anything.
    const connections = connectionsOf(`
      #@ persist name=here
      source: here is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      #@ persist name=there
      source: there is _db2_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      run: here -> { select: * }
      run: there -> { select: * }
    `);

    expect(connections).toHaveLength(2);
    expect(connections.flatMap(c => c.targets)).toHaveLength(2);
    expect(findTarget(connections, 'here').sql).toEqual(
      findTarget(connections, 'there').sql
    );
    expect(findTarget(connections, 'here').connectionName).toBe('_db_');
    expect(findTarget(connections, 'there').connectionName).toBe('_db2_');
    // Each connection is a build of its own.
    expect(connections.map(c => c.targets.length)).toEqual([1, 1]);
  });

  test('each connection gets its own list', () => {
    // A single list for the whole model would put `solo` and `base` in it
    // together, and a builder reading it in order would sequence work across
    // connections that have no relationship at all.
    const connections = connectionsOf(`
      #@ persist name=base
      source: base is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      #@ persist name=top
      source: top is base -> { group_by: astr; aggregate: t is n.sum() }
      #@ persist name=solo
      source: solo is _db2_.table('aTable') -> { group_by: astr }
      run: top -> { select: * }
      run: solo -> { select: * }
    `);

    const db = connectionNamed(connections, '_db_');
    const db2 = connectionNamed(connections, '_db2_');
    expect(order(db.targets)).toEqual([['base'], ['top']]);
    expect(order(db2.targets)).toEqual([['solo']]);
  });
});

describe('targets come back in dependency order', () => {
  test('a chain builds bottom up', () => {
    const targets = targetsOf(`
      ${ROLLUP}
      #@ persist name=top
      source: top is rollup -> {
        group_by: astr
        aggregate: total is n.sum()
      }
      run: top -> { select: * }
    `);

    expect(order(targets)).toEqual([['rollup'], ['top']]);
    expect(targets[1].dependsOn).toEqual([targets[0]]);
  });

  test('a merged target keeps the dependency it really has', () => {
    // The positive half of the intersection: `reader` merges onto `mid`, and
    // the merged target must still depend on `base`. Dropping a real edge is
    // silent — the table gets built from inlined SQL rather than reading the
    // one below it — so the negative test above is not enough on its own.
    //
    // Honest about what this pins: it guards future changes to
    // `mkBuildTargets`. No edit is known that turns it red, so it documents
    // the intended behaviour more than it catches a specific regression.
    const targets = targetsOf(`
      ${ROLLUP}
      #@ persist name=mid
      source: mid is rollup -> { group_by: astr; aggregate: t is n.sum() }
      source: reader is mid extend { dimension: loud is upper(astr) }
      run: reader -> { select: * }
    `);

    expect(order(targets)).toEqual([['rollup'], ['mid', 'reader']]);
    expect(targets[1].dependsOn).toEqual([targets[0]]);
  });

  test('a merged source does not import a dependency the table lacks', () => {
    // `alias` materializes `rollup`'s table, so it merges onto that target —
    // and it joins `mid`, which reads `rollup`. Keeping alias's edge would say
    // the table depends on something that depends on it.
    //
    // Sources on one target have identical SQL and so identical real
    // dependencies; the difference between their recorded sets is the walk's
    // over-approximation, since it follows every join whether the query uses
    // it or not. Intersecting keeps every real edge and drops that one.
    const targets = targetsOf(`
      ${ROLLUP}
      #@ persist name=mid
      source: mid is rollup -> { group_by: astr; aggregate: t is n.sum() }
      source: alias is rollup extend {
        join_one: mid on astr = mid.astr
      }
      run: alias -> { select: * }
    `);

    expect(order(targets)).toEqual([['alias', 'rollup'], ['mid']]);
    expect(targets[0].dependsOn).toEqual([]);
    expect(targets[1].dependsOn).toEqual([targets[0]]);
  });

  test('a dependency reached through an alias still orders the build', () => {
    // `alias` shares `rollup`'s table; `top` reads `alias`. The edge has to
    // survive the merge, or `top` comes back with no dependencies.
    const targets = targetsOf(`
      ${ROLLUP}
      source: alias is rollup extend {
        dimension: loud is upper(astr)
      }
      #@ persist name=top
      source: top is alias -> {
        group_by: loud
        aggregate: total is n.sum()
      }
      run: top -> { select: * }
    `);

    expect(order(targets)).toEqual([['alias', 'rollup'], ['top']]);
    expect(targets[1].dependsOn).toEqual([targets[0]]);
  });
});

describe('what a target carries', () => {
  test('sql is the BuildID SQL, and buildId is its hash', () => {
    const targets = targetsOf(`
      ${ROLLUP}
      run: rollup -> { select: * }
    `);

    const target = targets[0];
    const source = target.sources[0];
    expect(target.sql).toBe(source.getSQL());
    expect(target.buildId).toBe(source.makeBuildId('digest-of-db', target.sql));
  });

  test('a missing digest names the connection it needed', () => {
    const model = modelOf(`${ROLLUP}\nrun: rollup -> { select: * }`);
    const walk = resolvePersistWalk(model, []);

    expect(() => mkBuildTargets(walk, {}, {})).toThrow('_db_');
  });

  test('a model with no persist sources has no targets', () => {
    const targets = targetsOf(`
      source: plain is _db_.table('aTable')
      run: plain -> { group_by: astr }
    `);

    expect(targets).toEqual([]);
  });
});

describe('a source whose SQL reads a given', () => {
  // The table holds the rows for one value of the given, so the value has to
  // be in the SQL that is hashed. A build that has no value for it cannot say
  // which table it would be building.
  test('with no value in the build it is unbuildable, and the rest is planned', () => {
    const {connections, unbuildable} = planOf(
      `
      ${ROLLUP}
      ${SCOPED}
      run: rollup -> { select: * }
      run: scoped -> { select: * }
    `,
      {flags: GIVENS}
    );

    expect(connections.flatMap(c => c.targets).map(names)).toEqual([
      ['rollup'],
    ]);
    expect(unbuildable.map(u => u.source.name)).toEqual(['scoped']);
    const [{problem}] = unbuildable;
    expect(problem.severity).toBe('error');
    expect(problem.code).toBe('runtime-persist-given-no-value');
    expect(problem.message).toContain("reads given 'TENANT'");
    expect(problem.at).toBeDefined();
  });

  test('what reads it is unbuildable too', () => {
    // A dependent's SQL inlines it, so has no value for the given either.
    const {connections, unbuildable} = planOf(
      `
      ${SCOPED}
      #@ persist name=top
      source: top is scoped -> { group_by: astr }
      run: top -> { select: * }
    `,
      {flags: GIVENS}
    );

    expect(connections).toEqual([]);
    expect(unbuildable.map(u => u.source.name)).toEqual(['scoped', 'top']);
  });

  test('two values are two tables', () => {
    const acme = findTarget(
      planOf(SCOPED, {flags: GIVENS, givens: {TENANT: 'acme'}}).connections,
      'scoped'
    );
    const globex = findTarget(
      planOf(SCOPED, {flags: GIVENS, givens: {TENANT: 'globex'}}).connections,
      'scoped'
    );
    expect(acme.sql).toContain("'acme'");
    expect(acme.buildId).not.toBe(globex.buildId);
    expect(acme.readsGivens).toBe(true);
  });

  test('a default is a value, and the table still reads the given', () => {
    const {connections, unbuildable} = planOf(
      `
      given: TENANT :: string is "acme"
      ${SCOPED.replace('given: TENANT :: string', '')}
    `,
      {flags: GIVENS}
    );

    expect(unbuildable).toEqual([]);
    const [target] = connections[0].targets;
    expect(target.sql).toContain("'acme'");
    expect(target.readsGivens).toBe(true);
  });

  test('a given used only in an extend-block where: is not in the table', () => {
    // The `where:` is applied by whatever reads the table, so the table holds
    // every tenant's rows and needs no value to be built.
    const {connections, unbuildable} = planOf(
      `
      given: TENANT :: string
      ${ROLLUP}
      source: mine is rollup extend { where: astr = $TENANT }
      run: mine -> { select: * }
    `,
      {flags: GIVENS}
    );

    expect(unbuildable).toEqual([]);
    const [target] = connections[0].targets;
    expect(names(target)).toEqual(['mine', 'rollup']);
    expect(target.readsGivens).toBe(false);
  });
});

describe('build SQL', () => {
  const CHAIN = `
    ${ROLLUP}
    #@ persist name=top
    source: top is rollup -> { group_by: astr }
    run: top -> { select: * }
  `;

  test('reads a built dependency from its table', () => {
    const connections = connectionsOf(CHAIN);
    const rollup = findTarget(connections, 'rollup');
    const top = findTarget(connections, 'top');

    const built = top.buildSQL({
      entries: {[rollup.buildId]: {tableName: 'rollup_table'}},
    });
    expect(built).toContain('rollup_table');
    expect(built).not.toContain('aTable');
  });

  test('with nothing built yet it is the BuildID SQL', () => {
    const top = findTarget(connectionsOf(CHAIN), 'top');
    expect(top.buildSQL({entries: {}})).toBe(top.sql);
  });

  test("compiles under the build's givens", () => {
    const {connections} = planOf(SCOPED, {
      flags: GIVENS,
      givens: {TENANT: 'acme'},
    });
    const [target] = connections[0].targets;
    expect(target.buildSQL({entries: {}})).toContain("'acme'");
  });
});

describe('a persisted source imported with its given under another name', () => {
  test('the report uses the name this model supplies it by', () => {
    const tt = new TestTranslator(
      `##! experimental.persistence
       import { scoped, T is TENANT } from "child"`,
      {compilerFlags: GIVENS}
    );
    tt.unresolved();
    tt.update({
      urls: {
        'internal://test/langtests/child': `
          ##! experimental { givens persistence }
          given: TENANT :: string
          #@ persist name=scoped
          source: scoped is _db_.table('aTable') -> {
            where: astr = $TENANT
            group_by: astr
          }
        `,
      },
    });
    const compiled = tt.translate();
    if (!compiled.modelDef) {
      const problems = (compiled.problems ?? []).map(p => p.message);
      throw new Error(`did not translate:\n${problems.join('\n')}`);
    }
    const model = new Model(compiled.modelDef, [], []);
    const {unbuildable} = mkBuildTargets(
      resolvePersistWalk(model, []),
      DIGESTS,
      {}
    );
    expect(unbuildable.map(u => u.problem.message)).toEqual([
      expect.stringContaining("reads given 'T'"),
    ]);

    const {connections} = mkBuildTargets(
      resolvePersistWalk(model, []),
      DIGESTS,
      {resolvedGivens: bindGivens({T: 'acme'}, compiled.modelDef)}
    );
    expect(connections[0].targets[0].sql).toContain("'acme'");
  });
});
