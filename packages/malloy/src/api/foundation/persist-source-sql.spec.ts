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

describe('PersistSource build key matches serve-time manifest lookup', () => {
  const CONN_DIGEST = 'test-conn-digest';
  const MATERIALIZED = 'MATERIALIZED_TBL';

  // Assert the invariant that matters — build-key == serve-key — through its
  // only observable consequence: a query routes to the materialized table.
  // Build a manifest whose single entry is keyed by the source's build-time
  // BuildID (makeBuildId over getSQL()), then compile a query that references
  // the source with that manifest. The serve path recomputes its own lookup
  // key from the bare source SELECT (query_query.ts). When the keys agree the
  // FROM becomes the materialized table; when they diverge the lookup misses
  // and the source is inlined instead.
  function routedSQL(
    model: Model,
    sourceName: string,
    connectionName: string
  ): string {
    const source = persistSourceNamed(model, sourceName);
    const buildId = source.makeBuildId(CONN_DIGEST, source.getSQL());
    const manifest: BuildManifest = {
      entries: {[buildId]: {tableName: MATERIALIZED}},
    };
    return model.getPreparedQuery().getPreparedResult({
      buildManifest: manifest,
      connectionDigests: {[connectionName]: CONN_DIGEST},
    }).sql;
  }

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

    expect(routedSQL(model, 'pg_rollup', '_pg_')).toContain(MATERIALIZED);
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

    expect(routedSQL(model, 'db_rollup', '_db_')).toContain(MATERIALIZED);
  });
});

describe('build targets exclude extend-derived readers', () => {
  function buildTargets(model: Model): string[] {
    return Object.values(model.getBuildPlan().sources)
      .map(s => s.name)
      .sort();
  }

  // The bug this guards: `#@ persist` is a Malloy annotation, so it propagates
  // onto a source that `extend`s a persisted source. Such a reader must keep
  // reading the pre-built table (docs: "the extension still reads from the same
  // pre-built table"), but it must NOT be emitted as its own build target — it
  // would materialize the base's table a second time under the inherited
  // `name=`, colliding on one physical coordinate.
  test('an extend of a persisted source is a reader, not a build target', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist name="main.base_persist"
      source: base_persist is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      source: extended_reader is base_persist extend {
        dimension: astr_upper is upper(astr)
      }
    `);
    expect(buildTargets(model)).toEqual(['base_persist']);
  });

  test('an extend reader still routes to the base pre-built table', () => {
    const CONN_DIGEST = 'test-conn-digest';
    const MATERIALIZED = 'MATERIALIZED_BASE';
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist name="main.base_persist"
      source: base_persist is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      source: extended_reader is base_persist extend {
        dimension: astr_upper is upper(astr)
      }
      run: extended_reader -> { group_by: astr_upper; aggregate: tot is n.sum() }
    `);
    // Manifest is keyed by the ONLY build target (base_persist). Querying the
    // extension must still route through to that materialized table.
    const base = persistSourceNamed(model, 'base_persist');
    const manifest: BuildManifest = {
      entries: {
        [base.makeBuildId(CONN_DIGEST, base.getSQL())]: {
          tableName: MATERIALIZED,
        },
      },
    };
    const sql = model.getPreparedQuery().getPreparedResult({
      buildManifest: manifest,
      connectionDigests: {_db_: CONN_DIGEST},
    }).sql;
    expect(sql).toContain(MATERIALIZED);
  });

  test('a `#@ -persist` extension opts out and is not a build target', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist name="main.base_persist"
      source: base_persist is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      #@ -persist
      source: recomputed is base_persist extend {
        dimension: astr_upper is upper(astr)
      }
    `);
    expect(buildTargets(model)).toEqual(['base_persist']);
  });

  test('an extension that DECLARES its own persist IS a distinct build target', () => {
    const model = modelOf(`
      ##! experimental.persistence
      #@ persist name="main.base_persist"
      source: base_persist is _db_.table('aTable') -> {
        group_by: astr
        aggregate: n is count()
      }
      #@ persist name="main.child_persist"
      source: child_persist is base_persist extend {
        dimension: astr_upper is upper(astr)
      }
    `);
    // A child declaring its OWN persist (a different table) is a legitimate
    // second materialization and must remain a build target.
    expect(buildTargets(model)).toEqual(['base_persist', 'child_persist']);
  });
});
