/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';
import {mkSqlEqWith} from '../util';

afterAll(() => testDatabase.shutdown());

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

const testModel = wrapTestModel(testDatabase, '');

describe('string literal', () => {
  for (const {name, value} of STRING_CORPUS) {
    test(name, async () => {
      await expect(`
            run: db.sql("SELECT 1 as one") -> {
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
            run: db.sql("SELECT 1 as one") -> {
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
            run: db.sql("SELECT 1 as one") -> {
              select: ${toMalloyIdent(value)} is 42
            }
          `).toMatchResult(testModel, {[value]: 42});
    });
  }
});

const emptyModel = wrapTestModel(testDatabase, '');
const sqlEq = mkSqlEqWith(testDatabase.runtime, 'db', {
  malloy: `extend {
      dimension: friName is 'friday'
      dimension: friDay is 5
      dimension: satName is 'saturday'
      dimension: satDay is 6
    }`,
});

describe('string literal quoting', () => {
  const dq = '"';
  const tick = "'";
  const back = '\\';
  test('quote single character', async () => {
    expect(await sqlEq(`'${back}x'`, 'x')).isSqlEq();
  });
  test('quote single quote', async () => {
    expect(await sqlEq(`'${back}${tick}'`, tick)).isSqlEq();
  });
  test('quote double quote', async () => {
    await expect(
      `run: db.sql("SELECT 1 as one") -> {
          select: double_quote is "${back}${dq}"
        }`
    ).toMatchResult(emptyModel, {double_quote: '"'});
  });
  test('quote backslash', async () => {
    expect(await sqlEq(`'${back}${back}'`, back)).isSqlEq();
  });
  test('strings containing newline', async () => {
    await expect(
      `run: db.sql("SELECT 1 as one") -> {
          select: newline is 'a${back}nb'
        }`
    ).toMatchResult(emptyModel, {newline: 'a\nb'});
  });
});

describe('quoting and strings', () => {
  const tick = "'";
  const back = '\\';
  test('backslash quote', async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.sql('SELECT 1 as one') -> {
          select: tick is '${back}${tick}'
        }
      `).toMatchResult(testModel, {tick});
  });
  test('backslash backslash', async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.sql("SELECT 1 as one") -> {
          select: back is '${back}${back}'
        }
      `).toMatchResult(testModel, {back});
  });

  test('source with reserve word', async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        source: create is db.table('malloytest.state_facts')
        run: create -> {
          aggregate: c is count()
        }
      `).toMatchResult(testModel, {c: 51});
  });

  test.when(testDatabase.dialect.supportsNesting)(
    'spaces in names',
    async () => {
      const testModel = wrapTestModel(testDatabase, '');
      await expect(`
        source: \`space race\` is db.table('malloytest.state_facts') extend {
          join_one: \`j space\` is db.table('malloytest.state_facts') on \`j space\`.state=state
          view: \`q u e r y\` is {
            group_by:
              \`P O P\` is popular_name
              \`J P O P\` is \`j space\`.popular_name
            aggregate: \`c o u n t\` is count()
            calculate:
              \`R O W\` is row_number()
              \`l a g\` is lag(\`P O P\`, 1)
            nest: \`by state\` is {
              group_by: \`J S\` is \`j space\`.state
              aggregate: \`c o u n t\` is count()
            }
          }
        }
        run: \`space race\` -> \`q u e r y\`
      `).toMatchResult(testModel, {'c o u n t': 24});
    }
  );
});

const orderByModel = wrapTestModel(
  testDatabase,
  `
    source: models is db.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`
);

it('reserved words are quoted', async () => {
  await expect(`
      run: models->{
        aggregate: fetch is count()
      }->{
        group_by: fetch
      }
    `).toMatchResult(orderByModel, {});
});

test.when(testDatabase.dialect.supportsNesting)(
  'reserved words are quoted in turtles',
  async () => {
    await expect(`
      run: db.table('malloytest.state_facts')->{
        nest: withx is {
          group_by: select is upper(popular_name)
          aggregate: fetch is count()
        }
      } -> {
        select:
          withxz is lower(withx.select)
          fetch is withx.fetch
      }
    `).toMatchResult(orderByModel, {});
  }
);

it.skip('reserved words in structure definitions', async () => {
  await expect(`
      run: models->{
        nest: withx is {
          group_by: is select is UPPER(manufacturer)
          aggregate: fetch is count()
        }
      } -> {
        select: withxis lower(withx.select)
        select: fetch is with.fetch
      }
    `).toMatchResult(orderByModel, {});
});
it('properly quotes nested field names', async () => {
  const one = testDatabase.dialect.sqlQuoteIdentifier('one');
  await expect(`
      run: db.sql(""" SELECT 1 as ${one} """) -> {
        nest: foo is {
          group_by: one
          aggregate: \`#\` is count(one)
          nest: deepfoo is {
            group_by: one
            aggregate: \`#\` is count(one)
          }
        }
        // A nest of nothing but aggregates is a single record rather than a
        // list, and is built by a different dialect method.
        nest: measures_only is {
          aggregate: \`#\` is count(one)
          aggregate: \`order\` is one.sum()
        }
      }`).toMatchResult(testModel, {
    foo: [{'one': 1, '#': 1, 'deepfoo': [{'one': 1, '#': 1}]}],
    measures_only: {'#': 1, 'order': 1},
  });
});

// A nest's output field names are the user's, so every place a stage
// declares or reads them has to quote them -- including the row type a
// multi-stage nest builds to carry its first stage into its second.
test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsPipelinesInViews
)('properly quotes nested field names through a second stage', async () => {
  await expect(`
      run: db.table('malloytest.state_facts') -> {
        where: state = 'CA'
        group_by: popular_name
        nest: counted is {
          group_by: \`order\` is state
          aggregate: n is count()
        } -> {
          group_by: \`order\`
          aggregate: t is n.sum()
        }
      }`).toMatchResult(testModel, {
    counted: [{'order': 'CA', 't': 1}],
  });
});
