/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {expr, TestTranslator, BetaExpression} from './test-translator';
import {parseString} from '../parse-utils';
import './parse-expects';
import {isGranularResult} from '../ast/types/granular-result';

describe('literals', () => {
  test('integer', () => {
    expect(expr`42`).toTranslate();
  });
  test('string', () => {
    const m = new BetaExpression("'forty two'");
    expect(m).toTranslate();
    const m42 = m.generated().value[0];
    expect(m42).toMatchObject({literal: 'forty two'});
  });

  test('string with quoted quote', () => {
    const str = "'Isn" + '\\' + "'t this nice'";
    expect(new BetaExpression(str)).toTranslate();
  });
  test('string with quoted backslash', () => {
    const str = "'Is " + '\\' + '\\' + " nice'";
    expect(new BetaExpression(str)).toTranslate();
  });
  const literalTimes: [string, string, string | undefined, unknown][] = [
    ['@1960', 'date', 'year', {literal: '1960-01-01'}],
    ['@1960-Q2', 'date', 'quarter', {literal: '1960-04-01'}],
    ['@1960-06', 'date', 'month', {literal: '1960-06-01'}],
    ['@1960-06-26-WK', 'date', 'week', {literal: '1960-06-26'}],
    ['@1960-06-30', 'date', 'day', {literal: '1960-06-30'}],
    ['@1960-06-30 10', 'timestamp', 'hour', {literal: '1960-06-30 10:00:00'}],
    [
      '@1960-06-30 10:30',
      'timestamp',
      'minute',
      {literal: '1960-06-30 10:30:00'},
    ],
    [
      '@1960-06-30 10:30:00',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00'},
    ],
    [
      '@1960-06-30 10:30:00.123',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00.123'},
    ],
    [
      '@1960-06-30T10:30:00',
      'timestamp',
      undefined,
      {literal: '1960-06-30 10:30:00'},
    ],
    [
      '@1960-06-30 10:30:00[America/Los_Angeles]',
      'timestamp',
      undefined,
      {
        literal: '1960-06-30 10:30:00',
        timezone: 'America/Los_Angeles',
      },
    ],
  ];
  test.each(literalTimes)('%s', (expr, timeType, timeframe, result) => {
    const exprModel = new BetaExpression(expr);
    expect(exprModel).toTranslate();
    const ir = exprModel.generated();
    expect(ir.dataType).toEqual(timeType);
    if (timeframe) {
      expect(isGranularResult(ir)).toBeTruthy();
      if (isGranularResult(ir)) {
        expect(ir.timeframe).toEqual(timeframe);
      }
    } else {
      expect(isGranularResult(ir)).toBeFalsy();
    }
    expect(ir.value[0]).toEqual(expect.objectContaining(result));
  });
  const morphicLiterals: [string, string | undefined][] = [
    ['@1960', '1960-01-01 00:00:00'],
    ['@1960-Q2', '1960-04-01 00:00:00'],
    ['@1960-06', '1960-06-01 00:00:00'],
    ['@1960-06-26-Wk', '1960-06-26 00:00:00'],
    ['@1960-06-30', '1960-06-30 00:00:00'],
    ['@1960-06-30 00:00', undefined],
  ];
  test.each(morphicLiterals)('morphic value for %s is %s', (expr, morphic) => {
    const exprModel = new BetaExpression(expr);
    expect(exprModel).toTranslate();
    const ir = exprModel.generated();
    const morphTo = ir.morphic && ir.morphic['timestamp'];
    if (morphic) {
      expect(morphTo).toBeDefined();
      if (morphTo) {
        expect(morphTo[0]).toEqual(expect.objectContaining({literal: morphic}));
      }
    } else {
      expect(morphTo).toBeUndefined();
    }
  });
  test('minute+locale', () => {
    expect(expr`@1960-06-30 10:30[America/Los_Angeles]`).toTranslate();
  });
  test('second 8601', () => {
    expect(expr`@1960-06-30T10:30:31`).toTranslate();
  });
  test('null', () => {
    expect(expr`null`).toTranslate();
  });
  test('now', () => {
    expect(expr`now`).toTranslate();
  });
  test('true', () => {
    expect(expr`true`).toTranslate();
  });
  test('false', () => {
    expect(expr`false`).toTranslate();
  });
  test('regex', () => {
    expect(expr`r'RegularExpression'`).toTranslate();
  });

  describe('quote comprehension inside strings', () => {
    test('\\b', () => {
      expect(parseString('\\b')).toEqual('\b');
    });
    test('\\f', () => {
      expect(parseString('\\f')).toEqual('\f');
    });
    test('\\n', () => {
      expect(parseString('\\n')).toEqual('\n');
    });
    test('\\r', () => {
      expect(parseString('\\r')).toEqual('\r');
    });
    test('\\t', () => {
      expect(parseString('\\t')).toEqual('\t');
    });
    test('unicode ?', () => {
      expect(parseString('\\u003f')).toEqual('?');
      expect(parseString('\\u003F')).toEqual('?');
    });
    test('normal stuff', () => {
      expect(parseString('normal stuff')).toEqual('normal stuff');
    });
    test('stuff & nonsense', () => {
      expect(parseString('stuff \\u0026 nonsense')).toEqual('stuff & nonsense');
    });
    test('one thing\\nnext thing', () => {
      expect(parseString('one thing\\nnext thing')).toEqual(
        'one thing\nnext thing'
      );
    });
    test('quote stripping works', () => {
      expect(parseString('|42|', '|')).toEqual('42');
    });
  });

  describe('string parsing in language', () => {
    const tz = 'America/Mexico_City';
    test('multi-line indent increasing', () => {
      const checking = new BetaExpression(`"""
          left
            mid
              right
        """`);
      expect(checking).toTranslate();
      const v = checking.generated().value[0];
      expect(v).toMatchObject({literal: '\nleft\n  mid\n    right\n'});
    });
    test('multi-line indent decreasing', () => {
      const checking = new BetaExpression(`"""
              right
            mid
          left
        """`);
      expect(checking).toTranslate();
      const v = checking.generated().value[0];
      expect(v).toMatchObject({literal: '\n    right\n  mid\nleft\n'});
    });
    test('multi-line indent keep', () => {
      const checking = new BetaExpression('"""right\n  mid\nleft"""');
      expect(checking).toTranslate();
      const v = checking.generated().value[0];
      expect(v).toMatchObject({literal: 'right\n  mid\nleft'});
    });
    test('timezone single quote', () => {
      const m = new TestTranslator(`run: a-> {timezone: '${tz}'; select: *}`);
      expect(m).toParse();
    });
    test('timezone double quote', () => {
      const m = new TestTranslator(`run: a-> {timezone: "${tz}"; select: *}`);
      expect(m).toParse();
    });
    test('timezone triple quote', () => {
      const m = new TestTranslator(
        `run: a->{timezone: """${tz}"""; select: *}`
      );
      expect(m).toParse();
    });
    test('timezone with illegal query', () => {
      expect(
        `run: a->{timezone: """${tz}%{ab->aturtle}"""; select: *}`
      ).translationToFailWith('%{ query } illegal in this string');
    });
    test('table single quote', () => {
      const m = new TestTranslator("source: n is bigquery.table('n')");
      expect(m).toParse();
    });
    test('table double quote', () => {
      const m = new TestTranslator('source: n is bigquery.table("n")');
      expect(m).toParse();
    });
    test('table triple quote', () => {
      const m = new TestTranslator('source: n is bigquery.table("""n""")');
      expect(m).toParse();
    });
    test('sql single quote', () => {
      const m = new TestTranslator("source: n is bigquery.sql('n')");
      expect(m).toParse();
    });
    test('sql double quote', () => {
      const m = new TestTranslator('source: n is bigquery.sql("n")');
      expect(m).toParse();
    });
    test('sql triple quote', () => {
      const m = new TestTranslator('source: n is bigquery.sql("""n""")');
      expect(m).toParse();
    });
    test('import single quote', () => {
      const m = new TestTranslator("import 'a'");
      expect(m).toParse();
    });
    test('import double quote', () => {
      const m = new TestTranslator('import "a"');
      expect(m).toParse();
    });
    test('import triple quote', () => {
      const m = new TestTranslator('import """a"""');
      expect(m).toParse();
    });
    test('literal single quote', () => {
      const x = new BetaExpression("'x'");
      expect(x).toParse();
    });
    test('literal double quote', () => {
      const x = new BetaExpression('"x"');
      expect(x).toParse();
    });
    test('literal triple quote', () => {
      const x = new BetaExpression('"""x"""');
      expect(x).toParse();
    });
  });
});
