/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {BooleanFilter, FilterParserResponse} from './filter_interface';

export const BooleanFilterExpression = {
  parse(srcText: string): FilterParserResponse<BooleanFilter> {
    if (srcText.match(/^\s*$/)) {
      return {parsed: null, log: []};
    }
    const ret: FilterParserResponse<BooleanFilter> = {parsed: null, log: []};
    let src = srcText.toLowerCase().trim().replace(/\s\s+/, ' ');
    let negate = false;
    if (src.startsWith('not ')) {
      negate = true;
      src = src.slice(4);
    }
    if (src === 'true') {
      ret.parsed = {operator: 'true'};
    } else if (src === '=true') {
      ret.parsed = {operator: '=true'};
    } else if (src === 'false') {
      ret.parsed = {operator: 'false'};
    } else if (src === '=false') {
      ret.parsed = {operator: '=false'};
    } else if (src === 'null') {
      ret.parsed = {operator: 'null'};
    } else {
      const nonSpace = srcText.match(/[^\s]/);
      const startIndex = nonSpace ? nonSpace.index ?? 0 : 0;
      ret.log = [
        {
          message: `Illegal boolean filter '${src}'. Must be one of true,=true,false,=false,null`,
          severity: 'error',
          startIndex,
          endIndex: startIndex + srcText.length - 1,
        },
      ];
    }
    if (negate && ret.parsed) {
      ret.parsed.not = true;
    }
    return ret;
  },
  unparse(bc: BooleanFilter | null): string {
    if (bc === null) {
      return '';
    }
    const n = bc.not ? 'not ' : '';
    return n + bc.operator;
  },
};
