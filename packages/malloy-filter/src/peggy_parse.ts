/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FilterExpression, FilterLog} from './filter_interface';
import {isFilterExpression} from './filter_interface';

interface PeggySyntaxError {
  message: string;
  location?: {
    start: {offset: number; column: number};
    end: {offset: number; column: number};
  };
}

function isPeggySyntaxError(e: unknown): e is PeggySyntaxError {
  return e instanceof Error && 'location' in e;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function run_parser(
  src: string,
  parse: (input: string) => any
): {parsed: FilterExpression | null; log: FilterLog[]} {
  try {
    const expr = parse(src);
    if (isFilterExpression(expr)) {
      return {parsed: expr, log: []};
    }
    return {parsed: null, log: []};
  } catch (e) {
    if (isPeggySyntaxError(e)) {
      const loc = e.location;
      const startIndex = loc ? loc.start.offset : 0;
      const endIndex = loc ? loc.end.offset - 1 : src.length - 1;
      return {
        parsed: null,
        log: [
          {
            message: e.message,
            startIndex,
            endIndex: Math.max(startIndex, endIndex),
            severity: 'error',
          },
        ],
      };
    }
    throw e;
  }
}
