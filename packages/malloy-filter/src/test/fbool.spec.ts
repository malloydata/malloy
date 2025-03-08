/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import {BooleanClause} from '../clause_types';
import {BooleanFilterExpression} from '../boolean_filter_expression';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isBooleanFilter(expected: BooleanClause, unparse?: string): R;
    }
  }
}

expect.extend({
  isBooleanFilter(
    src: string,
    expectedParse: BooleanClause,
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
    const errTest = diff(expectedParse, boolC.parsed, {expand: true});
    return {
      pass: false,
      message: () => `${src} did not compile correctly\n${errTest}`,
    };
  },
});

describe('boolean filter expressions', () => {
  test('true', () => {
    expect('true').isBooleanFilter({operator: 'true'});
  });
  test('false', () => {
    expect('false').isBooleanFilter({operator: 'false_or_null'});
  });
  test('=false', () => {
    expect('=false').isBooleanFilter({operator: 'false'});
  });
  test('null', () => {
    expect('null').isBooleanFilter({operator: 'null'});
  });
  test('not null', () => {
    expect('not null').isBooleanFilter({operator: 'null', not: true});
  });
  test('not false', () => {
    expect('not false').isBooleanFilter({operator: 'false_or_null', not: true});
  });
});
