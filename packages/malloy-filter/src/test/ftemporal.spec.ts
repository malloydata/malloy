/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import * as nearley from 'nearley';
import ftemporal_grammar from '../lib/ftemporal_parser';
import {TemporalClause} from '../filter_clause';
import {TemporalFilterExpression} from '../temporal_filter_expression';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isTemporalFilter(expected: TemporalClause, unparse?: string): R;
    }
  }
}

expect.extend({
  isTemporalFilter(
    src: string,
    expectedParse: TemporalClause,
    expectedUnparse?: string
  ) {
    const fstring_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(ftemporal_grammar)
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
      const unparse = TemporalFilterExpression.unparse(results[0]);
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
});

describe('temporal filter expressions', () => {
  test('null', () => {
    expect('null').isTemporalFilter({operator: 'null'});
  });
  test('not null', () => {
    expect('not null').isTemporalFilter({operator: 'null', not: true});
  });
  test('literal timestamp', () => {
    expect('2001-02-03 04:05:06.7').isTemporalFilter({
      operator: 'in',
      moment: {moment: 'literal', literal: '2001-02-03 04:05:06.7'},
    });
  });
  test('literal hour', () => {
    expect('2001-02-03 04').isTemporalFilter({
      operator: 'in',
      moment: {moment: 'literal', literal: '2001-02-03 04', units: 'hour'},
    });
  });
  test('literal day', () => {
    expect('2001-02-03').isTemporalFilter({
      operator: 'in',
      moment: {moment: 'literal', literal: '2001-02-03', units: 'day'},
    });
  });
  test('literal week', () => {
    expect('2001-02-03-WK').isTemporalFilter({
      operator: 'in',
      moment: {moment: 'literal', literal: '2001-02-03-WK', units: 'week'},
    });
  });
  test('literal quarter', () => {
    expect('2001-Q1').isTemporalFilter({
      operator: 'in',
      moment: {moment: 'literal', literal: '2001-Q1', units: 'quarter'},
    });
  });
  test('literal year', () => {
    expect('2001').isTemporalFilter({
      operator: 'in',
      moment: {moment: 'literal', literal: '2001', units: 'year'},
    });
  });
});
