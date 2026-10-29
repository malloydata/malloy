/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {diff} from 'jest-diff';
import type {BooleanFilter} from '../filter_interface';
import {BooleanFilterExpression} from '../boolean_filter_expression';
import {inspect} from 'util';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isBooleanFilter(expected: BooleanFilter, unparse?: string): R;
    }
  }
}

expect.extend({
  isBooleanFilter(
    src: string,
    expectedParse: BooleanFilter,
    expectedUnparse?: string
  ) {
    const boolC = BooleanFilterExpression.parse(src);
    if (!boolC.parsed) {
      return {
        pass: false,
        message: () => boolC.log[0].message,
      };
    }
    if (this.equals(expectedParse, boolC.parsed)) {
      const unparse = BooleanFilterExpression.unparse(boolC.parsed);
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
      `Received: ${inspect(boolC.parsed, {breakLength: 80, depth: Infinity})}`
    );
    return {
      pass: false,
      message: () => `${src} did not compile correctly\n${want}\n${rcv}`,
    };
  },
});

describe('boolean filter expressions', () => {
  test('true', () => {
    expect('true').isBooleanFilter({operator: 'true'});
  });
  test('=true', () => {
    expect('=true').isBooleanFilter({operator: '=true'});
  });
  test('false', () => {
    expect('false').isBooleanFilter({operator: 'false'});
  });
  test('=false', () => {
    expect('=false').isBooleanFilter({operator: '=false'});
  });
  test('null', () => {
    expect('null').isBooleanFilter({operator: 'null'});
  });
  test('not null', () => {
    expect('not null').isBooleanFilter({operator: 'null', not: true});
  });
  test('none', () => {
    expect('none').isBooleanFilter({operator: 'none'});
  });
  test('not none', () => {
    expect('not none').isBooleanFilter({operator: 'none', not: true});
  });
  test('not false', () => {
    expect('not false').isBooleanFilter({operator: 'false', not: true});
  });
  test('not true', () => {
    expect('not true').isBooleanFilter({operator: 'true', not: true});
  });
  test('not =true', () => {
    expect('not =true').isBooleanFilter({operator: '=true', not: true});
  });
  test('not =false', () => {
    expect('not =false').isBooleanFilter({operator: '=false', not: true});
  });
  test('illegal boolean', () => {
    const res = BooleanFilterExpression.parse('tru');
    expect(res.parsed).toBeNull();
    expect(res.log.length).toBe(1);
    expect(res.log[0].message).toBe(
      "Illegal boolean filter 'tru'. Must be one of true,=true,false,=false,null,none"
    );
  });
});
