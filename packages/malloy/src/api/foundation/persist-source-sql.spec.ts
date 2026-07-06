/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Model} from './core';
import type {PersistSource} from './core';
import {TestTranslator} from '../../lang/test/test-translator';

// Build a Model directly from translated IR (no live connection) so
// PersistSource.getSQL() can be exercised the way the build/serve paths use it.
function modelOf(src: string): Model {
  const tt = new TestTranslator(src);
  const compiled = tt.translate();
  if (!compiled.modelDef) {
    throw new Error(`source did not translate:\n${src}`);
  }
  return new Model(compiled.modelDef, [], []);
}

function persistSourceNamed(model: Model, name: string): PersistSource {
  const source = Object.values(model.getBuildPlan().sources).find(
    s => s.name === name
  );
  if (!source) {
    throw new Error(`no persist source named ${name} in the build plan`);
  }
  return source;
}

describe('PersistSource.getSQL — bare source SELECT (finalize=false)', () => {
  // Postgres is the only dialect with `hasFinalStage = true`; its final stage
  // wraps the result in `SELECT row_to_json(finalStage) as row ...`. getSQL()
  // must NOT include that wrapper — the persist SQL defines the physical table
  // (real columns), and its BuildID must match the serve-time lookup, which
  // resolves the source from the bare (unfinalized) SELECT. Including the
  // wrapper would materialize a single JSON column and mis-key the manifest.
  test('a postgres persist source does not emit the row_to_json final stage', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist
      source: pg_rollup is _pg_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
    `);

    const sql = persistSourceNamed(model, 'pg_rollup').getSQL();

    expect(sql).not.toMatch(/row_to_json/i);
    expect(sql).not.toMatch(/finalStage/);
    // It is still the real query — the grouped projection is present.
    expect(sql).toMatch(/group by/i);
    expect(sql).toMatch(/count\(/i);
  });

  // duckdb has `hasFinalStage = false`, so finalize never added a stage there;
  // this guards that the shared getSQL() change is a no-op for such dialects.
  test('a duckdb persist source is unaffected (no final stage either way)', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist
      source: db_rollup is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
    `);

    const sql = persistSourceNamed(model, 'db_rollup').getSQL();

    expect(sql).not.toMatch(/row_to_json/i);
    expect(sql).toMatch(/group by/i);
    expect(sql).toMatch(/count\(/i);
  });
});
