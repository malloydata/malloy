/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// DuckDB's table-path validator.
//
// DuckDB accepts richer table references than any other dialect we ship,
// so it gets its own parser. Three disjoint branches, tried in order:
//
//   1. Explicit single-quoted literal: `'foo.csv'`, `'thing.with.dots'`,
//      `'o''brien'`. The closing quote must be the last character; `''`
//      inside the body escapes a single quote. Canonical form is the
//      input verbatim — this is already valid SQL.
//
//   2. Identifier path: bare or `"..."` quoted segments, dotted. Same
//      grammar as the other dialects' default — checked by calling the
//      base `validateDottedTablePath` helper with the standard ANSI
//      identifier rules DuckDB inherits via `PostgresBase`.
//
//   3. File-path convenience: a non-empty run of
//      `[A-Za-z0-9._\-/:?*]` characters. The char set is deliberately
//      narrow — single quotes, whitespace, parentheses, and semicolons
//      are excluded so the convenience form can't carry a SQL payload.
//      Canonical form wraps the input in single quotes so it becomes a
//      DuckDB string-literal table name.
//
// Branches 2 and 3 aren't LL(1)-distinguishable by first character (a
// letter can start either), so we try (2) first and fall back to (3)
// only if the identifier-path parse fails.

import type {ValidateTablePathResult} from '../table-path';
import {validateDottedTablePath} from '../table-path';

const DUCKDB_FILE_PATH_RE = /^[A-Za-z0-9._\-/:?*]+$/;
const DUCKDB_SINGLE_QUOTED_RE = /^'(?:[^']|'')*'$/;

export function validateDuckDBTablePath(
  input: string
): ValidateTablePathResult {
  if (input.length === 0) {
    return {ok: false, error: 'DuckDB table path is empty'};
  }
  // Branch 1: explicit single-quoted literal.
  if (input[0] === "'") {
    if (DUCKDB_SINGLE_QUOTED_RE.test(input)) {
      const body = input.slice(1, -1).replace(/''/g, "'");
      if (body.includes(';') || body.includes('--')) {
        return {
          ok: false,
          error:
            `Invalid DuckDB table path: ${JSON.stringify(input)} — ` +
            'forbidden character `;` or `--` in single-quoted body.',
        };
      }
      return {ok: true, canonical: input};
    }
    return {
      ok: false,
      error:
        `Invalid DuckDB table path: ${JSON.stringify(input)} — ` +
        'unterminated or trailing-junk single-quoted literal.',
    };
  }
  // Branch 2: identifier path (same grammar as ANSI dialects).
  const id = validateDottedTablePath(input, {
    quoteChar: '"',
    escapeStyle: 'doubled',
    bareIdentRegex: /^[A-Za-z_][A-Za-z0-9_]*/,
    dialectName: 'DuckDB',
  });
  if (id.ok) return id;
  // Branch 3: file-path convenience.
  if (DUCKDB_FILE_PATH_RE.test(input)) {
    return {ok: true, canonical: `'${input}'`};
  }
  return {
    ok: false,
    error:
      `Invalid DuckDB table path: ${JSON.stringify(input)} — expected an ` +
      'identifier path, a quoted identifier path, a single-quoted ' +
      "literal ('foo.csv'), or a file-path-shaped string of letters, " +
      'digits, and `._-/:?*`. For table-valued function calls (e.g. ' +
      "read_parquet('foo.parquet')) or other table expressions, use a " +
      'SQL block instead: connection.sql("""SELECT * FROM …""").',
  };
}
