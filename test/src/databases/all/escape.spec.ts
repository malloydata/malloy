/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// End-to-end escape round-trip tests. Each dialect's escape functions
// are unit-tested in packages/malloy/src/dialect/escape.spec.ts; this
// file is the integration counterpart, which proves the output actually
// parses against the real database. Without these, a unit-test parser
// blind to a dialect-specific quirk could declare success while the
// real database rejects or mis-interprets our SQL — the MySQL/Databricks
// sqlLiteralRegexp bug (now fixed) is exactly that shape: a regex
// pattern containing `\d` round-tripped through our parser, but the
// real database dropped the backslash, and the regex never matched.

import {RuntimeList, allDatabases} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

// Adversarial bytes that have historically smuggled past dialect escape
// functions. Kept small so a failure points clearly at the offending
// input.
const STRING_CORPUS: {name: string; value: string}[] = [
  {name: 'simple', value: 'hello'},
  {name: 'single_quote', value: "o'brien"},
  {name: 'backslash', value: 'a\\b'},
  {name: 'trailing_backslash', value: 'foo\\'},
  {name: 'injection', value: "';DROP TABLE x;--"},
];

// Regex patterns that exercise backslash semantics in backslash-style
// dialects. `\d` is the canonical case: in MySQL/Databricks/Snowflake/
// BigQuery the SQL parser decodes `\X` sequences, so the regex engine
// only sees `\d` if our regex literal output is `'\\d'`. A buggy
// doubled-style escape (which produced just `'\d'` for those dialects)
// would silently drop the backslash and never match a digit.
const REGEX_CORPUS: {name: string; pattern: string; haystack: string}[] = [
  {name: 'digit_class', pattern: 'a\\d', haystack: 'a5'},
  {name: 'word_class', pattern: '\\w+', haystack: 'hello'},
  {name: 'escaped_literal', pattern: 'a\\.b', haystack: 'a.b'},
];

// Identifiers that exercise sqlQuoteIdentifier and (via nest:) the
// per-dialect rawName-in-fieldList code paths fixed in this PR.
const IDENT_CORPUS: {name: string; value: string}[] = [
  {name: 'space', value: 'has space'},
  {name: 'single_quote', value: "o'brien"},
  {name: 'reserved_word', value: 'select'},
];

function toMalloyString(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// Render a JS string as a Malloy regex literal (r'...').
//
// The lexer rules (MalloyLexer.g4) are:
//   HACKY_REGEX: ('/' | [rR]) SQ RAW_CHAR*? SQ;
//   RAW_CHAR:    ('\\' ~[\n]) | ~[\\\n];
//
// r'...' is a raw string: there is no escape character. The `\X`
// alternative of RAW_CHAR exists only so the lexer can scan past
// a quote without terminating — both the backslash and X end up
// in the resulting string. Consequences:
//
//   * A single quote in the desired body has no lossless encoding.
//     `\'` puts a `'` in the body but leaves an extra `\` next to
//     it, which changes the regex pattern.
//   * A newline has no encoding (matches neither RAW_CHAR branch).
//   * A body ending in an odd run of backslashes has no encoding:
//     the trailing `\` consumes the closing `'` as part of `\'`,
//     leaving the literal unterminated.
//
// We refuse those inputs rather than silently emit a different
// regex than the caller asked for. (Aside: CodeQL flags
// `s.replace(/'/g, "\\'")` here under js/incomplete-sanitization
// because it escapes one character without escaping the escape
// character. That rule assumes a non-raw quoted-string context;
// it doesn't fit r'...', where the right answer is "refuse what
// can't be encoded," not "escape more.")
function toMalloyRegex(s: string): string {
  const trailingBackslashes = s.match(/\\*$/)![0].length;
  if (s.includes("'") || s.includes('\n') || trailingBackslashes % 2 === 1) {
    throw new Error(
      `toMalloyRegex cannot encode this string as r'...': ${JSON.stringify(s)}`
    );
  }
  return "r'" + s + "'";
}

function toMalloyIdent(s: string): string {
  return '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
}

describe.each(runtimes.runtimeList)(
  '%s escape round-trip',
  (dbName, runtime) => {
    const testModel = wrapTestModel(runtime, '');

    describe('string literal', () => {
      for (const {name, value} of STRING_CORPUS) {
        test(name, async () => {
          await expect(`
            run: ${dbName}.sql("SELECT 1 as one") -> {
              select: x is ${toMalloyString(value)}
            }
          `).toMatchResult(testModel, {x: value});
        });
      }
    });

    describe('regex literal', () => {
      for (const {name, pattern, haystack} of REGEX_CORPUS) {
        test(name, async () => {
          await expect(`
            run: ${dbName}.sql("SELECT 1 as one") -> {
              select: m is ${toMalloyString(haystack)} ~ ${toMalloyRegex(pattern)}
            }
          `).toMatchResult(testModel, {m: true});
        });
      }
    });

    describe('adversarial column name', () => {
      for (const {name, value} of IDENT_CORPUS) {
        test(name, async () => {
          // A Malloy backtick-quoted identifier with the adversarial
          // value as the output column name. The dialect must quote
          // this safely in the generated SQL, and the result row must
          // be addressable by that exact column name.
          await expect(`
            run: ${dbName}.sql("SELECT 1 as one") -> {
              select: ${toMalloyIdent(value)} is 42
            }
          `).toMatchResult(testModel, {[value]: 42});
        });
      }
    });
  }
);
