/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import * as nearley from 'nearley';
import fstring_grammar from './lib/fexpr_string_parser';
import {StringClause} from './clause_types';
import {StringFilterExpression} from './string_filter_expression';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      parsesTo(expected: StringClause, unparse?: string): R;
    }
  }
}
expect.extend({
  parsesTo(src: string, expectedParse: StringClause, expectedUnparse?: string) {
    // We don't call StringFilter.parse because we want to fail here
    // with an ambiguous grammar
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
    expect('A').parsesTo({operator: '=', values: ['A']});
  });
  test('leading space ignore', () => {
    expect(' A').parsesTo({operator: '=', values: ['A']}, 'A');
  });
  test('trailing space ignored', () => {
    expect('A ').parsesTo({operator: '=', values: ['A']}, 'A');
  });
  test('not match', () => {
    expect('-A').parsesTo({operator: '=', values: ['A'], not: true});
  });
  test('not space match', () => {
    expect('- A').parsesTo({operator: '=', values: ['A'], not: true}, '-A');
  });
  test('space not match', () => {
    expect(' -A').parsesTo({operator: '=', values: ['A'], not: true}, '-A');
  });
  test('like %', () => {
    expect('%').parsesTo({operator: '~', escaped_values: ['%']});
  });
  test('like _', () => {
    expect('_').parsesTo({operator: '~', escaped_values: ['_']});
  });
  test('like a%z', () => {
    expect('a%z').parsesTo({operator: '~', escaped_values: ['a%z']});
  });
  test('starts with %', () => {
    expect('\\%%').parsesTo({operator: 'starts', values: ['%']});
  });
  test('end with _', () => {
    expect('%\\_').parsesTo({operator: 'ends', values: ['_']});
  });
  test('contains _X_', () => {
    expect('%\\_X\\_%').parsesTo({operator: 'contains', values: ['_X_']});
  });
  test('not starts with foo', () => {
    expect('-foo%').parsesTo({operator: 'starts', values: ['foo'], not: true});
  });
  test('a_% is not a starts with', () => {
    expect('a_%').parsesTo({operator: '~', escaped_values: ['a_%']});
  });
  test('not ends with bar', () => {
    expect('-%bar').parsesTo({operator: 'ends', values: ['bar'], not: true});
  });
  test('not contains sugar', () => {
    expect('-%sugar%').parsesTo({
      operator: 'contains',
      values: ['sugar'],
      not: true,
    });
  });
  test('is %', () => {
    expect('\\%').parsesTo({operator: '=', values: ['%']});
  });
  test('is _', () => {
    expect('\\_').parsesTo({operator: '=', values: ['_']});
  });
  test('like a_', () => {
    expect('a_').parsesTo({operator: '~', escaped_values: ['a_']});
  });
  test('escape-space a', () => {
    expect('\\ a').parsesTo({operator: '=', values: [' a']});
  });
  test('a escape-space', () => {
    expect('a\\ ').parsesTo({operator: '=', values: ['a ']});
  });
  test('backslash space', () => {
    expect('\\ ').parsesTo({operator: '=', values: [' ']});
  });
  test(' spacey null ', () => {
    expect(' null ').parsesTo({operator: 'null'}, 'null');
  });
  test('is null', () => {
    expect('null').parsesTo({operator: 'null'});
    expect('NULL').parsesTo({operator: 'null'}, 'null');
  });
  test('is not null', () => {
    expect('-null').parsesTo({operator: 'null', not: true});
  });
  test('= null', () => {
    expect('\\null').parsesTo({operator: '=', values: ['null']});
  });
  test('= empty', () => {
    expect('\\empty').parsesTo({operator: '=', values: ['empty']});
  });
  test('is empty', () => {
    expect('empty').parsesTo({operator: 'empty'});
    expect('EMPTY').parsesTo({operator: 'empty'}, 'empty');
  });
  test('is not empty', () => {
    expect('-empty').parsesTo({operator: 'empty', not: true});
  });
  test('nulldata', () => {
    expect('nulldata').parsesTo({operator: '=', values: ['nulldata']});
  });
  test('emptystr', () => {
    expect('emptystr').parsesTo({operator: '=', values: ['emptystr']});
  });
  test('a%b,c', () => {
    expect('a%b,c').parsesTo(
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
    expect(src).parsesTo({operator: 'starts', values: ['a' + backslash]});
  });
  test('a;b', () => {
    expect('a; b').parsesTo({
      operator: 'and',
      members: [
        {operator: '=', values: ['a']},
        {operator: '=', values: ['b']},
      ],
    });
  });
  test('a|b', () => {
    expect('a | b').parsesTo({
      operator: 'or',
      members: [
        {operator: '=', values: ['a']},
        {operator: '=', values: ['b']},
      ],
    });
  });
  test('(a)', () => {
    expect('(a)').parsesTo({
      operator: '()',
      expr: {operator: '=', values: ['a']},
    });
  });
  test('-(z)', () => {
    expect('-(z)').parsesTo({
      operator: '()',
      expr: {operator: '=', values: ['z']},
      not: true,
    });
  });
  test('- space (z)', () => {
    expect('- (z)').parsesTo(
      {
        operator: '()',
        expr: {operator: '=', values: ['z']},
        not: true,
      },
      '-(z)'
    );
  });
  test('cmatch escapes ,', () => {
    expect('a\\,b').parsesTo({
      operator: '=',
      values: ['a,b'],
    });
  });
  test('match escaped ;', () => {
    expect('a\\;b').parsesTo({
      operator: '=',
      values: ['a;b'],
    });
  });
  test('match escaped |', () => {
    expect('a\\|b').parsesTo({
      operator: '=',
      values: ['a|b'],
    });
  });
  test('match escaped -', () => {
    expect('\\-a').parsesTo({operator: '=', values: ['-a']});
  });
  test('a,-null', () => {
    expect('a, -null').parsesTo({
      operator: ',',
      members: [
        {operator: '=', values: ['a']},
        {operator: 'null', not: true},
      ],
    });
  });
  test('-a,null', () => {
    expect('-a, null').parsesTo({
      operator: ',',
      members: [{operator: '=', values: ['a'], not: true}, {operator: 'null'}],
    });
  });
  test('complex filter', () => {
    expect('(a, (b; c) | -empty, null); -null').parsesTo({
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
    expect('a, b, c').parsesTo({
      operator: '=',
      values: ['a', 'b', 'c'],
    });
  });
  test('multiple starts into one clause', () => {
    expect('a%,b%,c%').parsesTo(
      {operator: 'starts', values: ['a', 'b', 'c']},
      'a%, b%, c%'
    );
  });
  test('multiple ends into one clause', () => {
    expect('%a,%b,%c').parsesTo(
      {operator: 'ends', values: ['a', 'b', 'c']},
      '%a, %b, %c'
    );
  });
  test('multiple contains into one clause', () => {
    expect('%a%,%b%,%c%').parsesTo(
      {operator: 'contains', values: ['a', 'b', 'c']},
      '%a%, %b%, %c%'
    );
  });
  test('multiple likes into one clause', () => {
    expect('a%a,b%b,c%c').parsesTo(
      {
        operator: '~',
        escaped_values: ['a%a', 'b%b', 'c%c'],
      },
      'a%a, b%b, c%c'
    );
  });
  test('multiple not = -a,-b', () => {
    expect('-a, -b').parsesTo({operator: '=', not: true, values: ['a', 'b']});
  });
  test('multiple not starts -a%,-b%', () => {
    expect('-a%, -b%').parsesTo({
      operator: 'starts',
      not: true,
      values: ['a', 'b'],
    });
  });
  test('multiple not like -a%a,-b%b', () => {
    expect('-a%a, -b%b').parsesTo({
      operator: '~',
      not: true,
      escaped_values: ['a%a', 'b%b'],
    });
  });
  test.todo(
    'write many malformed expressions and generate reasonable errors for them'
  );
});
