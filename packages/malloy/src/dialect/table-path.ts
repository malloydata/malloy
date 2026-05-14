/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Parser for dotted table paths of the shape
//
//   TablePath = Segment ( '.' Segment )* EOF
//   Segment   = BareIdent | QuotedIdent
//
// parameterized by the bare-segment regex, the quote character, and
// the quote escape style (`""` doubled or `\X` backslash). Used by
// `Dialect.sqlValidateTableName` and by connection code that needs to
// take a canonical tablePath apart to talk to a metadata API.

export type ValidateTablePathResult =
  | {ok: true; canonical: string}
  | {ok: false; error: string};

export interface TablePathSegment {
  /** Decoded segment value: delimiters stripped, escapes unescaped. */
  value: string;
  /** Whether the segment appeared in quoted form in the input. */
  quoted: boolean;
}

export type DecodeDottedTablePathResult =
  | {ok: true; segments: TablePathSegment[]}
  | {ok: false; error: string};

export type TablePathEscapeStyle = 'doubled' | 'backslash';

export interface DottedTablePathOptions {
  /** Delimiter for quoted segments (`"`, `` ` ``, …). */
  quoteChar: string;
  /**
   * How a literal `quoteChar` is encoded inside a quoted body:
   *   - 'doubled':   `qq` inside body escapes one literal `q`.
   *   - 'backslash': `\X` is a two-character escape; unescaped `q` closes.
   */
  escapeStyle: TablePathEscapeStyle;
  /**
   * Regex matching one bare segment, anchored at the start of the input.
   * Must NOT have global/sticky flags; the parser calls `.match()` on
   * `input.slice(i)` and expects the match to start at position 0.
   */
  bareIdentRegex: RegExp;
  /** Used in error messages only. */
  dialectName: string;
}

/**
 * Parse `input` as a dotted table path and require end-of-input. On
 * success, returns the decoded segment values — delimiters stripped,
 * escape sequences unescaped — so callers that need the segments
 * (connection metadata lookups) and callers that only need
 * accept/reject (`validateDottedTablePath`) share one parser.
 */
export function decodeDottedTablePath(
  input: string,
  opts: DottedTablePathOptions
): DecodeDottedTablePathResult {
  const {quoteChar, escapeStyle, bareIdentRegex, dialectName} = opts;
  if (input.length === 0) {
    return {ok: false, error: `${dialectName} table path is empty`};
  }
  const segments: TablePathSegment[] = [];
  let i = 0;
  while (true) {
    let segValue: string;
    let segQuoted: boolean;
    if (input[i] === quoteChar) {
      const result = consumeQuotedSegment(input, i, quoteChar, escapeStyle);
      if (result === null) {
        return {
          ok: false,
          error:
            `Invalid ${dialectName} table path: ${JSON.stringify(input)} — ` +
            'unterminated quoted segment',
        };
      }
      segValue = result.decoded;
      segQuoted = true;
      i = result.end;
    } else {
      const m = input.slice(i).match(bareIdentRegex);
      if (!m || m.index !== 0 || m[0].length === 0) {
        return {
          ok: false,
          error:
            `Invalid ${dialectName} table path: ${JSON.stringify(input)} — ` +
            `invalid segment at position ${i}`,
        };
      }
      segValue = m[0];
      segQuoted = false;
      i += m[0].length;
    }
    // Defense-in-depth: `;` and `--` are forbidden in any decoded segment,
    // even a legally-quoted one. Real table names don't contain them.
    if (segValue.includes(';') || segValue.includes('--')) {
      return {
        ok: false,
        error:
          `Invalid ${dialectName} table path: segment ${JSON.stringify(segValue)} ` +
          'contains forbidden character; even when quoted, table-path ' +
          'segments may not contain `;` or `--`.',
      };
    }
    segments.push({value: segValue, quoted: segQuoted});
    if (i === input.length) return {ok: true, segments};
    if (input[i] !== '.') {
      return {
        ok: false,
        error:
          `Invalid ${dialectName} table path: ${JSON.stringify(input)} — ` +
          `expected '.' at position ${i}`,
      };
    }
    i++;
    if (i === input.length) {
      return {
        ok: false,
        error:
          `Invalid ${dialectName} table path: ${JSON.stringify(input)} — ` +
          'trailing dot',
      };
    }
  }
}

/**
 * Validate `input` as a dotted table path. On success the canonical
 * form is the input verbatim. See `decodeDottedTablePath` for the
 * underlying parser; this is the validate-only wrapper that doesn't
 * expose segment internals.
 */
export function validateDottedTablePath(
  input: string,
  opts: DottedTablePathOptions
): ValidateTablePathResult {
  const result = decodeDottedTablePath(input, opts);
  if (!result.ok) return result;
  return {ok: true, canonical: input};
}

/**
 * Read past a quoted segment starting at `input[i]` (must be `quoteChar`).
 * Returns the segment body (delimiters stripped, escape sequences
 * unescaped) and the index just after the closing quote, or `null` if
 * the segment is unterminated.
 */
function consumeQuotedSegment(
  input: string,
  i: number,
  quoteChar: string,
  escapeStyle: TablePathEscapeStyle
): {decoded: string; end: number} | null {
  // input[i] === quoteChar
  let j = i + 1;
  let decoded = '';
  while (j < input.length) {
    if (escapeStyle === 'backslash' && input[j] === '\\') {
      if (j + 1 >= input.length) return null;
      decoded += decodeBackslashEscape(input[j + 1]);
      j += 2;
      continue;
    }
    if (input[j] === quoteChar) {
      if (escapeStyle === 'doubled' && input[j + 1] === quoteChar) {
        decoded += quoteChar;
        j += 2;
        continue;
      }
      return {decoded, end: j + 1};
    }
    decoded += input[j];
    j++;
  }
  return null;
}

/**
 * Decode a single character after a backslash. We intentionally accept
 * any character — we're a translator-time grammar check, not a strict
 * lexical conformance test for any particular engine's quoted-identifier
 * escape table. The engine will surface its own errors at bind time if
 * it doesn't recognize a particular sequence.
 */
function decodeBackslashEscape(c: string): string {
  switch (c) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    case 'r':
      return '\r';
    default:
      return c;
  }
}
