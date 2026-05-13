/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Validator for DuckDB table-path strings supplied to `connection.table()`.
//
// DuckDB's FROM-clause table grammar is permissive: it accepts identifier
// paths, double-quoted identifiers, single-quoted string-literal names,
// and (via replacement scans) file paths and globs. We restrict
// `connection.table()` to a defined subset and reject everything else at
// translation time. The grammar:
//
//   TablePath
//     = ExplicitSingleQuoted             # 'foo.csv', 'foo''bar', s3://x
//     / IdentifierPath                   # foo, foo.bar, "name", "a"."b"
//     / FilePathConvenience              # arrests-latest.parquet, data/*.parquet
//
//   ExplicitSingleQuoted = "'" ( [^'] / "''" )* "'"
//   IdentifierPath       = Segment ( "." Segment )*
//   Segment              = BareIdent / QuotedIdent
//   BareIdent            = [A-Za-z_] [A-Za-z0-9_]*
//   QuotedIdent          = '"' ( [^"] / '""' )* '"'
//   FilePathConvenience  = [A-Za-z0-9._\-/:?*]+
//
// The FilePathConvenience char set is deliberately narrow:
//   - alphanumerics, dot, dash, underscore: identifier-like
//   - slash, colon: paths and URL schemes
//   - question-mark, star: DuckDB glob wildcards
// Anything outside that set — spaces, parens, semicolons, `'`, `"` — falls
// through to a translation-time error. Users who need exotic characters
// in a path use the ExplicitSingleQuoted form (typing literal `'`s into
// their Malloy string).
//
// In all three branches the canonical SQL form is the input verbatim.

export type ValidationResult =
  | {ok: true; canonical: string}
  | {ok: false; error: string};

const RE_BARE_IDENT_START = /[A-Za-z_]/;
const RE_BARE_IDENT_CONT = /[A-Za-z0-9_]/;
const RE_CONVENIENCE_CHAR = /[A-Za-z0-9._\-/:?*]/;

export function validateDuckDBTablePath(input: string): ValidationResult {
  if (input.length === 0) {
    return {ok: false, error: 'DuckDB table path is empty'};
  }

  if (input[0] === "'") {
    return parseExplicitSingleQuoted(input);
  }

  // Try IdentifierPath. If the whole input is consumed, the input is
  // already SQL-ready and is its own canonical form.
  if (consumesAll(input, parseIdentifierPath)) {
    return {ok: true, canonical: input};
  }

  // Try FilePathConvenience. The convenience char set excludes `'` (and
  // any SQL-suspicious char), so wrapping in single quotes produces a
  // safe DuckDB string-literal table name — no escape needed.
  if (consumesAll(input, parseConvenience)) {
    return {ok: true, canonical: `'${input}'`};
  }

  return {
    ok: false,
    error:
      `Invalid DuckDB table path: ${JSON.stringify(input)} — expected one of ` +
      'an identifier path (e.g. main.flights), a quoted identifier ("name"), ' +
      "a single-quoted string ('foo.csv'), or a file-path-shaped string of " +
      'letters, digits, and `._-/:?*`. Wrap exotic paths in single quotes.',
  };
}

function consumesAll(
  input: string,
  parse: (s: string, i: number) => number | null
): boolean {
  const end = parse(input, 0);
  return end === input.length;
}

// Returns the index just past the explicit single-quoted literal, or null.
function parseExplicitSingleQuoted(input: string): ValidationResult {
  // input[0] === "'"
  let i = 1;
  while (i < input.length) {
    if (input[i] === "'") {
      if (input[i + 1] === "'") {
        i += 2; // doubled-quote escape
      } else {
        // Closing quote. Must be the last character.
        if (i === input.length - 1) {
          return {ok: true, canonical: input};
        }
        return {
          ok: false,
          error:
            `Invalid DuckDB table path: ${JSON.stringify(input)} — ` +
            'trailing characters after closing single quote.',
        };
      }
    } else {
      i++;
    }
  }
  return {
    ok: false,
    error:
      `Invalid DuckDB table path: ${JSON.stringify(input)} — unterminated ` +
      "single-quoted string (use '' to embed a single quote inside).",
  };
}

// Returns the index after the last consumed character of an IdentifierPath
// starting at `i`, or null if the input does not start with a valid path.
function parseIdentifierPath(input: string, i: number): number | null {
  let pos = parseSegment(input, i);
  if (pos === null) return null;
  while (pos < input.length && input[pos] === '.') {
    const next = parseSegment(input, pos + 1);
    if (next === null) return null;
    pos = next;
  }
  return pos;
}

function parseSegment(input: string, i: number): number | null {
  if (i >= input.length) return null;
  if (input[i] === '"') {
    // Quoted identifier with "" doubled-quote escape.
    let j = i + 1;
    while (j < input.length) {
      if (input[j] === '"') {
        if (input[j + 1] === '"') {
          j += 2;
        } else {
          return j + 1;
        }
      } else {
        j++;
      }
    }
    return null; // unterminated
  }
  if (!RE_BARE_IDENT_START.test(input[i])) return null;
  let j = i + 1;
  while (j < input.length && RE_BARE_IDENT_CONT.test(input[j])) {
    j++;
  }
  return j;
}

function parseConvenience(input: string, i: number): number | null {
  if (i >= input.length || !RE_CONVENIENCE_CHAR.test(input[i])) return null;
  let j = i + 1;
  while (j < input.length && RE_CONVENIENCE_CHAR.test(input[j])) {
    j++;
  }
  return j;
}
