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
import {GrammarTestItem} from './grammar_test_utils';

export const stringGrammarTestItems: GrammarTestItem[] = [
  {expression: 'FOO', describe: 'is FOO', type: 'match', output: 'FOO'},
  {
    expression: 'FOO,BAR',
    describe: 'is FOO or BAR',
    type: 'match',
    output: 'FOO,BAR',
  },
  {
    expression: '%FOO%',
    describe: 'contains FOO',
    type: 'contains',
    output: '%FOO%',
  },
  {
    expression: '%FOO%',
    describe: 'contains FOO',
    type: 'contains',
    output: '%FOO%',
  },
  {
    expression: '%100^%^_^^ FOO 100^%^_^^%',
    describe: 'contains 100%_^ FOO 100%_^',
    type: 'contains',
    output: '%100^%^_^^ FOO 100^%^_^^%',
  },
  {
    expression: 'FOO%',
    describe: 'starts with FOO',
    type: 'startsWith',
    output: 'FOO%',
  },
  {
    expression: '100^%^_^^ FOO%',
    describe: 'starts with 100%_^ FOO',
    type: 'startsWith',
    output: '100^%^_^^ FOO%',
  },
  {
    expression: '%FOO',
    describe: 'ends with FOO',
    type: 'endsWith',
    output: '%FOO',
  },
  {
    expression: '%FOO 100^%^_^^',
    describe: 'ends with FOO 100%_^',
    type: 'endsWith',
    output: '%FOO 100^%^_^^',
  },
  {
    expression: 'EMPTY',
    describe: 'is blank',
    type: 'blank',
    output: 'EMPTY',
  },
  {
    expression: 'empty',
    describe: 'is blank',
    type: 'blank',
    output: 'EMPTY',
  },
  {expression: 'NULL', describe: 'is null', type: 'null', output: 'NULL'},
  {expression: 'null', describe: 'is null', type: 'null', output: 'NULL'},
  {
    expression: '-FOO',
    describe: 'is not FOO',
    type: '!match',
    output: '-FOO',
  },
  {
    expression: '-FOO,-BAR',
    describe: 'is not FOO or BAR',
    type: '!match',
    output: '-FOO,-BAR',
  },
  {
    expression: '-%FOO%',
    describe: 'does not contain FOO',
    type: '!contains',
    output: '-%FOO%',
  },
  {
    expression: '-FOO%',
    describe: 'does not start with FOO',
    type: '!startsWith',
    output: '-FOO%',
  },
  {
    expression: '-%FOO',
    describe: 'does not end with FOO',
    type: '!endsWith',
    output: '-%FOO',
  },
  {
    expression: '-EMPTY',
    describe: 'is not blank',
    type: '!blank',
    output: '-EMPTY',
  },
  {
    expression: '-empty',
    describe: 'is not blank',
    type: '!blank',
    output: '-EMPTY',
  },
  {
    expression: '-null',
    describe: 'is not null',
    type: '!null',
    output: '-NULL',
  },
  {
    expression: 'FOO%,BAR',
    describe: 'starts with FOO or is BAR',
    type: 'startsWith',
    output: 'FOO%,BAR',
  },
  {
    expression: 'FOO%,-FOOD',
    describe: 'starts with FOO, and is not FOOD',
    type: 'startsWith',
    output: 'FOO%,-FOOD',
  },
  {
    expression: 'F%OD',
    describe: 'F%OD',
    type: 'other',
    output: 'F%OD',
  },
  {
    expression: '_UF',
    describe: '_UF',
    type: 'other',
    output: '_UF',
  },
  // We should keep leading and trailing spaces
  {
    expression: '  hello  ',
    describe: 'is   hello  ',
    type: 'match',
    output: '^ ^ hello^ ^ ^ ',
  },
  {
    expression: '',
    describe: 'is any value',
    type: 'match',
    output: '',
  },
  /// Special CASES that should be typed as MATCH
  // Unquoted string containing the '-' character
  {
    expression: 't-shirt',
    describe: 'is t-shirt',
    type: 'match',
    output: 't-shirt',
  },
  // Quoted string containing the '-' character
  {
    expression: '"t-shirt \\"new\\" style"',
    describe: 'is "t-shirt "new" style"',
    type: 'match',
    output: '"t-shirt \\"new\\" style"',
  },
  // Quoted string containing the '%' character
  {
    expression:
      '"100% Silk Camisole \\"Angelina Jolie\'s Favorite\\" By Mary Green"',
    describe:
      'is "100% Silk Camisole "Angelina Jolie\'s Favorite" By Mary Green"',
    type: 'match',
    output:
      '"100% Silk Camisole \\"Angelina Jolie\'s Favorite\\" By Mary Green"',
  },
  // Quoted string containing the ',' character
  {
    expression: '"\\"DANCE\\" Tube Socks,T1418,multi-co..."',
    describe: 'is ""DANCE" Tube Socks,T1418,multi-co..."',
    type: 'match',
    output: '"\\"DANCE\\" Tube Socks,T1418,multi-co..."',
  },
  // Quoted string containing the '^' character
  {
    expression: '"Intentional^caret"',
    describe: 'is Intentional^caret',
    type: 'match',
    output: '"Intentional^caret"',
  },
  {
    expression: 'sub^_region',
    describe: 'is sub_region',
    type: 'match',
    output: '"sub_region"',
  },
  {
    expression: '"quoted_underscore"',
    describe: 'is quoted_underscore',
    type: 'match',
    output: '"quoted_underscore"',
  },
  {
    expression: 'hello^ ^ ',
    describe: 'is hello ',
    type: 'match',
    output: 'hello^ ^ ',
  },
  {
    expression: '^ whitespace^ ^ ',
    describe: 'is  whitespace ',
    type: 'match',
    output: '^ whitespace^ ^ ',
  },
  {
    expression: '%^ whitespace^ %',
    describe: 'contains whitespace',
    type: 'contains',
    output: '%whitespace%',
  },
];
