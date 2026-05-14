/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// DuckDB's table-path validator.
//
// DuckDB accepts a richer set of table references than any ANSI-shape
// dialect, so it has its own parser rather than reusing the shared one.
// Three disjoint branches, tried in order:
//
//   1. Explicit single-quoted literal: `'foo.csv'`, `'thing.with.dots'`,
//      `'o''brien'`. The closing quote must be the last character; `''`
//      inside the body escapes a single quote. Canonical form is the
//      input verbatim — this is already valid SQL.
//
//   2. Identifier path: bare or `"..."` quoted segments, dotted.
//      Same grammar as the ANSI dialects use. Canonical form is the
//      input verbatim.
//
//   3. File-path convenience: a non-empty run of
//      `[A-Za-z0-9._\-/:?*]` characters. The char set is deliberately
//      narrow — single quotes, whitespace, parentheses, and semicolons
//      are excluded so the convenience form can't carry a SQL payload.
//      Canonical form wraps the input in single quotes so it becomes a
//      DuckDB string-literal table name.
//
// The branches are not LL(1)-distinguishable by first character (a
// letter can start either branch 2 or branch 3), so we try branch 2
// first and fall through to branch 3 if it can't consume the input.
//
// The parser uses TinyParser for tokenization. The single token map
// names every shape DuckDB cares about; `parse()` dispatches based on
// which token sequence we see.

import {TinyParser, TinyParseError} from '../tiny_parser';
import type {ValidateTablePathResult} from '../table-path';

class DuckDBTablePathParser extends TinyParser {
  constructor(input: string) {
    // Tokens are tried in declaration order, first match wins. The
    // ordering that matters is `bare` before `filePath`: both match an
    // input like `foo`, and we want it lexed as a bare identifier
    // (entering branch 2) rather than as a single file-path token.
    super(input, {
      singleQuoted: /^'(?:[^']|'')*'/,
      bare: /^[A-Za-z_][A-Za-z0-9_]*/,
      delim: /^"(?:[^"]|"")*"/,
      dot: /^\./,
      filePath: /^[A-Za-z0-9._\-/:?*]+/,
    });
  }

  parse(): ValidateTablePathResult {
    if (this.input.length === 0) {
      return {ok: false, error: 'DuckDB table path is empty'};
    }
    try {
      const first = this.peek();

      // Branch 1: whole input is a single-quoted literal.
      if (first.type === 'singleQuoted') {
        this.read();
        if (!this.eof()) {
          throw this.parseError(
            'trailing characters after closing single quote'
          );
        }
        return {ok: true, canonical: this.input};
      }

      // Branch 2: identifier path. We commit only if it consumes the
      // entire input; otherwise we fall through to the convenience
      // branch below (the parser state stops at the offending char).
      if (first.type === 'bare' || first.type === 'delim') {
        this.read();
        while (this.match('dot')) {
          const seg = this.peek();
          if (seg.type !== 'bare' && seg.type !== 'delim') {
            // Identifier path failed mid-stream; try convenience.
            return tryFilePathConvenience(this.input);
          }
          this.read();
        }
        if (this.eof()) {
          return {ok: true, canonical: this.input};
        }
        // Identifier path stopped before end-of-input; try convenience.
        return tryFilePathConvenience(this.input);
      }

      // Branch 3: file-path convenience.
      return tryFilePathConvenience(this.input);
    } catch (e) {
      if (e instanceof TinyParseError) {
        return {ok: false, error: e.message};
      }
      throw e;
    }
  }
}

function tryFilePathConvenience(input: string): ValidateTablePathResult {
  const p = new TinyParser(input, {
    filePath: /^[A-Za-z0-9._\-/:?*]+/,
  });
  const tok = p.peek();
  if (tok.type === 'filePath' && tok.text === input) {
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

export function validateDuckDBTablePath(
  input: string
): ValidateTablePathResult {
  return new DuckDBTablePathParser(input).parse();
}
