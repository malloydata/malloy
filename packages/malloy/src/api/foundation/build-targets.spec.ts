/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Model} from './core';
import {mkBuildTargets, resolvePersistWalk} from './build_targets';
import type {BuildTarget, ConnectionBuild} from './types';
import type {LogMessage} from '../../lang';
import {TestTranslator} from '../../lang/test/test-translator';

const DIGESTS = {
  _db_: 'digest-of-db',
  _db2_: 'digest-of-db2',
};

// A build target is an artifact, not a source, and the difference only shows
// up once the SQL has been hashed. These tests take the long way — a real
// translate, a real getSQL() — because hand-built input could not tell the
// difference between two sources that share a table and two that don't.
function modelOf(src: string): Model {
  const tt = new TestTranslator(`##! experimental.persistence\n${src}`);
  const compiled = tt.translate();
  if (!compiled.modelDef) {
    const problems = (compiled.problems ?? []).map(p => p.message).join('\n');
    throw new Error(`source did not translate:\n${problems}\n${src}`);
  }
  return new Model(compiled.modelDef, [], []);
}

function connectionsOf(src: string): ConnectionBuild[] {
  const model = modelOf(src);
  const log: LogMessage[] = [];
  return mkBuildTargets(resolvePersistWalk(model, log), DIGESTS);
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

    expect(() => mkBuildTargets(walk, {})).toThrow('_db_');
  });

  test('a model with no persist sources has no targets', () => {
    const targets = targetsOf(`
      source: plain is _db_.table('aTable')
      run: plain -> { group_by: astr }
    `);

    expect(targets).toEqual([]);
  });
});
