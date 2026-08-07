/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Model} from './core';
import {mkBuildTargets} from './build_targets';
import type {BuildTarget} from './types';
import {TestTranslator} from '../../lang/test/test-translator';

// A build target is an artifact, not a source, and the difference only shows
// up once the SQL has been hashed. These tests take the plan the long way — a
// real translate, a real getSQL() — because a hand-built plan could not tell
// the difference between two sources that share a table and two that don't.
function targetsOf(src: string): BuildTarget[][] {
  const tt = new TestTranslator(`##! experimental.persistence\n${src}`);
  const compiled = tt.translate();
  if (!compiled.modelDef) {
    const problems = (compiled.problems ?? []).map(p => p.message).join('\n');
    throw new Error(`source did not translate:\n${problems}\n${src}`);
  }
  const model = new Model(compiled.modelDef, [], []);
  return mkBuildTargets(model.getBuildPlan(), {
    _db_: 'digest-of-db',
    _db2_: 'digest-of-db2',
    _pg_: 'digest-of-pg',
  });
}

function names(target: BuildTarget): string[] {
  return target.sources.map(s => s.name).sort();
}

function findTarget(levels: BuildTarget[][], sourceName: string): BuildTarget {
  const found = levels.flat().find(t => names(t).includes(sourceName));
  if (!found) {
    throw new Error(
      `no target holds '${sourceName}'; targets are ` +
        levels
          .flat()
          .map(t => names(t).join('+'))
          .join(', ')
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
    const levels = targetsOf(`
      ${ROLLUP}
      source: reader is rollup extend {
        dimension: loud is upper(astr)
      }
      run: reader -> { select: * }
    `);

    expect(levels).toHaveLength(1);
    expect(levels[0]).toHaveLength(1);
    expect(names(levels[0][0])).toEqual(['reader', 'rollup']);
    // The extension depends on its base, but they are one table: an edge here
    // would be a table waiting on itself.
    expect(levels[0][0].dependsOn).toEqual([]);
  });

  test('a rename is not a second table', () => {
    const levels = targetsOf(`
      ${ROLLUP}
      source: same_thing is rollup
      run: same_thing -> { select: * }
    `);

    expect(levels).toHaveLength(1);
    expect(names(levels[0][0])).toEqual(['rollup', 'same_thing']);
  });

  test('a deliberate second name collapses, and both names survive', () => {
    // The wall: BuildID is content, so asking for two tables of one
    // computation gets one table. The plan used to report two targets and
    // leave the builder to discover otherwise; now the merge is visible, and
    // the disagreement is in `sources` for a builder to reject.
    const levels = targetsOf(`
      ${ROLLUP}
      #@ persist name=rollup_again
      source: rollup_again is rollup
      run: rollup_again -> { select: * }
    `);

    expect(levels.flat()).toHaveLength(1);
    const target = levels[0][0];
    expect(names(target)).toEqual(['rollup', 'rollup_again']);
    const requested = target.sources.map(s =>
      s.annotations.parseAsTag('@').tag.text('name')
    );
    expect(requested.sort()).toEqual(['rollup', 'rollup_again']);
  });

  test('identical SQL on two connections stays two tables', () => {
    const levels = targetsOf(`
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

    const all = levels.flat();
    expect(all).toHaveLength(2);
    expect(findTarget(levels, 'here').sql).toEqual(
      findTarget(levels, 'there').sql
    );
    expect(findTarget(levels, 'here').connectionName).toBe('_db_');
    expect(findTarget(levels, 'there').connectionName).toBe('_db2_');
  });
});

describe('targets are leveled by their dependencies', () => {
  test('a chain builds one level at a time', () => {
    const levels = targetsOf(`
      ${ROLLUP}
      #@ persist name=top
      source: top is rollup -> {
        group_by: astr
        aggregate: total is n.sum()
      }
      run: top -> { select: * }
    `);

    expect(levels).toHaveLength(2);
    expect(names(levels[0][0])).toEqual(['rollup']);
    expect(names(levels[1][0])).toEqual(['top']);
    expect(levels[1][0].dependsOn).toEqual([levels[0][0]]);
  });

  test('a diamond puts the shared dependency below both readers', () => {
    // The case the plan used to get wrong: walking `lo_side` recorded the edge to
    // `rollup`, walking `hi_side` found it already visited and recorded nothing.
    // Depth-first flattening hid it — `rollup` got built on `lo_side`'s account.
    // A level cannot hide it: `hi_side` would sit beside the table it reads.
    const levels = targetsOf(`
      ${ROLLUP}
      #@ persist name=lo_side
      source: lo_side is rollup -> { group_by: astr; aggregate: l is n.sum() }
      #@ persist name=hi_side
      source: hi_side is rollup -> { group_by: astr; aggregate: r is n.max() }
      #@ persist name=both
      source: both is lo_side extend {
        join_one: hi_side on astr = hi_side.astr
      } -> {
        group_by: astr
        aggregate: t is l.sum()
      }
      run: both -> { select: * }
    `);

    expect(levels).toHaveLength(3);
    expect(names(levels[0][0])).toEqual(['rollup']);
    expect(levels[1].map(names).flat().sort()).toEqual(['hi_side', 'lo_side']);
    expect(names(levels[2][0])).toEqual(['both']);

    const rollup = levels[0][0];
    for (const reader of levels[1]) {
      expect(reader.dependsOn).toEqual([rollup]);
    }
  });

  test('a dependency reached through an alias still orders the build', () => {
    // `alias` shares `rollup`'s table; `top` reads `alias`. The edge has to
    // survive the merge, or `top` lands in level 0 beside the table it reads.
    const levels = targetsOf(`
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

    expect(levels).toHaveLength(2);
    expect(names(levels[0][0])).toEqual(['alias', 'rollup']);
    expect(names(levels[1][0])).toEqual(['top']);
    expect(levels[1][0].dependsOn).toEqual([levels[0][0]]);
  });
});

describe('what a target carries', () => {
  test('sql is the BuildID SQL, and buildId is its hash', () => {
    const levels = targetsOf(`
      ${ROLLUP}
      run: rollup -> { select: * }
    `);

    const target = levels[0][0];
    const source = target.sources[0];
    expect(target.sql).toBe(source.getSQL());
    expect(target.buildId).toBe(source.makeBuildId('digest-of-db', target.sql));
  });

  test('a missing digest names the connection it needed', () => {
    const tt = new TestTranslator(
      `##! experimental.persistence\n${ROLLUP}\nrun: rollup -> { select: * }`
    );
    const compiled = tt.translate();
    const model = new Model(compiled.modelDef!, [], []);

    expect(() => mkBuildTargets(model.getBuildPlan(), {})).toThrow('_db_');
  });

  test('a model with no persist sources has no targets', () => {
    const levels = targetsOf(`
      source: plain is _db_.table('aTable')
      run: plain -> { group_by: astr }
    `);

    expect(levels).toEqual([]);
  });
});
