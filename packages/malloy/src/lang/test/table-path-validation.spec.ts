/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Translator-time validation of connection.table('…') strings.
// A bad table path should produce an `invalid-table-path` error, not
// reach the schema-fetch needs-request.

import './parse-expects';
import {errorMessage} from './test-translator';

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
      errorMessage(/Invalid BigQuery table path/)
    );
  });

  test('rejects an unterminated explicit-quoted DuckDB form', () => {
    expect('source: bad is _db_.table("\'foo.parquet")').toLog(
      errorMessage(/Invalid DuckDB table path/)
    );
  });
});
