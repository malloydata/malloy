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
    expect('A').parsesTo({op: '=', match: 'A'});
  });
  test('not match', () => {
    expect('-A').parsesTo({op: '=', match: 'A', not: true});
  });
  test('like %', () => {
    expect('%').parsesTo({op: '~', match: '%'});
  });
  test('like _', () => {
    expect('_').parsesTo({op: '~', match: '_'});
  });
  test('like a%z', () => {
    expect('a%z').parsesTo({op: '~', match: 'a%z'});
  });
  test('starts with %', () => {
    expect('\\%%').parsesTo({op: 'starts', match: '%'});
  });
  test('end with _', () => {
    expect('%\\_').parsesTo({op: 'ends', match: '_'});
  });
  test('contains _X_', () => {
    expect('%\\_X\\_%').parsesTo({op: 'contains', match: '_X_'});
  });
  test('not starts with foo', () => {
    expect('-foo%').parsesTo({op: 'starts', match: 'foo', not: true});
  });
  test('a_% is not a starts with', () => {
    expect('a_%').parsesTo({op: '~', match: 'a_%'});
  });
  test('not ends with bar', () => {
    expect('-%bar').parsesTo({op: 'ends', match: 'bar', not: true});
  });
  test('not contains sugar', () => {
    expect('-%sugar%').parsesTo({op: 'contains', match: 'sugar', not: true});
  });
  test('is %', () => {
    expect('\\%').parsesTo({op: '=', match: '%'});
  });
  test('is _', () => {
    expect('\\_').parsesTo({op: '=', match: '_'});
  });
  test('like a_', () => {
    expect('a_').parsesTo({op: '~', match: 'a_'});
  });
  test('space a', () => {
    expect(' a ').parsesTo({op: '=', match: 'a'});
  });
  test('escape-space a', () => {
    expect('\\ a').parsesTo({op: '=', match: ' a'});
  });
  test('a escape-space', () => {
    expect('a\\ ').parsesTo({op: '=', match: 'a '});
  });
  test(' spacey null ', () => {
    expect(' null ').parsesTo({op: 'null'});
  });
  test('is null', () => {
    expect('null').parsesTo({op: 'null'});
    expect('NULL').parsesTo({op: 'null'});
  });
  test('is not null', () => {
    expect('-null').parsesTo({op: 'null', not: true});
  });
  test('= null', () => {
    expect('\\null').parsesTo({op: '=', match: 'null'});
  });
  test('= empty', () => {
    expect('\\empty').parsesTo({op: '=', match: 'empty'});
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
      left: {op: '=', match: 'a'},
      right: {op: '=', match: 'b'},
    });
  });
  test('a;b', () => {
    expect('a;b').parsesTo({
      op: ';',
      left: {op: '=', match: 'a'},
      right: {op: '=', match: 'b'},
    });
  });
  test('a|b', () => {
    expect('a|b').parsesTo({
      op: '|',
      left: {op: '=', match: 'a'},
      right: {op: '=', match: 'b'},
    });
  });
  test('(a)', () => {
    expect('(a)').parsesTo({
      op: '()',
      expr: {op: '=', match: 'a'},
    });
  });
  test('-(z)', () => {
    expect('-(z)').parsesTo({
      op: '()',
      expr: {op: '=', match: 'z'},
      not: true,
    });
  });
  test('contains ,', () => {
    expect('a\\,b').parsesTo({
      op: '=',
      match: 'a,b',
    });
  });
  test('contains ;', () => {
    expect('a\\;b').parsesTo({
      op: '=',
      match: 'a;b',
    });
  });
  test('contains |', () => {
    expect('a\\|b').parsesTo({
      op: '=',
      match: 'a|b',
    });
  });
  test('starts with -', () => {
    expect('\\-a').parsesTo({op: '=', match: '-a'});
  });
  test('a,-null', () => {
    expect('a,-null').parsesTo({
      op: ',',
      left: {op: '=', match: 'a'},
      right: {op: 'null', not: true},
    });
  });
  test('-a,null', () => {
    expect('-a,null').parsesTo({
      op: ',',
      left: {op: '=', match: 'a', not: true},
      right: {op: 'null'},
    });
  });
  test('complex filter', () => {
    expect('(a,(b;c)|-empty,null);-null').parsesTo({
      op: ';',
      left: {
        op: '()',
        expr: {
          op: ',',
          left: {
            op: '|',
            left: {
              op: ',',
              left: {op: '=', match: 'a'},
              right: {
                op: '()',
                expr: {
                  op: ';',
                  left: {op: '=', match: 'b'},
                  right: {op: '=', match: 'c'},
                },
              },
            },
            right: {op: 'empty', not: true},
          },
          right: {op: 'null'},
        },
      },
      right: {op: 'null', not: true},
    });
  });
});
