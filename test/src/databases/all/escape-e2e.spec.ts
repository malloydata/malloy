/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// End-to-end escape round-trip tests: prove each dialect's escape output
// parses and decodes correctly on the real database. The dialect unit spec
// (packages/malloy/src/dialect/escape.spec.ts) asserts exact encoding but
// cannot decode, so round-trip verification lives here.

import {RuntimeList, allDatabases} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

// Adversarial inputs that have smuggled past escape functions.
const STRING_CORPUS: {name: string; value: string}[] = [
  {name: 'simple', value: 'hello'},
  // Quotes and delimiters.
  {name: 'single_quote', value: "o'brien"},
  {name: 'double_quote', value: 'say "hi"'},
  {name: 'backtick', value: 'foo`bar'},
  {name: 'lone_single_quote', value: "'"},
  {name: 'lone_double_quote', value: '"'},
  {name: 'lone_backtick', value: '`'},
  {name: 'doubled_single_quote', value: "''"},
  {name: 'doubled_double_quote', value: '""'},
  {name: 'doubled_backtick', value: '``'},
  {name: 'all_delims', value: '\'`"\\'},
  // Backslash — literal in doubled dialects, an escape in backslash dialects.
  {name: 'backslash', value: 'a\\b'},
  {name: 'trailing_backslash', value: 'foo\\'},
  {name: 'lone_backslash', value: '\\'},
  // Injection / SQL-comment payloads.
  {name: 'injection', value: "';DROP TABLE x;--"},
  {name: 'injection_or_1_1', value: "' OR 1=1 --"},
  {name: 'block_comment', value: '/* injected */'},
  {name: 'line_comment', value: '-- injected'},
  // Control characters. A raw newline broke BigQuery ("Unclosed string
  // literal"). A lone `\r` is omitted: some engines normalize a bare CR, so
  // its round-trip is engine-dependent — covered by no test, by design.
  {name: 'tab', value: 'col\tval'},
  {name: 'newline', value: 'line1\nline2'},
  {name: 'crlf', value: 'line1\r\nline2'},
  {name: 'multiline_blob', value: 'Order summary\r\nitem: widget\r\nqty: 3'},
];

// Regex patterns exercising backslash semantics: `\d` only reaches the regex
// engine as `\d` if the literal output is `'\\d'`; a doubled-style bug would
// drop the backslash and never match.
const REGEX_CORPUS: {name: string; pattern: string; haystack: string}[] = [
  {name: 'digit_class', pattern: 'a\\d', haystack: 'a5'},
  {name: 'word_class', pattern: '\\w+', haystack: 'hello'},
  {name: 'escaped_literal', pattern: 'a\\.b', haystack: 'a.b'},
];

// Identifiers exercising sqlQuoteIdentifier and the rawName-in-fieldList paths.
const IDENT_CORPUS: {name: string; value: string}[] = [
  {name: 'space', value: 'has space'},
  {name: 'single_quote', value: "o'brien"},
  {name: 'reserved_word', value: 'select'},
];

function toMalloyString(s: string): string {
  // Escape control chars so the value is valid Malloy source; the lexer
  // decodes \n/\r/\t back to the original bytes, so the value reaching the
  // database is exact.
  const body = s.replace(/[\\'\n\r\t]/g, ch => {
    switch (ch) {
      case '\\':
        return '\\\\';
      case "'":
        return "\\'";
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\t':
        return '\\t';
      default:
        return ch;
    }
  });
  return "'" + body + "'";
}

// Render a JS string as a Malloy raw regex literal (r'...'). A raw string has
// no escape character, so a quote, a newline, or an odd run of trailing
// backslashes cannot be encoded — refuse those rather than emit a different
// pattern than was asked for.
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
          // The adversarial value is the output column name; the result row
          // must be addressable by that exact name.
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
