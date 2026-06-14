/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Translator-time validation of connection.table('…') strings.
// A bad table path should produce an `invalid-table-path` error, not
// reach the schema-fetch needs-request.

import './parse-expects';
import {errorMessage} from './test-translator';
import {validateDuckDBTablePath} from '../../dialect/duckdb/table-path-parser';

describe('validateDuckDBTablePath (unit)', () => {
  // Remote references DuckDB resolves directly. These reach the file-path /
  // URL branch and come back quoted as a string-literal table name.
  test.each([
    'hf://datasets/An-j96/SuperstoreData@convert%2fparquet/default/train/0000.parquet',
    'https://huggingface.co/datasets/An-j96/SuperstoreData/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet',
    'https://host/data.parquet?download=true&token=abc123',
    's3://bucket/path/file.parquet',
    'data/local.parquet',
  ])('accepts and quotes URL/file path %s', input => {
    expect(validateDuckDBTablePath(input)).toEqual({
      ok: true,
      canonical: `'${input}'`,
    });
  });

  test('leaves a bare identifier path unquoted', () => {
    expect(validateDuckDBTablePath('my_schema.my_table')).toEqual({
      ok: true,
      canonical: 'my_schema.my_table',
    });
  });

  test('keeps an explicit single-quoted literal verbatim', () => {
    expect(validateDuckDBTablePath("'hf://datasets/foo@bar%2fbaz'")).toEqual({
      ok: true,
      canonical: "'hf://datasets/foo@bar%2fbaz'",
    });
  });

  // The injection guard survives the wider URL char set: the SQL-payload
  // characters ' ( ) ; and whitespace are still excluded.
  test.each([
    "foo'; drop table x; --",
    "x'),(select 1)",
    "read_parquet('foo.parquet')",
    'a b.parquet',
    'foo; bar',
  ])('rejects SQL-payload-shaped input %s', input => {
    expect(validateDuckDBTablePath(input).ok).toBe(false);
  });
});

describe('connection.table() path validation', () => {
  test('rejects Bobby Tables on a DuckDB-shaped connection', () => {
    expect("source: bad is _db_.table('foo; DROP TABLE x; --')").toLog(
      errorMessage(/Invalid DuckDB table path/)
    );
  });

  test('rejects mixed identifier-dot-string on DuckDB', () => {
    // schema.'name' is not legal DuckDB FROM syntax — verified
    // empirically.
    expect('source: bad is _db_.table("schema.\'name\'")').toLog(
      errorMessage(/Invalid DuckDB table path/)
    );
  });

  test('rejects a BigQuery path with embedded whitespace', () => {
    expect("source: bad is _bq_.table('my table.foo')").toLog(
      errorMessage(/Invalid standardsql table path/)
    );
  });

  test('rejects an unterminated explicit-quoted DuckDB form', () => {
    expect('source: bad is _db_.table("\'foo.parquet")').toLog(
      errorMessage(/Invalid DuckDB table path/)
    );
  });
});
