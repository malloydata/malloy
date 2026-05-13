/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {getDialects} from './dialect_map';
import {Dialect} from './dialect';
import type {RecordLiteralNode} from '../model/malloy_types';

// ---------------------------------------------------------------------------
// Adversarial input corpus
// ---------------------------------------------------------------------------

// Strings to pass through string/regex/identifier escape functions. Each
// entry is something that, if mishandled, allows SQL injection or breaks
// query parsing.
const ADVERSARIAL_STRINGS: {name: string; value: string}[] = [
  {name: 'empty', value: ''},
  {name: 'bare', value: 'foo'},
  {name: 'bare_underscore', value: 'foo_bar'},
  {name: 'single_quote', value: "o'brien"},
  {name: 'double_quote', value: 'say "hi"'},
  {name: 'backtick', value: 'foo`bar'},
  {name: 'backslash', value: 'foo\\bar'},
  {name: 'lone_single_quote', value: "'"},
  {name: 'lone_double_quote', value: '"'},
  {name: 'lone_backtick', value: '`'},
  {name: 'lone_backslash', value: '\\'},
  {name: 'doubled_single_quote', value: "''"},
  {name: 'doubled_double_quote', value: '""'},
  {name: 'doubled_backtick', value: '``'},
  {name: 'injection_classic', value: "';DROP TABLE x;--"},
  {name: 'injection_or_1_1', value: "' OR 1=1 --"},
  {name: 'block_comment', value: '/* injected */'},
  {name: 'line_comment', value: '-- injected'},
  {name: 'all_delims', value: '\'`"\\'},
  {name: 'newline', value: 'line1\nline2'},
  {name: 'tab', value: 'col\tval'},
];

// Additional inputs for table paths, which may legitimately contain dots
// and other path-like characters.
const ADVERSARIAL_TABLE_PATHS: {name: string; value: string}[] = [
  ...ADVERSARIAL_STRINGS,
  {name: 'dotted_schema', value: 'schema.table'},
  {name: 'three_part_path', value: 'project.dataset.table'},
  {name: 'dashed_filename', value: 'arrests-latest.parquet'},
  {name: 'slash_path', value: 'path/to/file.parquet'},
  {name: 'space_in_name', value: 'my table'},
];

// ---------------------------------------------------------------------------
// SQL parsers — minimal but accurate enough to detect smuggling.
//
// Each parser returns the decoded value and the position after it consumed.
// If the parser cannot consume the full input as the expected SQL form,
// the test reports the failure with the actual output for diagnosis.
// ---------------------------------------------------------------------------

type ParseResult = {value: string; end: number} | null;

// Parse a SQL string literal of the form 'body', where body uses either
// '' (doubled) or \' (backslash) to escape the closing quote. Backslash
// also escapes itself when in backslash mode.
function parseStringLiteral(
  sql: string,
  mode: 'doubled' | 'backslash'
): ParseResult {
  if (sql[0] !== "'") return null;
  let i = 1;
  let value = '';
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      if (sql[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return {value, end: i + 1};
    }
    if (mode === 'backslash' && c === '\\') {
      if (i + 1 >= sql.length) return null;
      const next = sql[i + 1];
      // Decode the escape sequence. We are deliberately permissive: any
      // dialect-specific backslash sequence is accepted, but we only
      // decode the ones we recognize. The crucial point is that \' does
      // not close the literal.
      if (next === "'") value += "'";
      else if (next === '\\') value += '\\';
      else if (next === 'n') value += '\n';
      else if (next === 't') value += '\t';
      else if (next === 'r') value += '\r';
      else value += next;
      i += 2;
      continue;
    }
    value += c;
    i++;
  }
  return null; // unterminated
}

// Parse a quoted identifier delimited by `q`.
//
// - `doubled` mode treats `qq` as the escape for q (ANSI SQL).
// - `backslash` mode treats `\q`, `\\`, and other `\X` sequences as
//   string-literal-style escapes (BigQuery quoted identifiers).
function parseQuotedIdent(
  sql: string,
  q: string,
  mode: 'doubled' | 'backslash',
  start = 0
): ParseResult {
  if (sql[start] !== q) return null;
  let i = start + 1;
  let value = '';
  while (i < sql.length) {
    const c = sql[i];
    if (mode === 'backslash' && c === '\\') {
      if (i + 1 >= sql.length) return null;
      const next = sql[i + 1];
      if (next === q) value += q;
      else if (next === '\\') value += '\\';
      else if (next === 'n') value += '\n';
      else if (next === 't') value += '\t';
      else if (next === 'r') value += '\r';
      else value += next;
      i += 2;
      continue;
    }
    if (c === q) {
      if (mode === 'doubled' && sql[i + 1] === q) {
        value += q;
        i += 2;
        continue;
      }
      return {value, end: i + 1};
    }
    value += c;
    i++;
  }
  return null;
}

// Parse a bare SQL identifier starting at offset.
function parseBareIdent(sql: string, start = 0): ParseResult {
  const m = sql.slice(start).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
  if (!m) return null;
  return {value: m[0], end: start + m[0].length};
}

// Parse a dotted path of [bare | quoted] segments. Accepts a single
// identifier quote character. Returns the joined parts and total length
// consumed, or null if malformed.
function parseDottedPath(
  sql: string,
  identQuote: string,
  identMode: 'doubled' | 'backslash'
): {value: string; end: number} | null {
  let i = 0;
  const parts: string[] = [];
  while (i < sql.length) {
    let seg: ParseResult;
    if (sql[i] === identQuote) {
      seg = parseQuotedIdent(sql, identQuote, identMode, i);
    } else {
      seg = parseBareIdent(sql, i);
    }
    if (!seg) return null;
    parts.push(seg.value);
    i = seg.end;
    if (i >= sql.length) break;
    if (sql[i] !== '.') return null;
    i++;
  }
  return {value: parts.join('.'), end: i};
}

// ---------------------------------------------------------------------------
// Per-dialect probes — detect escape style and identifier quote char.
// We probe rather than hard-code so a new dialect is automatically handled.
// ---------------------------------------------------------------------------

function probeStringEscapeStyle(
  fn: (s: string) => string,
  context: string
): 'doubled' | 'backslash' {
  const out = fn("'");
  if (out === "''''") return 'doubled';
  if (out === "'\\''") return 'backslash';
  throw new Error(
    `${context}: cannot determine escape style. ` +
      `Expected one of '''' (doubled) or '\\'' (backslash), got ${JSON.stringify(out)}. ` +
      'If your dialect uses a different escape style, extend probeStringEscapeStyle.'
  );
}

function probeIdentifierQuote(d: Dialect): string {
  const out = d.sqlQuoteIdentifier('a');
  if (out.length < 2) {
    throw new Error(
      `${d.name}: sqlQuoteIdentifier('a') returned ${JSON.stringify(out)}; ` +
        'expected a quoted identifier of at least three characters.'
    );
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first !== last) {
    throw new Error(
      `${d.name}: sqlQuoteIdentifier('a') returned ${JSON.stringify(out)}; ` +
        'expected matching opening and closing quote characters.'
    );
  }
  return first;
}

// Detect whether the dialect's identifier quoting uses ANSI doubled-
// quote escapes (e.g. Postgres "a""b") or string-literal-style
// backslash escapes (BigQuery `a\\b`). Probe by feeding a single
// backslash: doubled-mode produces 3 chars (quote + \ + quote);
// backslash-mode produces 4 chars (quote + \ + \ + quote).
function probeIdentifierEscapeStyle(d: Dialect): 'doubled' | 'backslash' {
  const out = d.sqlQuoteIdentifier('\\');
  if (out.length === 3) return 'doubled';
  if (out.length === 4) return 'backslash';
  throw new Error(
    `${d.name}: sqlQuoteIdentifier('\\\\') returned ${JSON.stringify(out)}; ` +
      'expected either 3 chars (doubled) or 4 chars (backslash).'
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

for (const dialect of getDialects()) {
  describe(`${dialect.name} dialect escape invariants`, () => {
    const identQuote = probeIdentifierQuote(dialect);
    const identStyle = probeIdentifierEscapeStyle(dialect);
    const stringStyle = probeStringEscapeStyle(
      s => dialect.sqlLiteralString(s),
      `${dialect.name}.sqlLiteralString`
    );
    const regexpStyle = probeStringEscapeStyle(
      s => dialect.sqlLiteralRegexp(s),
      `${dialect.name}.sqlLiteralRegexp`
    );

    describe('sqlLiteralString round-trip', () => {
      for (const {name, value} of ADVERSARIAL_STRINGS) {
        it(name, () => {
          const out = dialect.sqlLiteralString(value);
          const parsed = parseStringLiteral(out, stringStyle);
          expect(parsed).not.toBeNull();
          expect(parsed!.end).toBe(out.length);
          expect(parsed!.value).toBe(value);
        });
      }
    });

    describe('sqlLiteralRegexp round-trip', () => {
      for (const {name, value} of ADVERSARIAL_STRINGS) {
        it(name, () => {
          const out = dialect.sqlLiteralRegexp(value);
          const parsed = parseStringLiteral(out, regexpStyle);
          expect(parsed).not.toBeNull();
          expect(parsed!.end).toBe(out.length);
          expect(parsed!.value).toBe(value);
        });
      }
    });

    describe('sqlQuoteIdentifier round-trip', () => {
      for (const {name, value} of ADVERSARIAL_STRINGS) {
        it(name, () => {
          // A dialect may refuse inputs it has no way to encode safely
          // (e.g. BigQuery cannot escape a backtick inside a backtick-
          // quoted identifier). Throwing is a safe outcome — better a
          // compile-time error than malformed or injecting SQL.
          let out: string;
          try {
            out = dialect.sqlQuoteIdentifier(value);
          } catch (e) {
            return;
          }
          const parsed = parseQuotedIdent(out, identQuote, identStyle);
          expect(parsed).not.toBeNull();
          expect(parsed!.end).toBe(out.length);
          expect(parsed!.value).toBe(value);
        });
      }
    });

    describe('quoteTablePath round-trip', () => {
      for (const {name, value} of ADVERSARIAL_TABLE_PATHS) {
        it(name, () => {
          // A dialect may refuse to encode an input (e.g. BigQuery cannot
          // represent a backtick inside a backtick-quoted identifier).
          // Throwing is a safe outcome — better a compile-time error than
          // SQL that the dialect cannot represent unambiguously.
          let out: string;
          try {
            out = dialect.quoteTablePath(value);
          } catch (e) {
            return;
          }
          // A dialect may produce either:
          //   (a) one quoted identifier containing the whole path including dots
          //       (e.g. BigQuery: `proj.dataset.table`)
          //   (b) a dot-separated sequence of bare/quoted identifier parts
          //       (e.g. Postgres: "proj"."dataset"."table")
          //   (c) a single string literal — only used by DuckDB for paths
          //       which are actually file references rather than identifiers.
          // Round-trip succeeds if any of these interpretations decodes
          // exactly to the input.
          const candidates: (() => string | null)[] = [
            // (a) Whole path as one quoted identifier.
            () => {
              const r = parseQuotedIdent(out, identQuote, identStyle);
              if (r && r.end === out.length) return r.value;
              return null;
            },
            // (b) Dotted sequence of identifier segments.
            () => {
              const r = parseDottedPath(out, identQuote, identStyle);
              if (r && r.end === out.length) return r.value;
              return null;
            },
            // (c) Single-quoted string literal (DuckDB file paths).
            () => {
              const r = parseStringLiteral(out, stringStyle);
              if (r && r.end === out.length) return r.value;
              return null;
            },
          ];

          let decoded: string | null = null;
          for (const tryParse of candidates) {
            const v = tryParse();
            if (v === value) {
              decoded = v;
              break;
            }
          }

          expect(decoded).toBe(value);
        });
      }
    });
  });
}

// Record-literal and field-reference smuggling tests.
//
// `sqlLiteralRecord` and `sqlFieldReference` render user-controlled
// field names into per-dialect SQL fragments (JSON paths, record
// constructors, JSONB extract calls). Historical bugs interpolated
// names raw into `'${name}'`, letting a single quote inside the name
// escape the SQL string literal.
//
// Test strategy: strip everything that's inside a quoted region
// (single-quoted literals, double-quoted identifiers, backtick
// identifiers), then assert the attack keyword does not appear in
// what remains. If escaping is correct, the attack chars stay inside
// the quoted region; if broken, they leak into bare SQL.

const FIELD_NAME_INJECTION = "';DROP TABLE x;--";

// Walk the SQL string, skipping anything between matching quote
// characters. Both doubled-escape (`''`) and backslash-escape (`\'`)
// styles are handled — the dialect-agnostic stripping treats both as
// "still inside a quoted region."
function stripQuotedRegions(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < sql.length && sql[i] !== c) {
        if (sql[i] === '\\' && i + 1 < sql.length) {
          i += 2;
        } else {
          i++;
        }
      }
      if (i < sql.length) i++; // consume the closing quote
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function makeRecordLit(fieldName: string): RecordLiteralNode {
  return {
    node: 'recordLiteral',
    kids: {
      [fieldName]: {
        node: 'numberLiteral',
        literal: '42',
        sql: '42',
        typeDef: {type: 'number', numberType: 'integer'},
      },
    },
    typeDef: {
      type: 'record',
      fields: [{name: fieldName, type: 'number', numberType: 'integer'}],
    },
  };
}

for (const dialect of getDialects()) {
  describe(`${dialect.name} field-name smuggling`, () => {
    it('sqlFieldReference keeps attack payload inside quoted regions', () => {
      let out: string;
      try {
        out = dialect.sqlFieldReference(
          'base',
          'record',
          FIELD_NAME_INJECTION,
          'string'
        );
      } catch {
        return; // refusing to encode is also a safe outcome
      }
      expect(stripQuotedRegions(out)).not.toMatch(/DROP\s+TABLE/i);
    });

    it('sqlLiteralRecord keeps attack payload inside quoted regions', () => {
      let out: string;
      try {
        out = dialect.sqlLiteralRecord(makeRecordLit(FIELD_NAME_INJECTION));
      } catch {
        return;
      }
      expect(stripQuotedRegions(out)).not.toMatch(/DROP\s+TABLE/i);
    });
  });
}

// Meta-test: the base Dialect's literal/identifier methods must fail
// loudly when a subclass forgets to set `stringLiteralStyle` or
// `identifierQuoteChar`. Without this guarantee a new dialect could
// silently emit SQL that looks structurally well-formed in the
// round-trip tests above but is wrong against a real database.
describe('base Dialect fail-fast on missing config', () => {
  // Construct a Dialect-prototype instance without running the
  // constructor (which would require implementing every abstract
  // method). The base methods under test only read instance fields, so
  // a prototype-only object reaches the same code path that a real
  // subclass would.
  const stub = Object.create(Dialect.prototype) as Dialect;
  stub.name = 'stub-no-config';

  it('sqlLiteralString throws naming the missing flag', () => {
    expect(() => stub.sqlLiteralString('x')).toThrow(
      /stub-no-config.*stringLiteralStyle is not set/
    );
  });

  it('sqlLiteralRegexp throws naming the missing flag', () => {
    expect(() => stub.sqlLiteralRegexp('x')).toThrow(
      /stub-no-config.*stringLiteralStyle is not set/
    );
  });

  it('sqlQuoteIdentifier throws when identifierQuoteChar is unset', () => {
    expect(() => stub.sqlQuoteIdentifier('x')).toThrow(
      /stub-no-config.*identifierQuoteChar is not set/
    );
  });

  it('sqlQuoteIdentifier throws when identifierEscapeStyle is unset', () => {
    const partial = Object.create(Dialect.prototype) as Dialect;
    partial.name = 'stub-no-escape-style';
    partial.identifierQuoteChar = '"';
    expect(() => partial.sqlQuoteIdentifier('x')).toThrow(
      /stub-no-escape-style.*identifierEscapeStyle is not set/
    );
  });
});
