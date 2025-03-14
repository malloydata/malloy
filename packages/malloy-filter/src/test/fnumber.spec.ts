/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import * as nearley from 'nearley';
import type {NumberClause} from '../filter_clause';
import fnumber_grammar from '../lib/fexpr_number_parser';
import {NumberFilterExpression} from '../number_filter_expression';
import {inspect} from 'util';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isNumberFilter(expected: NumberClause, unparse?: string): R;
    }
  }
}

expect.extend({
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
    const want = this.utils.printExpected(
      `Expected: ${inspect(expectedParse, {breakLength: 80, depth: Infinity})}`
    );
    const rcv = this.utils.printReceived(
      `Received: ${inspect(results[0], {breakLength: 80, depth: Infinity})}`
    );
    return {
      pass: false,
      message: () => `${src} did not compile correctly\n${want}\n${rcv}`,
    };
  },
});

describe('number filter expressions', () => {
  test('null', () => {
    expect('null').isNumberFilter({operator: 'null'});
  });
  test('not null', () => {
    expect('not null').isNumberFilter({operator: 'null', not: true});
  });
  test('just N', () => {
    expect('5').isNumberFilter({operator: '=', values: ['5']});
  });
  test('not N', () => {
    expect('not 5').isNumberFilter({operator: '!=', values: ['5']}, '!= 5');
  });
  test('-N', () => {
    expect('-5').isNumberFilter({operator: '=', values: ['-5']});
  });
  test('!= 5,6', () => {
    expect('!= 5, 6').isNumberFilter({operator: '!=', values: ['5', '6']});
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
  test('not >= Z', () => {
    expect('not >= 42').isNumberFilter({
      operator: '>=',
      values: ['42'],
      not: true,
    });
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
  test('not [range]', () => {
    expect('not [1 to 2)').isNumberFilter({
      operator: 'range',
      startOperator: '>=',
      startValue: '1',
      endOperator: '<',
      endValue: '2',
      not: true,
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
  test('not precedence', () => {
    expect('not 1, 2, 3').isNumberFilter(
      {
        operator: '!=',
        values: ['1', '2', '3'],
      },
      '!= 1, 2, 3'
    );
  });
  test.todo('all the ways that not can be applied');
});
