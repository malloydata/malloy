/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Model} from './core';
import type {PersistSource} from './core';
import type {BuildManifest} from '../../model';
import {TestTranslator} from '../../lang/test/test-translator';

// Build a Model directly from translated IR (no live connection) so the
// build path (PersistSource.getSQL()) and the serve path (query compilation
// with a manifest) can be exercised the way persistence uses them.
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

const CONN_DIGEST = 'test-conn-digest';

// Compile a query on `sourceName` with a manifest whose single entry is keyed
// by the source's build-time BuildID (makeBuildId over getSQL()) and names
// `tableName` as the persisted table. The serve path recomputes its own
// lookup key from the bare source SELECT (query_query.ts); on a key match the
// FROM becomes the materialized table.
function routedSQL(
  model: Model,
  sourceName: string,
  connectionName: string,
  tableName: string
): string {
  const source = persistSourceNamed(model, sourceName);
  const buildId = source.makeBuildId(CONN_DIGEST, source.getSQL());
  const manifest: BuildManifest = {
    entries: {[buildId]: {tableName}},
  };
  return model.getPreparedQuery().getPreparedResult({
    buildManifest: manifest,
    connectionDigests: {[connectionName]: CONN_DIGEST},
  }).sql;
}

describe('PersistSource build key matches serve-time manifest lookup', () => {
  const MATERIALIZED = 'MATERIALIZED_TBL';

  // Assert the invariant that matters — build-key == serve-key — through its
  // only observable consequence: a query routes to the materialized table.
  // When the keys agree the FROM becomes the materialized table; when they
  // diverge the lookup misses and the source is inlined instead.

  // Postgres is the only dialect with `hasFinalStage = true`. If getSQL()
  // finalized the query, its BuildID would be hashed over the `row_to_json`
  // wrapper while the serve path keys off the bare SELECT — the keys would
  // diverge, the lookup would miss, and the query would inline the source
  // instead of routing. This trips on any future divergence between the two
  // paths without ever naming the Postgres codegen.
  test('a postgres persist source routes to the materialized table', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist
      source: pg_rollup is _pg_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      run: pg_rollup -> { select: * }
    `);

    expect(routedSQL(model, 'pg_rollup', '_pg_', MATERIALIZED)).toContain(
      MATERIALIZED
    );
  });

  // duckdb has `hasFinalStage = false`, so build and serve keys agree
  // trivially; this guards that the shared getSQL() change stays a no-op for
  // dialects without a final stage.
  test('a duckdb persist source routes to the materialized table', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist
      source: db_rollup is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      run: db_rollup -> { select: * }
    `);

    expect(routedSQL(model, 'db_rollup', '_db_', MATERIALIZED)).toContain(
      MATERIALIZED
    );
  });
});

describe('manifest table paths are re-quoted per-dialect on the serve path', () => {
  // The builder CREATEs the physical table with quoted (case-preserved)
  // segments, so the serve-time FROM must quote the same way — Snowflake
  // folds an unquoted identifier to uppercase and then can't resolve a table
  // stored lowercase. The manifest name below is the shape a build
  // orchestrator typically assigns: lowercase, with a lowercase-hex
  // generation suffix.
  const PHYSICAL = 'scratch.orders_mz__g000__ab12cd34';

  function sfModel(): Model {
    return modelOf(`
      ##! experimental.persistence
      #@ persist
      source: sf_rollup is _sf_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      run: sf_rollup -> { select: * }
    `);
  }

  test('snowflake (case-folding engine) gets double-quoted segments', () => {
    const sql = routedSQL(sfModel(), 'sf_rollup', '_sf_', PHYSICAL);
    expect(sql).toContain('"scratch"."orders_mz__g000__ab12cd34"');
    // The bare path must not appear outside the quoted form: an unquoted
    // reference is exactly the prod failure this guards against.
    expect(sql).not.toMatch(/FROM\s+scratch\./);
  });

  test('an already-quoted manifest name gets exactly one quote layer', () => {
    const sql = routedSQL(
      sfModel(),
      'sf_rollup',
      '_sf_',
      '"scratch"."orders_mz__g000__ab12cd34"'
    );
    expect(sql).toContain('"scratch"."orders_mz__g000__ab12cd34"');
    expect(sql).not.toContain('""scratch""');
  });

  // Byte-compatibility with the builder's CREATE-side quoting on a backtick
  // dialect: bigquery/standardsql names quote with ` per segment.
  test('standardsql gets backtick-quoted segments', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist
      source: bq_rollup is _bq_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      run: bq_rollup -> { select: * }
    `);
    const sql = routedSQL(model, 'bq_rollup', '_bq_', PHYSICAL);
    expect(sql).toContain('`scratch`.`orders_mz__g000__ab12cd34`');
  });
});
