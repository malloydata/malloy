/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Shared dotted-table-path validator.
//
// Every "well-behaved" SQL dialect — every dialect we ship except DuckDB —
// uses the same table-path grammar:
//
//   TablePath = Segment ( '.' Segment )* EOF
//   Segment   = BareIdent | QuotedIdent
//
// The variation between dialects is purely lexical:
//   - which characters can appear in a BareIdent
//   - which character delimits a QuotedIdent (`"` vs `` ` ``)
//   - whether quoted bodies use doubled-quote escape (`""`) or backslash
//     escape (`\X`)
//
// All three are already exposed as `Dialect` properties
// (`identifierQuoteChar`, `identifierEscapeStyle`, plus the new
// `tablePathBareIdentRegex`). The base `Dialect.sqlValidateTableName`
// wires those into a call to `parseDottedTablePath` below, so a
// well-behaved dialect just declares its bare-segment regex and inherits
// the rest. Dialects whose grammars genuinely differ (today, DuckDB)
// override `sqlValidateTableName` directly.

export type ValidateTablePathResult =
  | {ok: true; canonical: string}
  | {ok: false; error: string};

export type TablePathEscapeStyle = 'doubled' | 'backslash';

export interface ParseDottedTablePathOptions {
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
 * Parse `input` as a dotted table path and require end-of-input.
 *
 * On success the canonical form is the input verbatim — we don't
 * rewrite, quote, or fold anything. Reserved-word, mixed-case, or
 * special-character names that need quoting in the user's database
 * must be quoted explicitly in the user's input.
 */
export function parseDottedTablePath(
  input: string,
  opts: ParseDottedTablePathOptions
): ValidateTablePathResult {
  const {quoteChar, escapeStyle, bareIdentRegex, dialectName} = opts;
  if (input.length === 0) {
    return {ok: false, error: `${dialectName} table path is empty`};
  }
  let i = 0;
  // Loop invariant: at the top of each iteration, `i` points at the
  // start of a segment we need to consume.
  while (true) {
    if (input[i] === quoteChar) {
      const next = consumeQuotedSegment(input, i, quoteChar, escapeStyle);
      if (next === null) {
        return {
          ok: false,
          error:
            `Invalid ${dialectName} table path: ${JSON.stringify(input)} — ` +
            'unterminated quoted segment',
        };
      }
      i = next;
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
      i += m[0].length;
    }
    if (i === input.length) return {ok: true, canonical: input};
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
 * Read past a quoted segment starting at `input[i]` (must be `quoteChar`).
 * Returns the index just after the closing quote, or `null` if the
 * segment is unterminated.
 */
function consumeQuotedSegment(
  input: string,
  i: number,
  quoteChar: string,
  escapeStyle: TablePathEscapeStyle
): number | null {
  // input[i] === quoteChar
  let j = i + 1;
  while (j < input.length) {
    if (escapeStyle === 'backslash' && input[j] === '\\') {
      if (j + 1 >= input.length) return null;
      j += 2;
      continue;
    }
    if (input[j] === quoteChar) {
      if (escapeStyle === 'doubled' && input[j + 1] === quoteChar) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j++;
  }
  return null;
}
