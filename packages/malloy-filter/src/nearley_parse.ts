/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Parser} from 'nearley';
import type {ClauseBase, FilterLog} from './filter_clause';
import {isClauseBase} from './filter_clause';

export function run_parser(
  src: string,
  parser: Parser
): {parsed: ClauseBase | null; log: FilterLog[]} {
  try {
    parser.feed(src);
    const results = parser.finish();
    const expr = results[0];
    if (isClauseBase(expr)) {
      return {parsed: expr, log: []};
    }
    return {parsed: null, log: []};
  } catch (e) {
    let newMessage = e.message;
    let col = 1;
    let len = src.length;
    if (e.token) {
      const token = e.token;
      col = token.col;
      len = token.length;
      const message = e.message;
      const expected = message
        .match(/(?<=A ).*(?= based on:)/g)
        .map(s => s.replace(/\s+token/i, ''));
      newMessage = `Unexpected ${token.type} token "${token.value}"`;
      if (expected && expected.length) {
        newMessage += ` Tokens expected: ${[...new Set(expected)]}`;
      }
    }
    return {
      parsed: null,
      log: [
        {
          message: newMessage,
          startIndex: col - 1,
          endIndex: col - 1 + len - 1,
          severity: 'error',
        },
      ],
    };
  }
}
