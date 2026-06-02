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

// ---------------------------------------------------------------------------
// sqlValidateTableName — table-path grammar per dialect
// ---------------------------------------------------------------------------
//
// The validator's contract is per-dialect: each engine has its own bare-
// identifier rules (Postgres allows `$`, MySQL allows digit-start, Trino
// is strict ANSI, etc.). These corpora reflect the live engines'
// observed behavior.
//
// Inputs that every dialect — including the special-grammar ones — must
// agree on. DuckDB's wider acceptance set is tested separately.
const UNIVERSAL_ACCEPT = [
  {name: 'bare', value: 'foo'},
  {name: 'dotted_two_part', value: 'schema.foo'},
  {name: 'dotted_three_part', value: 'project.schema.foo'},
];

const UNIVERSAL_REJECT = [
  {name: 'empty', value: ''},
  {name: 'leading_dot', value: '.foo'},
  {name: 'trailing_dot', value: 'foo.'},
  {name: 'has_space', value: 'foo bar'},
  {name: 'has_semicolon', value: 'foo;DROP TABLE x;--'},
  {name: 'mixed_ident_string', value: "schema.'name'"},
];

// Per-dialect cases — divergences from the universal corpus that this
// dialect's engine actually treats differently. The label reflects the
// live engine's behavior (verified empirically).
interface PerDialectCase {
  name: string;
  value: string;
}
interface PerDialectCorpus {
  accept: PerDialectCase[];
  reject: PerDialectCase[];
}

const PER_DIALECT: Record<string, PerDialectCorpus> = {
  postgres: {
    accept: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'quoted', value: '"foo"'},
      {name: 'quoted_doubled', value: '"foo""bar"'},
      {name: 'dotted_quoted', value: '"schema"."foo"'},
    ],
    reject: [
      {name: 'digit_start', value: '1foo'},
      {name: 'unterminated_quote', value: '"foo'},
    ],
  },
  mysql: {
    accept: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'digit_start_non_numeric', value: '1foo'},
      {name: 'backtick_quoted', value: '`foo`'},
      {name: 'backtick_doubled', value: '`foo``bar`'},
    ],
    reject: [
      {name: 'pure_numeric', value: '123'},
      {name: 'unterminated_backtick', value: '`foo'},
    ],
  },
  snowflake: {
    accept: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'quoted', value: '"foo"'},
      {name: 'quoted_doubled', value: '"foo""bar"'},
    ],
    reject: [
      {name: 'digit_start', value: '1foo'},
      {name: 'unterminated_quote', value: '"foo'},
    ],
  },
  trino: {
    accept: [
      {name: 'quoted', value: '"foo"'},
      {name: 'quoted_doubled', value: '"foo""bar"'},
    ],
    reject: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'digit_start', value: '1foo'},
      {name: 'unterminated_quote', value: '"foo'},
    ],
  },
  presto: {
    accept: [
      {name: 'quoted', value: '"foo"'},
      {name: 'quoted_doubled', value: '"foo""bar"'},
    ],
    reject: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'digit_start', value: '1foo'},
      {name: 'unterminated_quote', value: '"foo'},
    ],
  },
  databricks: {
    accept: [
      {name: 'digit_start_non_numeric', value: '1foo'},
      {name: 'backtick_quoted', value: '`foo`'},
      {name: 'backtick_doubled', value: '`foo``bar`'},
    ],
    reject: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'pure_numeric', value: '123'},
      {name: 'unterminated_backtick', value: '`foo'},
    ],
  },
  // BigQuery's wildcard behavior is tested separately below.
  standardsql: {
    accept: [
      {name: 'dashed_segment', value: 'my-project.dataset.table'},
      {name: 'whole_backtick', value: '`my-project.dataset.table`'},
      {name: 'per_segment_backtick', value: '`proj`.dataset.`table`'},
    ],
    reject: [
      {name: 'dollar_in_bare', value: 'foo$bar'},
      {name: 'digit_start', value: '1foo'},
      {name: 'unmatched_backtick', value: '`foo'},
    ],
  },
};

for (const dialect of getDialects()) {
  describe(`${dialect.name} sqlValidateTableName`, () => {
    describe('universal accept', () => {
      for (const {name, value} of UNIVERSAL_ACCEPT) {
        it(name, () => {
          const result = dialect.sqlValidateTableName(value);
          expect(result.ok).toBe(true);
          if (result.ok) expect(result.canonical).toBe(value);
        });
      }
    });

    // DuckDB's file-path convenience accepts many shapes the standard
    // dialects reject; skip the universal-reject corpus there.
    if (dialect.name !== 'duckdb') {
      describe('universal reject', () => {
        for (const {name, value} of UNIVERSAL_REJECT) {
          it(name, () => {
            const result = dialect.sqlValidateTableName(value);
            expect(result.ok).toBe(false);
          });
        }
      });
    }

    const perDialect = PER_DIALECT[dialect.name];
    if (perDialect) {
      describe('dialect-specific accept', () => {
        for (const {name, value} of perDialect.accept) {
          it(name, () => {
            const result = dialect.sqlValidateTableName(value);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.canonical).toBe(value);
          });
        }
      });
      describe('dialect-specific reject', () => {
        for (const {name, value} of perDialect.reject) {
          it(name, () => {
            const result = dialect.sqlValidateTableName(value);
            expect(result.ok).toBe(false);
          });
        }
      });
    }
  });
}

describe('sqlValidateTableName forbids `;` and `--` in decoded segments', () => {
  const postgres = getDialects().find(d => d.name === 'postgres')!;
  const duckdb = getDialects().find(d => d.name === 'duckdb')!;

  it('postgres rejects `;` inside quoted identifier', () => {
    const r = postgres.sqlValidateTableName('"x;evil"');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/forbidden character/);
  });

  it('postgres rejects `--` inside quoted identifier', () => {
    const r = postgres.sqlValidateTableName('"x--evil"');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/forbidden character/);
  });

  it('duckdb rejects `;` inside quoted identifier (shared parser)', () => {
    const r = duckdb.sqlValidateTableName('"x;evil"');
    expect(r.ok).toBe(false);
  });

  it('duckdb rejects `;` inside explicit single-quoted form', () => {
    const r = duckdb.sqlValidateTableName("'x;evil'");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/forbidden character/);
  });

  it('duckdb still accepts file-path convenience without `;` or `--`', () => {
    const r = duckdb.sqlValidateTableName('data/foo.parquet');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.canonical).toBe("'data/foo.parquet'");
  });
});

// BigQuery's bare-FROM grammar doesn't accept wildcards — they must be
// backtick-quoted (`` `dataset.events_*` ``). The validator rejects the
// bare form; users supply the backticks themselves, same as they would
// in hand-written BigQuery SQL.
describe('BigQuery sqlValidateTableName — wildcards require backticks', () => {
  const bq = getDialects().find(d => d.name === 'standardsql')!;

  const acceptedAsBackticked: string[] = [
    '`dataset.events_*`',
    '`my-project.dataset.events_*`',
    'my.dataset.`events_*`', // per-segment backticking
  ];
  for (const input of acceptedAsBackticked) {
    it(`accepts: ${input}`, () => {
      const result = bq.sqlValidateTableName(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.canonical).toBe(input);
    });
  }

  const rejectedAsBare: string[] = [
    'dataset.events_*',
    'my-project.dataset.events_*',
  ];
  for (const input of rejectedAsBare) {
    it(`rejects bare: ${input}`, () => {
      const result = bq.sqlValidateTableName(input);
      expect(result.ok).toBe(false);
    });
  }
});

// DuckDB has a richer grammar — file-path convenience and explicit
// single-quoted forms — so its acceptance set is broader and its
// canonical form transforms file-path inputs by wrapping them in
// single quotes.
describe('DuckDB sqlValidateTableName — convenience extensions', () => {
  const duckdb = getDialects().find(d => d.name === 'duckdb')!;

  const acceptedAsFilePath: {name: string; input: string; canonical: string}[] =
    [
      {
        name: 'parquet_with_dash',
        input: 'arrests-latest.parquet',
        canonical: "'arrests-latest.parquet'",
      },
      {
        name: 'relative_path',
        input: '../data/foo.csv',
        canonical: "'../data/foo.csv'",
      },
      {
        name: 's3_url',
        input: 's3://bucket/x.parquet',
        canonical: "'s3://bucket/x.parquet'",
      },
      {
        name: 'glob_star',
        input: 'data/*.parquet',
        canonical: "'data/*.parquet'",
      },
      {
        name: 'glob_question',
        input: 'data/???.parquet',
        canonical: "'data/???.parquet'",
      },
    ];

  for (const {name, input, canonical} of acceptedAsFilePath) {
    it(`file-path: ${name}`, () => {
      const result = duckdb.sqlValidateTableName(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.canonical).toBe(canonical);
    });
  }

  const explicitSingleQuoted = [
    {name: 'plain', value: "'foo.csv'"},
    {name: 'with_dots', value: "'thing.with.dots'"},
    {name: 'doubled_inner_quote', value: "'o''brien'"},
  ];
  for (const {name, value} of explicitSingleQuoted) {
    it(`explicit single-quoted: ${name}`, () => {
      const result = duckdb.sqlValidateTableName(value);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.canonical).toBe(value);
    });
  }

  const rejected = [
    {name: 'has_space', value: 'foo bar.csv'},
    {name: 'has_semicolon', value: 'foo;DROP TABLE x;--'},
    {name: 'has_paren', value: 'read_csv(foo.csv)'},
    {name: 'unterminated_quote', value: "'foo"},
    {name: 'trailing_after_close', value: "'foo' AND 1=1"},
    {name: 'has_backtick', value: 'foo`bar'},
  ];
  for (const {name, value} of rejected) {
    it(`rejects: ${name}`, () => {
      const result = duckdb.sqlValidateTableName(value);
      expect(result.ok).toBe(false);
    });
  }
});
