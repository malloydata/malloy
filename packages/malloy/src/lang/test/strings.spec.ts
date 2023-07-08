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

import './parse-expects';
import {parseString} from '../parse-utils';
import {BetaExpression, TestTranslator} from './test-translator';

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
    const checking = new BetaExpression(`"""right
        mid
      left"""`);
    expect(checking).toTranslate();
    const v = checking.generated().value[0];
    expect(v).toMatchObject({literal: 'right\n        mid\n      left'});
  });
  test('timezone single quote', () => {
    const m = new TestTranslator(`run: a-> {timezone: '${tz}'; project: *}`);
    expect(m).toParse();
  });
  test('timezone double quote', () => {
    const m = new TestTranslator(`run: a-> {timezone: "${tz}"; project: *}`);
    expect(m).toParse();
  });
  test('timezone triple quote', () => {
    const m = new TestTranslator(`run: a->{timezone: """${tz}"""; project: *}`);
    expect(m).toParse();
  });
  test('timezone with illegal query', () => {
    expect(
      `run: a->{timezone: """${tz}%{ab->aturtle}%"""; project: *}`
    ).translationToFailWith('%{ query }% illegal in this string');
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
