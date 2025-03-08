/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import * as nearley from 'nearley';
import fstring_grammar from './lib/fexpr_string_parser';
import {StringClause, NumberClause} from './clause_types';
import {StringFilterExpression} from './string_filter_expression';
import fnumber_grammar from './lib/fexpr_number_parser';
import {NumberFilterExpression} from './number_filter_expression';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isStringFilter(expected: StringClause, unparse?: string): R;
      isNumberFilter(expected: NumberClause, unparse?: string): R;
    }
  }
}

expect.extend({
  isStringFilter(
    src: string,
    expectedParse: StringClause,
    expectedUnparse?: string
  ) {
    const fstring_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(fstring_grammar)
    );
    fstring_parser.feed(src);
    const results = fstring_parser.finish();
    if (results.length > 1) {
      return {
        pass: false,
        message: () => 'Ambiguous parse, grammar error',
      };
    }
    if (this.equals(expectedParse, results[0])) {
      const unparse = StringFilterExpression.unparse(results[0]);
      if (unparse === (expectedUnparse ?? src)) {
        return {
          pass: true,
          message: () => `${src} parsed and serialized correctly`,
        };
      }
      const serialize_error = diff(src, unparse, {contextLines: 10});
      return {
        pass: false,
        message: () =>
          `Unparse Error: '${src}' parsed correctly, but unparsed as '${unparse}'\n${serialize_error}`,
      };
    }
    const errTest = diff(
      {parse: expectedParse},
      {parse: results[0]},
      {expand: true}
    );
    return {
      pass: false,
      message: () => `${src} did not compile correctly\n${errTest}`,
    };
  },
  isNumberFilter(
    src: string,
    expectedParse: NumberClause,
    expectedUnparse?: string
  ) {
    const fnumber_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(fnumber_grammar)
    );
    fnumber_parser.feed(src);
    const results = fnumber_parser.finish();
    if (results.length > 1) {
      return {
        pass: false,
        message: () => 'Ambiguous parse, grammar error',
      };
    }
    if (this.equals(expectedParse, results[0])) {
      const unparse = NumberFilterExpression.unparse(results[0]);
      if (unparse === (expectedUnparse ?? src)) {
        return {
          pass: true,
          message: () => `${src} parsed and serialized correctly`,
        };
      }
      const serialize_error = diff(src, unparse);
      return {
        pass: false,
        message: () =>
          `Unparse Error: '${src}' parsed correctly, but unparsed as '${unparse}'\n${serialize_error}`,
      };
    }
    const errTest = diff(
      {parse: expectedParse},
      {parse: results[0]},
      {expand: true}
    );
    return {
      pass: false,
      message: () => `${src} did not compile correctly\n${errTest}`,
    };
  },
});

describe('string filter expressions', () => {
  test('matching', () => {
    expect('A').isStringFilter({operator: '=', values: ['A']});
  });
  test('leading space ignore', () => {
    expect(' A').isStringFilter({operator: '=', values: ['A']}, 'A');
  });
  test('trailing space ignored', () => {
    expect('A ').isStringFilter({operator: '=', values: ['A']}, 'A');
  });
  test('not match', () => {
    expect('-A').isStringFilter({operator: '=', values: ['A'], not: true});
  });
  test('not space match', () => {
    expect('- A').isStringFilter(
      {operator: '=', values: ['A'], not: true},
      '-A'
    );
  });
  test('space not match', () => {
    expect(' -A').isStringFilter(
      {operator: '=', values: ['A'], not: true},
      '-A'
    );
  });
  test('like %', () => {
    expect('%').isStringFilter({operator: '~', escaped_values: ['%']});
  });
  test('like _', () => {
    expect('_').isStringFilter({operator: '~', escaped_values: ['_']});
  });
  test('like a%z', () => {
    expect('a%z').isStringFilter({operator: '~', escaped_values: ['a%z']});
  });
  test('starts with %', () => {
    expect('\\%%').isStringFilter({operator: 'starts', values: ['%']});
  });
  test('end with _', () => {
    expect('%\\_').isStringFilter({operator: 'ends', values: ['_']});
  });
  test('contains _X_', () => {
    expect('%\\_X\\_%').isStringFilter({operator: 'contains', values: ['_X_']});
  });
  test('not starts with foo', () => {
    expect('-foo%').isStringFilter({
      operator: 'starts',
      values: ['foo'],
      not: true,
    });
  });
  test('a_% is not a starts with', () => {
    expect('a_%').isStringFilter({operator: '~', escaped_values: ['a_%']});
  });
  test('not ends with bar', () => {
    expect('-%bar').isStringFilter({
      operator: 'ends',
      values: ['bar'],
      not: true,
    });
  });
  test('not contains sugar', () => {
    expect('-%sugar%').isStringFilter({
      operator: 'contains',
      values: ['sugar'],
      not: true,
    });
  });
  test('is %', () => {
    expect('\\%').isStringFilter({operator: '=', values: ['%']});
  });
  test('is _', () => {
    expect('\\_').isStringFilter({operator: '=', values: ['_']});
  });
  test('like a_', () => {
    expect('a_').isStringFilter({operator: '~', escaped_values: ['a_']});
  });
  test('escape-space a', () => {
    expect('\\ a').isStringFilter({operator: '=', values: [' a']});
  });
  test('a escape-space', () => {
    expect('a\\ ').isStringFilter({operator: '=', values: ['a ']});
  });
  test('backslash space', () => {
    expect('\\ ').isStringFilter({operator: '=', values: [' ']});
  });
  test(' spacey null ', () => {
    expect(' null ').isStringFilter({operator: 'null'}, 'null');
  });
  test('is null', () => {
    expect('null').isStringFilter({operator: 'null'});
    expect('NULL').isStringFilter({operator: 'null'}, 'null');
  });
  test('is not null', () => {
    expect('-null').isStringFilter({operator: 'null', not: true});
  });
  test('= null', () => {
    expect('\\null').isStringFilter({operator: '=', values: ['null']});
  });
  test('= empty', () => {
    expect('\\empty').isStringFilter({operator: '=', values: ['empty']});
  });
  test('is empty', () => {
    expect('empty').isStringFilter({operator: 'empty'});
    expect('EMPTY').isStringFilter({operator: 'empty'}, 'empty');
  });
  test('is not empty', () => {
    expect('-empty').isStringFilter({operator: 'empty', not: true});
  });
  test('nulldata', () => {
    expect('nulldata').isStringFilter({operator: '=', values: ['nulldata']});
  });
  test('emptystr', () => {
    expect('emptystr').isStringFilter({operator: '=', values: ['emptystr']});
  });
  test('a%b,c', () => {
    expect('a%b,c').isStringFilter(
      {
        operator: ',',
        members: [
          {operator: '~', escaped_values: ['a%b']},
          {operator: '=', values: ['c']},
        ],
      },
      'a%b, c'
    );
  });
  test('a\\% starts with a-backslash', () => {
    const backslash = '\\';
    const src = 'a' + backslash + backslash + '%';
    expect(src).isStringFilter({operator: 'starts', values: ['a' + backslash]});
  });
  test('a;b', () => {
    expect('a; b').isStringFilter({
      operator: 'and',
      members: [
        {operator: '=', values: ['a']},
        {operator: '=', values: ['b']},
      ],
    });
  });
  test('a|b', () => {
    expect('a | b').isStringFilter({
      operator: 'or',
      members: [
        {operator: '=', values: ['a']},
        {operator: '=', values: ['b']},
      ],
    });
  });
  test('(a)', () => {
    expect('(a)').isStringFilter({
      operator: '()',
      expr: {operator: '=', values: ['a']},
    });
  });
  test('-(z)', () => {
    expect('-(z)').isStringFilter({
      operator: '()',
      expr: {operator: '=', values: ['z']},
      not: true,
    });
  });
  test('- space (z)', () => {
    expect('- (z)').isStringFilter(
      {
        operator: '()',
        expr: {operator: '=', values: ['z']},
        not: true,
      },
      '-(z)'
    );
  });
  test('cmatch escapes ,', () => {
    expect('a\\,b').isStringFilter({
      operator: '=',
      values: ['a,b'],
    });
  });
  test('match escaped ;', () => {
    expect('a\\;b').isStringFilter({
      operator: '=',
      values: ['a;b'],
    });
  });
  test('match escaped |', () => {
    expect('a\\|b').isStringFilter({
      operator: '=',
      values: ['a|b'],
    });
  });
  test('match escaped -', () => {
    expect('\\-a').isStringFilter({operator: '=', values: ['-a']});
  });
  test('a,-null', () => {
    expect('a, -null').isStringFilter({
      operator: ',',
      members: [
        {operator: '=', values: ['a']},
        {operator: 'null', not: true},
      ],
    });
  });
  test('-a,null', () => {
    expect('-a, null').isStringFilter({
      operator: ',',
      members: [{operator: '=', values: ['a'], not: true}, {operator: 'null'}],
    });
  });
  test('complex filter', () => {
    expect('(a, (b; c) | -empty, null); -null').isStringFilter({
      operator: 'and',
      members: [
        {
          operator: '()',
          expr: {
            operator: ',',
            members: [
              {
                operator: 'or',
                members: [
                  {
                    operator: ',',
                    members: [
                      {operator: '=', values: ['a']},
                      {
                        operator: '()',
                        expr: {
                          operator: 'and',
                          members: [
                            {operator: '=', values: ['b']},
                            {operator: '=', values: ['c']},
                          ],
                        },
                      },
                    ],
                  },
                  {operator: 'empty', not: true},
                ],
              },
              {operator: 'null'},
            ],
          },
        },
        {operator: 'null', not: true},
      ],
    });
  });
  test('multiple = into one clause', () => {
    expect('a, b, c').isStringFilter({
      operator: '=',
      values: ['a', 'b', 'c'],
    });
  });
  test('multiple starts into one clause', () => {
    expect('a%,b%,c%').isStringFilter(
      {operator: 'starts', values: ['a', 'b', 'c']},
      'a%, b%, c%'
    );
  });
  test('multiple ends into one clause', () => {
    expect('%a,%b,%c').isStringFilter(
      {operator: 'ends', values: ['a', 'b', 'c']},
      '%a, %b, %c'
    );
  });
  test('multiple contains into one clause', () => {
    expect('%a%,%b%,%c%').isStringFilter(
      {operator: 'contains', values: ['a', 'b', 'c']},
      '%a%, %b%, %c%'
    );
  });
  test('multiple likes into one clause', () => {
    expect('a%a,b%b,c%c').isStringFilter(
      {
        operator: '~',
        escaped_values: ['a%a', 'b%b', 'c%c'],
      },
      'a%a, b%b, c%c'
    );
  });
  test('multiple not = -a,-b', () => {
    expect('-a, -b').isStringFilter({
      operator: '=',
      not: true,
      values: ['a', 'b'],
    });
  });
  test('multiple not starts -a%,-b%', () => {
    expect('-a%, -b%').isStringFilter({
      operator: 'starts',
      not: true,
      values: ['a', 'b'],
    });
  });
  test('multiple not like -a%a,-b%b', () => {
    expect('-a%a, -b%b').isStringFilter({
      operator: '~',
      not: true,
      escaped_values: ['a%a', 'b%b'],
    });
  });
  test('multiple ands a;b;c', () => {
    expect('a%; %b%; %c').isStringFilter({
      operator: 'and',
      members: [
        {operator: 'starts', values: ['a']},
        {operator: 'contains', values: ['b']},
        {operator: 'ends', values: ['c']},
      ],
    });
  });
  test.todo(
    'write many malformed expressions and generate reasonable errors for them'
  );
});

describe('number filter expressions', () => {
  test('null', () => {
    expect('null').isNumberFilter({operator: 'null'});
  });
  test('not null', () => {
    expect('not null').isNumberFilter({operator: 'null', not: true});
  });
  test('N', () => {
    expect('5').isNumberFilter({operator: '=', values: ['5']});
  });
  test('-N', () => {
    expect('-5').isNumberFilter({operator: '=', values: ['-5']});
  });
  test('N.N', () => {
    expect('4.2').isNumberFilter({operator: '=', values: ['4.2']});
  });
  test('-N.NE+N', () => {
    expect('-4.2E+3').isNumberFilter({operator: '=', values: ['-4.2E+3']});
  });
  test('NEN', () => {
    expect('4E-2').isNumberFilter({operator: '=', values: ['4E-2']});
  });
  test('= N', () => {
    expect('= 42').isNumberFilter({operator: '=', values: ['42']}, '42');
  });
  test('!= N', () => {
    expect('!= 42').isNumberFilter({operator: '!=', values: ['42']});
  });
  test('< N', () => {
    expect('< 42').isNumberFilter({operator: '<', values: ['42']});
  });
  test('> N', () => {
    expect('> 42').isNumberFilter({operator: '>', values: ['42']});
  });
  test('<= N', () => {
    expect('<= 42').isNumberFilter({operator: '<=', values: ['42']});
  });
  test('>= N', () => {
    expect('>= 42').isNumberFilter({operator: '>=', values: ['42']});
  });
  test('(1 to 2)', () => {
    expect('(1 to 2)').isNumberFilter({
      operator: 'range',
      startOperator: '>',
      startValue: '1',
      endOperator: '<',
      endValue: '2',
    });
  });
  test('(1 to 2]', () => {
    expect('(1 to 2]').isNumberFilter({
      operator: 'range',
      startOperator: '>',
      startValue: '1',
      endOperator: '<=',
      endValue: '2',
    });
  });
  test('[1 to 2]', () => {
    expect('[1 to 2]').isNumberFilter({
      operator: 'range',
      startOperator: '>=',
      startValue: '1',
      endOperator: '<=',
      endValue: '2',
    });
  });
  test('[1 to 2)', () => {
    expect('[1 to 2)').isNumberFilter({
      operator: 'range',
      startOperator: '>=',
      startValue: '1',
      endOperator: '<',
      endValue: '2',
    });
  });
  test('1, 2', () => {
    expect('1, 2').isNumberFilter({operator: '=', values: ['1', '2']});
  });
  test('1,2,3', () => {
    expect('1, 2, 3').isNumberFilter({operator: '=', values: ['1', '2', '3']});
  });
  test('1 or 2', () => {
    expect('1 or 2').isNumberFilter(
      {operator: '=', values: ['1', '2']},
      '1, 2'
    );
  });
  test('1 and 2', () => {
    expect('1 and 2').isNumberFilter({
      operator: 'and',
      members: [
        {operator: '=', values: ['1']},
        {operator: '=', values: ['2']},
      ],
    });
  });
  test('1 and 2 and 3', () => {
    expect('1 and 2 and 3').isNumberFilter({
      operator: 'and',
      members: [
        {operator: '=', values: ['1']},
        {operator: '=', values: ['2']},
        {operator: '=', values: ['3']},
      ],
    });
  });
  test('1,!=2', () => {
    expect('1, != 2').isNumberFilter({
      operator: ',',
      members: [
        {operator: '=', values: ['1']},
        {operator: '!=', values: ['2']},
      ],
    });
  });
  test('just (1)', () => {
    expect('(1)').isNumberFilter({
      operator: '()',
      expr: {operator: '=', values: ['1']},
    });
  });
  test('not (1)', () => {
    expect('not (1)').isNumberFilter({
      operator: '()',
      not: true,
      expr: {operator: '=', values: ['1']},
    });
  });
  test.todo('all the ways that not can be applied');
});
