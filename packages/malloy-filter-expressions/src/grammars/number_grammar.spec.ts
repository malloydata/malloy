/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import {FilterModel} from '../types';
import {convertTypeToOption, parseFilterExpression, treeToList} from '../utils';
import {GrammarTestItem} from './grammar_test_utils';
import {numberExpressionTestItems} from './number_grammar_test_expressions';
const testNumericItem = (testItem: GrammarTestItem) => {
  test(testItem['expression'], () => {
    const {expression, type} = testItem;
    const ast = parseFilterExpression('number', expression);
    expect(ast).toMatchSnapshot();
    const list = treeToList(ast);
    const item = list[0];
    let itemType = item.type;
    if (type !== 'matchesAdvanced') {
      itemType = convertTypeToOption(item);
    }
    expect(itemType).toEqual(type);
  });
};

describe('Number grammar can parse', () => {
  numberExpressionTestItems.forEach(testNumericItem);
});

// these tests should fail
const fail = ['(,)', 'AND', 'OR', '[inf,10]'];

describe("Number grammar can't parse", () => {
  it.each(fail)('%s', expression => {
    const ast = parseFilterExpression('number', expression);
    expect(ast).toMatchSnapshot();
    expect(ast.type).toBe('matchesAdvanced');
    expect(ast['expression']).toEqual(expression);
  });
});

const numeric = [
  ['1', '=', '1'],
  ['1, 2, 3', '=', '1,2,3'],
  ['3.14159', '=', '3.14159'],
  ['123456789', '=', '123456789'],
  // Should support big integers
  ['12345678901234567890', '=', '12345678901234567890'],
  ['0.01', '=', '0.01'],
  ['.01', '=', /* ".01" */ '0.01'],
  ['-.01', '=', /* "-.01" */ '-0.01'],
  ['-0.01', '=', '-0.01'],
  ['1, -1, 0.1', '=', '1,-1,0.1'],

  ['not 1', '!=', '1'],
  ['not 1, 2, 3', '!=', '1,2,3'],
  ['<> 1', '!=', '1'],
  ['!= 1, 2, 3', '!=', '1,2,3'],
  ['not -1.2', '!=', '-1.2'],
  ['not -.2', '!=', /* "-.2" */ '-0.2'],

  ['> 1.1', '>', '1.1'],
  ['>0.1', '>', '0.1'],
  ['>999', '>', '999'],
  ['> -42', '>', '-42'],
  ['>-242', '>', '-242'],
  ['>    0', '>', '0'],

  ['< 1.1', '<', '1.1'],
  ['<3', '<', '3'],
  ['<0.1', '<', '0.1'],
  ['<999', '<', '999'],
  ['< -42', '<', '-42'],
  ['<-242', '<', '-242'],
  ['<    0', '<', '0'],

  ['<= 1.1', '<=', '1.1'],
  ['<=0.1', '<=', '0.1'],
  ['<=999', '<=', '999'],
  ['<= -42', '<=', '-42'],
  ['<=-242', '<=', '-242'],
  ['<=    0', '<=', '0'],

  ['>= 1.1', '>=', '1.1'],
  ['>=0.1', '>=', '0.1'],
  ['>=999', '>=', '999'],
  ['>= -42', '>=', '-42'],
  ['>=-242', '>=', '-242'],
  ['>=    0', '>=', '0'],
];

const testNumeric = (
  expression: string,
  type: string,
  textInput: string | undefined
) => {
  const ast = parseFilterExpression('number', expression);
  expect(ast).toMatchSnapshot();
  const list = treeToList(ast);
  const item = list[0];
  let itemType = item.type;
  if (type !== 'matchesAdvanced') {
    itemType = convertTypeToOption(item);
  }
  expect(itemType).toEqual(type);
  if (type !== 'matchesAdvanced' && type !== 'between') {
    expect(textInput).toBe(
      item['value'] ? item['value'].join(',') : item['value']
    );
  }
};

describe('Additional number tests', () => {
  it.each(numeric)('%s', testNumeric);
});

const nullValues = [
  ['NULL', 'null'],
  ['NOT NULL', '!null'],
  ['null', 'null'],
  ['not null', '!null'],
  ['nUll', 'null'],
  ['Not Null', '!null'],
];

const testNull = (expression: string, type: string) => {
  try {
    const ast = parseFilterExpression('number', expression);
    expect(ast).toMatchSnapshot();
    const itemType = convertTypeToOption(ast as FilterModel);
    expect(itemType).toEqual(type);
    expect(ast['value']).toBeUndefined();
  } catch (error) {
    expect(error).toBeNull();
  }
};

describe('nullValues number tests', () => {
  it.each(nullValues)('%s', testNull);
});

const between: GrammarTestItem[] = [
  {expression: '1 to 5', type: 'between', low: '1', high: '5', bounds: '[]'},
  {
    expression: '-1.0 to .75',
    type: 'between',
    low: '-1.0',
    high: '.75',
    bounds: '[]',
  },

  {
    expression: '>7 AND <80.44',
    type: 'between',
    low: '7',
    high: '80.44',
    bounds: '()',
  },
  {
    expression: '>= 7 AND <80.44',
    type: 'between',
    low: '7',
    high: '80.44',
    bounds: '[)',
  },
  {
    expression: '<=80.44  AND    >.1',
    type: 'between',
    low: '0.1',
    high: '80.44',
    bounds: '(]',
  },

  {expression: '[2, 4]', type: 'between', low: '2', high: '4', bounds: '[]'},
  {
    expression: '[0.1,   -4)',
    type: 'between',
    low: '0.1',
    high: '-4',
    bounds: '[)',
  },
  {
    expression: '(0.1,   -4]',
    type: 'between',
    low: '0.1',
    high: '-4',
    bounds: '(]',
  },
  {
    expression: '(0.1, .11111)',
    type: 'between',
    low: '0.1',
    high: '0.11111',
    bounds: '()',
  },

  {
    expression: 'NOT 1 to 5',
    type: '!between',
    low: '1',
    high: '5',
    bounds: '[]',
  },
  {
    expression: 'NOT -1.0 to .75',
    type: '!between',
    low: '-1.0',
    high: '.75',
    bounds: '[]',
  },
  {
    expression: 'not 3 to 80.44',
    type: '!between',
    low: '3',
    high: '80.44',
    bounds: '[]',
  },

  {
    expression: '<7 OR >80.44',
    type: '!between',
    low: '7',
    high: '80.44',
    bounds: '()',
  },
  {
    expression: '<= 7 OR >80.44',
    type: '!between',
    low: '7',
    high: '80.44',
    bounds: '[)',
  },
  {
    expression: '>=80.44  OR    <.1',
    type: '!between',
    low: '0.1',
    high: '80.44',
    bounds: '(]',
  },

  {
    expression: 'NOT[2, 4]',
    type: '!between',
    low: '2',
    high: '4',
    bounds: '[]',
  },
  {
    expression: 'NOT [0.1,   -4)',
    type: '!between',
    low: '0.1',
    high: '-4',
    bounds: '[)',
  },
  {
    expression: 'NOT  (0.1,   -4]',
    type: '!between',
    low: '0.1',
    high: '-4',
    bounds: '(]',
  },
  {
    expression: 'NOT(0.1, .11111)',
    type: '!between',
    low: '0.1',
    high: '0.11111',
    bounds: '()',
  },
];

describe('between tests', () => {
  between.forEach((testItem: GrammarTestItem) => {
    it(testItem['expression'], () => {
      const {expression, type, low, high, bounds} = testItem;
      const ast = parseFilterExpression('number', expression);
      expect(ast).toMatchSnapshot();
      const itemType = convertTypeToOption(ast as FilterModel);
      expect(type).toEqual(itemType);
      expect(String(ast['low'])).toEqual(low);
      expect(String(ast['high'])).toEqual(high);
      expect(ast['bounds']).toEqual(bounds);
    });
  });
});

// prettier-ignore
const nowSupported = [
  // the following previously had no deserializer,
  // but are now supported
  ['1 to',                   '>=',     '1'],
  ['to -1',                  '<=',     '-1'],
  ['to 0.1',                 '<=',     '0.1'],
  ['not 1, not 2',           '!=',     '1,2'],
  ['<> 1, <> 2',             '!=',     '1,2'],
  ['!= 1, != 2',             '!=',     '1,2'],
  ['1, not 2',               '!=',     '1,2'],
  ['>1 AND <2 OR >3 AND <4', 'between',      '>1 AND <2 OR >3 AND <4'],
]

describe('nowSupported expressions', () => {
  it.each(nowSupported)('%s', testNumeric);
});

// prettier-ignore
const unsupported = [
  ['0.1.1.1',                'matchesAdvanced',     '0.1.1.1'],
  ['0.....1',                'matchesAdvanced',     '0.....1'],
  ['--1',                    'matchesAdvanced',     '--1'],
  ['foo',                    'matchesAdvanced',     'foo'],
  ['seventeen',              'matchesAdvanced',     'seventeen'],
  ['&,,,$%testContext.#,,,$,testContext.',         'matchesAdvanced',     '&,,,$%testContext.#,,,$,testContext.'],
  ['\\\\\\\\\\\\\\',         'matchesAdvanced',     '\\\\\\\\\\\\\\'],
  ['~`!testContext.#$%^*()-+=_{}[]|?',  'matchesAdvanced',     '~`!testContext.#$%^*()-+=_{}[]|?'],
  ['<>,. ¡™£¢∞§¶•ªº–≠œ∑',    'matchesAdvanced',     '<>,. ¡™£¢∞§¶•ªº–≠œ∑'],
  ['´®†¥¨ˆøπ“‘åß∂ƒ©˙∆˚¬…æ',  'matchesAdvanced',     '´®†¥¨ˆøπ“‘åß∂ƒ©˙∆˚¬…æ'],
  ['Ω≈ç√∫˜µ≤≥÷',             'matchesAdvanced',     'Ω≈ç√∫˜µ≤≥÷'],
  ['😻🌚',                   'matchesAdvanced',     '😻🌚'],
  ['^12345',                 'matchesAdvanced',     '^12345'],
  ['1234^, 567', 'matchesAdvanced', '1234^, 567'],

]

describe('unsuppored expressions', () => {
  it.each(unsupported)('%s', testNumeric);
});
