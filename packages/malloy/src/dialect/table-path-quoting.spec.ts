/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Dialect.sqlQuoteTablePath: render a manifest table path with every
// segment quoted for the target dialect. A table CREATEd with quoted
// (case-preserved) segments can only be read back quoted on a
// case-folding engine — Snowflake folds unquoted identifiers to
// uppercase — so the serve path must quote byte-compatibly with the
// builder. See the persist routing assertions in
// api/foundation/persist-source-sql.spec.ts for the end-to-end contract.

import {getDialect} from './dialect_map';

describe('sqlQuoteTablePath', () => {
  const snowflake = getDialect('snowflake');
  const standardsql = getDialect('standardsql');
  const postgres = getDialect('postgres');
  const duckdb = getDialect('duckdb');

  test('quotes each segment of a bare path (snowflake)', () => {
    expect(
      snowflake.sqlQuoteTablePath('scratch.orders_mz__g000__ab12cd34')
    ).toBe('"scratch"."orders_mz__g000__ab12cd34"');
  });

  test('is idempotent: a quoted path keeps exactly one quote layer', () => {
    expect(snowflake.sqlQuoteTablePath('"scratch"."orders_mz"')).toBe(
      '"scratch"."orders_mz"'
    );
  });

  test('normalizes a mixed bare/quoted path to fully quoted', () => {
    expect(snowflake.sqlQuoteTablePath('scratch."MiXed Case"')).toBe(
      '"scratch"."MiXed Case"'
    );
  });

  test('re-escapes an embedded quote (doubled style)', () => {
    expect(postgres.sqlQuoteTablePath('"we""ird".t')).toBe('"we""ird"."t"');
  });

  test('uses backticks on a backtick dialect (standardsql)', () => {
    expect(standardsql.sqlQuoteTablePath('proj.dataset.orders__g003')).toBe(
      '`proj`.`dataset`.`orders__g003`'
    );
  });

  test('quotes a hyphenated BigQuery project id segment', () => {
    // `-` is in standardsql's bare-segment charset, so this parses bare and
    // comes back quoted — the quoted form is what a hyphenated id requires.
    expect(standardsql.sqlQuoteTablePath('my-proj.ds.t')).toBe(
      '`my-proj`.`ds`.`t`'
    );
  });

  test('returns a non-dotted-path input verbatim (duckdb file path)', () => {
    // DuckDB file paths are canonical as single-quoted string literals, not
    // dotted identifier paths; they have no segments to case-fold, so the
    // helper must pass them through untouched.
    expect(duckdb.sqlQuoteTablePath("'data/local.parquet'")).toBe(
      "'data/local.parquet'"
    );
  });

  test('quotes a duckdb physical (dotted) table path', () => {
    expect(duckdb.sqlQuoteTablePath('main.order_summary_mz')).toBe(
      '"main"."order_summary_mz"'
    );
  });
});
