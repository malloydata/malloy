/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {getDialects} from './dialect_map';
import {Dialect} from './dialect';
import type {RecordLiteralNode} from '../model/malloy_types';

// Byte-exact encoding for backslash-style dialects. Catches a regression to a
// different-but-decodable form; the real engine round-trip lives in the e2e
// spec, test/src/databases/all/escape-e2e.spec.ts.
describe('backslash-style exact encoding', () => {
  const bq = getDialects().find(d => d.name === 'standardsql')!;

  it('escapes LF, CR, and TAB as named escapes', () => {
    expect(bq.sqlLiteralString('a\nb\rc\td')).toBe("'a\\nb\\rc\\td'");
  });

  it('escapes the backslash and the closing quote', () => {
    expect(bq.sqlLiteralString("a\\b'c")).toBe("'a\\\\b\\'c'");
  });

  it('emits no raw newline anywhere in the output', () => {
    expect(bq.sqlLiteralString('x\r\ny')).not.toMatch(/[\n\r]/);
  });

  it('escapes control characters in quoted identifiers too', () => {
    expect(bq.sqlQuoteIdentifier('col\nname')).toBe('`col\\nname`');
    expect(bq.sqlQuoteIdentifier('col\nname')).not.toMatch(/[\n\r]/);
  });
});

// Field-name smuggling: sqlLiteralRecord and sqlFieldReference render
// user-controlled field names into SQL fragments; a quote in the name must
// not escape the literal. Strategy: strip quoted regions, then assert the
// attack payload doesn't appear in what's left (i.e. it stayed inside quotes).

const FIELD_NAME_INJECTION = "';DROP TABLE x;--";

// Skip anything between matching quote chars, handling both `''` and `\'`.
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

// The base methods must throw, naming the unset flag, when a dialect forgets
// to configure itself — so a misconfigured dialect fails CI rather than
// silently emitting wrong SQL.
describe('base Dialect fail-fast on missing config', () => {
  // Prototype-only instance: the methods under test read only instance fields,
  // so this reaches the same path a real subclass would, without the abstract
  // methods.
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

// sqlValidateTableName — per-dialect table-path grammar. Each engine has its
// own bare-identifier rules (Postgres `$`, MySQL digit-start, Trino strict
// ANSI, …); these corpora reflect the live engines. UNIVERSAL_* is what every
// dialect must agree on; DuckDB's wider acceptance set is tested separately.
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

// Per-dialect divergences from the universal corpus, reflecting live-engine
// behavior.
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

// BigQuery wildcards must be backtick-quoted (`` `dataset.events_*` ``); the
// validator rejects the bare form, same as hand-written BigQuery SQL.
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

// DuckDB's richer grammar: file-path convenience and explicit single-quoted
// forms, with file paths canonicalized by wrapping in single quotes.
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
