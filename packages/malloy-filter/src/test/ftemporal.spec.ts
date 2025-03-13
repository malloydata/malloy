/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import * as nearley from 'nearley';
import ftemporal_grammar from '../lib/ftemporal_parser';
import type {TemporalClause} from '../filter_clause';
import {TemporalFilterExpression} from '../temporal_filter_expression';
import {inspect} from 'util';

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
          `Unparse Error: '${src}' unparsed incorrectly'\n${serialize_error}`,
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

describe('temporal filter expressions', () => {
  describe('literal moments', () => {
    test('literal timestamp', () => {
      expect('2001-02-03 04:05:06.7').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001-02-03 04:05:06.7'},
      });
    });
    test('literal t-timestamp', () => {
      expect('2001-02-03T04:05:06.7').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001-02-03T04:05:06.7'},
      });
    });
    test('not literal', () => {
      expect('not 2001-02-03 04:05:06.7').isTemporalFilter({
        operator: 'in',
        not: true,
        in: {moment: 'literal', literal: '2001-02-03 04:05:06.7'},
      });
    });
    test('literal hour', () => {
      expect('2001-02-03 04').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001-02-03 04', units: 'hour'},
      });
    });
    test('literal day', () => {
      expect('2001-02-03').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001-02-03', units: 'day'},
      });
    });
    test('literal week', () => {
      expect('2001-02-03-WK').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001-02-03-WK', units: 'week'},
      });
    });
    test('literal quarter', () => {
      expect('2001-Q1').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001-Q1', units: 'quarter'},
      });
    });
    test('literal year', () => {
      expect('2001').isTemporalFilter({
        operator: 'in',
        in: {moment: 'literal', literal: '2001', units: 'year'},
      });
    });
  });

  describe('other moments', () => {
    test('now', () => {
      expect('now').isTemporalFilter({operator: 'in', in: {moment: 'now'}});
    });
    test('not now', () => {
      expect('not now').isTemporalFilter({
        operator: 'in',
        not: true,
        in: {moment: 'now'},
      });
    });
    test('this hour', () => {
      expect('this hour').isTemporalFilter({
        operator: 'in',
        in: {moment: 'this', units: 'hour'},
      });
    });
    test('next day', () => {
      expect('next day').isTemporalFilter({
        operator: 'in',
        in: {moment: 'next', units: 'day'},
      });
    });
    test('last week', () => {
      expect('last week').isTemporalFilter({
        operator: 'in',
        in: {moment: 'last', units: 'week'},
      });
    });
    test('not this month', () => {
      expect('not this month').isTemporalFilter({
        operator: 'in',
        not: true,
        in: {moment: 'this', units: 'month'},
      });
    });
    test('not last year', () => {
      expect('not last year').isTemporalFilter({
        operator: 'in',
        not: true,
        in: {moment: 'last', units: 'year'},
      });
    });
    test('next quarter', () => {
      expect('next quarter').isTemporalFilter({
        operator: 'in',
        in: {moment: 'next', units: 'quarter'},
      });
    });
    test('not today', () => {
      expect('not today').isTemporalFilter({
        operator: 'in',
        not: true,
        in: {moment: 'today'},
      });
    });
    test('tomorrow', () => {
      expect('tomorrow').isTemporalFilter({
        operator: 'in',
        in: {moment: 'tomorrow'},
      });
    });
    test('yesterday', () => {
      expect('yesterday').isTemporalFilter({
        operator: 'in',
        in: {moment: 'yesterday'},
      });
    });
    test('ago moment', () => {
      expect('5 years ago').isTemporalFilter({
        operator: 'in',
        in: {moment: 'ago', n: '5', units: 'year'},
      });
    });
    test('from now moment', () => {
      expect('1 week from now').isTemporalFilter({
        operator: 'in',
        in: {moment: 'from_now', n: '1', units: 'week'},
      });
    });
    test('monday', () => {
      expect('monday').isTemporalFilter({
        operator: 'in',
        in: {moment: 'monday', which: 'last'},
      });
    });
    test('not last tuesday', () => {
      expect('not last tuesday').isTemporalFilter(
        {
          operator: 'in',
          not: true,
          in: {moment: 'tuesday', which: 'last'},
        },
        'not tuesday'
      );
    });
    test('next wednesday', () => {
      expect('next wednesday').isTemporalFilter({
        operator: 'in',
        in: {moment: 'wednesday', which: 'next'},
      });
    });
    test('last thursday', () => {
      expect('thursday').isTemporalFilter(
        {
          operator: 'in',
          in: {moment: 'thursday', which: 'last'},
        },
        'thursday'
      );
    });
    test('friday', () => {
      expect('friday').isTemporalFilter({
        operator: 'in',
        in: {moment: 'friday', which: 'last'},
      });
    });
    test('saturday', () => {
      expect('saturday').isTemporalFilter({
        operator: 'in',
        in: {moment: 'saturday', which: 'last'},
      });
    });
    test('sunday', () => {
      expect('sunday').isTemporalFilter({
        operator: 'in',
        in: {moment: 'sunday', which: 'last'},
      });
    });
  });

  describe('temporal clauses', () => {
    test('null', () => {
      expect('null').isTemporalFilter({operator: 'null'});
    });
    test('not null', () => {
      expect('not null').isTemporalFilter({operator: 'null', not: true});
    });
    test('parens', () => {
      expect('(null)').isTemporalFilter({
        operator: '()',
        expr: {operator: 'null'},
      });
    });
    test('1 hour', () => {
      expect('1 hour').isTemporalFilter({
        operator: 'in_last',
        n: '1',
        units: 'hour',
      });
    });
    test('not 7 days', () => {
      expect('not 7 days').isTemporalFilter({
        operator: 'in_last',
        not: true,
        n: '7',
        units: 'day',
      });
    });
    test('last 2 days', () => {
      expect('last 2 days').isTemporalFilter({
        operator: 'last',
        n: '2',
        units: 'day',
      });
    });
    test('not next 3 weeks', () => {
      expect('not next 3 weeks').isTemporalFilter({
        operator: 'next',
        not: true,
        n: '3',
        units: 'week',
      });
    });
    test('before today', () => {
      expect('before today').isTemporalFilter({
        operator: 'before',
        before: {moment: 'today'},
      });
    });
    test('not after tomorrow', () => {
      expect('not after tomorrow').isTemporalFilter({
        operator: 'after',
        not: true,
        after: {moment: 'tomorrow'},
      });
    });
    test('yesterday to tomorrow', () => {
      expect('yesterday to tomorrow').isTemporalFilter({
        operator: 'to',
        fromMoment: {moment: 'yesterday'},
        toMoment: {moment: 'tomorrow'},
      });
    });
    test('not today to now', () => {
      expect('not today to now').isTemporalFilter({
        operator: 'to',
        not: true,
        fromMoment: {moment: 'today'},
        toMoment: {moment: 'now'},
      });
    });
    test('now for 42 minutes', () => {
      expect('now for 42 minutes').isTemporalFilter({
        operator: 'for',
        begin: {moment: 'now'},
        n: '42',
        units: 'minute',
      });
    });
    test('not now for 1 second', () => {
      expect('not now for 1 second').isTemporalFilter({
        operator: 'for',
        begin: {moment: 'now'},
        n: '1',
        units: 'second',
        not: true,
      });
    });
  });

  describe('joined clauses', () => {
    test('or', () => {
      expect('today or tomorrow').isTemporalFilter({
        operator: 'or',
        members: [
          {operator: 'in', in: {moment: 'today'}},
          {operator: 'in', in: {moment: 'tomorrow'}},
        ],
      });
    });
    test('and', () => {
      expect('not before tomorrow and after yesterday').isTemporalFilter({
        operator: 'and',
        members: [
          {operator: 'before', not: true, before: {moment: 'tomorrow'}},
          {operator: 'after', after: {moment: 'yesterday'}},
        ],
      });
    });
  });

  test('a syntax error', () => {
    const p = TemporalFilterExpression.parse('not nulll,now');
    expect(p.log.length).toBeGreaterThan(0);
    expect(p.log[0]).toMatchObject({
      startIndex: 4,
      endIndex: 8,
      severity: 'error',
    });
  });
});
