/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {diff} from 'jest-diff';
import * as nearley from 'nearley';
import fstring_grammar from './lib/fexpr-string-parser';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      parsesTo(expected: unknown): R;
    }
  }
}
expect.extend({
  parsesTo(src: string, expectedParse: unknown) {
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
      return {pass: true, message: () => `${src} parsed correctly`};
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

describe('nearley string filters', () => {
  test('matching', () => {
    expect('A').parsesTo({op: '=~', match: 'A'});
  });
  test('not match', () => {
    expect('-A').parsesTo({op: '=~', match: 'A', not: true});
  });
  test('is null', () => {
    expect('null').parsesTo({op: 'null'});
    expect('NULL').parsesTo({op: 'null'});
  });
  test('is not null', () => {
    expect('-null').parsesTo({op: 'null', not: true});
  });
  test('is empty', () => {
    expect('empty').parsesTo({op: 'empty'});
    expect('EMPTY').parsesTo({op: 'empty'});
  });
  test('is not empty', () => {
    expect('-empty').parsesTo({op: 'empty', not: true});
  });
  test('a,b', () => {
    expect('a,b').parsesTo({
      op: ',',
      left: {op: '=~', match: 'a'},
      right: {op: '=~', match: 'b'},
    });
  });
  test('a;b', () => {
    expect('a;b').parsesTo({
      op: ';',
      left: {op: '=~', match: 'a'},
      right: {op: '=~', match: 'b'},
    });
  });
  test('a|b', () => {
    expect('a|b').parsesTo({
      op: '|',
      left: {op: '=~', match: 'a'},
      right: {op: '=~', match: 'b'},
    });
  });
  test('(a)', () => {
    expect('(a)').parsesTo({
      op: '()',
      expr: {op: '=~', match: 'a'},
    });
  });
  test('-(z)', () => {
    expect('-(z)').parsesTo({
      op: '()',
      expr: {op: '=~', match: 'z'},
      not: true,
    });
  });
});
