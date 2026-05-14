/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Shared table-path validator for ANSI-shape dialects.
//
// Every ANSI SQL dialect agrees on the *structure* of a qualified table
// reference — a dotted sequence of identifier segments — but disagrees on
// the *lexical* rules for each segment (what characters can start/continue
// a bare identifier, what's the quote char, how embedded quotes are
// escaped). This module factors at that boundary: a per-dialect token map
// (passed to `TinyParser`) defines the segment grammar; the shared
// `parseDottedTablePath` enforces the dot-separation and full-input
// consumption.
//
// Token-map conventions for table-path parsers:
//   - `bare`  — bare-identifier regex for this dialect
//   - `delim` — quoted-identifier regex for this dialect
//   - `dot`   — literal `.`
//
// Token-map names that begin with `q` are stripped of their first/last
// character by TinyParser (its convention for quoted strings). Use
// `delim` rather than `qident` so the raw delimiters stay in the token,
// which is what makes whole-input consumption checks work.
//
// Do not include a `space` rule — TinyParser's whitespace-skipping is
// keyed on that exact name, and we want whitespace inside a table path
// to be a hard rejection.
//
// Dialects whose grammar isn't dotted-segment-shaped — BigQuery's
// whole-path backtick form, DuckDB's file-path convenience and explicit
// string-literal forms — override `sqlValidateTableName` directly and do
// not use this module.

import {TinyParser, TinyParseError} from './tiny_parser';

export type ValidateTablePathResult =
  | {ok: true; canonical: string}
  | {ok: false; error: string};

/**
 * Parse a dotted identifier path: `Segment ( '.' Segment )*` and require
 * end-of-input. A segment is whatever the supplied token map calls
 * `bare` or `delim`. On success the canonical form is the input verbatim.
 *
 * `dialectName` is used only for error messages.
 */
export function parseDottedTablePath(
  input: string,
  tokenMap: Record<string, RegExp>,
  dialectName: string
): ValidateTablePathResult {
  if (input.length === 0) {
    return {ok: false, error: `${dialectName} table path is empty`};
  }
  const p = new TinyParser(input, tokenMap);
  try {
    parseSegment(p, dialectName);
    while (p.match('dot')) {
      parseSegment(p, dialectName);
    }
    if (!p.eof()) {
      throw p.parseError(
        `Invalid ${dialectName} table path: ${JSON.stringify(input)}`
      );
    }
    return {ok: true, canonical: input};
  } catch (e) {
    if (e instanceof TinyParseError) {
      return {ok: false, error: e.message};
    }
    throw e;
  }
}

function parseSegment(p: TinyParser, dialectName: string): void {
  const next = p.peek();
  if (next.type !== 'bare' && next.type !== 'delim') {
    throw p.parseError(
      `Invalid ${dialectName} table path: expected an identifier segment`
    );
  }
  p.read();
}
