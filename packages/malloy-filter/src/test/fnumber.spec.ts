/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import type {NumberFilter} from '../filter_interface';
import {NumberFilterExpression} from '../number_filter_expression';
import {inspect} from 'util';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isNumberFilter(expected: NumberFilter, unparse?: string): R;
    }
  }
}

expect.extend({
  isNumberFilter(
    src: string,
    expectedParse: NumberFilter,
    expectedUnparse?: string
  ) {
    const result = NumberFilterExpression.parse(src);
    if (result.log.length > 0) {
      return {
        pass: false,
        message: () => `Parse error: ${result.log[0].message}`,
      };
    }
    const parsed = result.parsed;
    if (this.equals(expectedParse, parsed)) {
      const unparse = NumberFilterExpression.unparse(parsed);
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
      `Received: ${inspect(parsed, {breakLength: 80, depth: Infinity})}`
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
  test(' != 5,6', () => {
    expect('!= 5, 6').isNumberFilter({operator: '!=', values: ['5', '6']});
  });
  test('not != 5,6', () => {
    expect('not != 5, 6').isNumberFilter(
      {operator: '=', values: ['5', '6']},
      '5, 6'
    );
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
  test('not = X', () => {
    expect('not = 42').isNumberFilter(
      {operator: '!=', values: ['42']},
      '!= 42'
    );
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
  test('.N (leading decimal)', () => {
    expect('.5').isNumberFilter({operator: '=', values: ['.5']});
  });
  test('-0.5', () => {
    expect('-0.5').isNumberFilter({operator: '=', values: ['-0.5']});
  });
  test('= N, N (explicit equals list)', () => {
    expect('= 1, 2').isNumberFilter(
      {operator: '=', values: ['1', '2']},
      '1, 2'
    );
  });
  test('!= N, N, N', () => {
    expect('!= 1, 2, 3').isNumberFilter({
      operator: '!=',
      values: ['1', '2', '3'],
    });
  });
  test('range with floats', () => {
    expect('[-1.5 to 2.5]').isNumberFilter({
      operator: 'range',
      startOperator: '>=',
      startValue: '-1.5',
      endOperator: '<=',
      endValue: '2.5',
    });
  });
  test('or with non-equal clauses', () => {
    expect('> 3 or < 1').isNumberFilter({
      operator: 'or',
      members: [
        {operator: '>', values: ['3']},
        {operator: '<', values: ['1']},
      ],
    });
  });
  test('case insensitive keywords', () => {
    expect('NOT NULL').isNumberFilter({operator: 'null', not: true}, 'not null');
  });
  test('syntax error', () => {
    const p = NumberFilterExpression.parse('abc');
    expect(p.log.length).toBeGreaterThan(0);
    expect(p.log[0]).toMatchObject({severity: 'error'});
  });
});
