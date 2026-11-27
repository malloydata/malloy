/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

it('can open tables with wildcards', async () => {
  await expect(`
      run: db.table('test/data/duckdb/flights/part.*.parquet') -> {
        top: 1
        group_by: carrier;
      }
    `).toMatchResult(testModel, {carrier: 'AA'});
});

// DuckDB's table-path grammar (validated by dialect.sqlValidateTableName)
// is a superset of the standard "dotted identifier path" because DuckDB
// accepts string-literal-form table names that resolve to files via
// replacement scans. These tests exercise the DuckDB-only shapes.
// (The validator itself is unit-tested in
// packages/malloy/src/dialect/escape.spec.ts; these are end-to-end
// checks that the full pipeline — validate → schema fetch → query —
// works for shapes the cross-dialect tests can't cover.)

it('table path with relative-path file-name convenience', async () => {
  // Dashes/dots-as-extension force the FilePathConvenience branch,
  // which wraps the input in single quotes at the SQL level.
  await expect(`
      run: db.table('test/data/malloytest-parquet/carriers.parquet') -> {
        top: 1
        group_by: code
        order_by: code
      }
    `).toMatchResult(testModel, {});
});

it('table path with ? glob wildcard', async () => {
  // Single-char glob matches part.0.parquet, part.1.parquet,
  // part.2.parquet.
  await expect(`
      run: db.table('test/data/duckdb/flights/part.?.parquet') -> {
        top: 1
        group_by: carrier
      }
    `).toMatchResult(testModel, {carrier: 'AA'});
});

it('can open json files', async () => {
  await expect(`
      run: db.table('test/data/duckdb/test.json') -> {
        select: *
      }`).toMatchResult(testModel, {foo: 'bar'});
});
