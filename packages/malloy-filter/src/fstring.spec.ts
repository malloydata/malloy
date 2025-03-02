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
    const errTest = diff([expectedParse], results[0], {expand: true});
    if (errTest === '') {
      return {pass: true, message: () => `${src} parsed correctly`};
    }
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
});
