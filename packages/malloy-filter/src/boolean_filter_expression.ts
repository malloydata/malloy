/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {BooleanClause, FilterParserReponse} from './filter_clause';

export const BooleanFilterExpression = {
  parse(srcText: string): FilterParserReponse<BooleanClause> {
    const ret: FilterParserReponse<BooleanClause> = {parsed: null, log: []};
    let src = srcText.toLowerCase().trim().replace(/\s\s+/, ' ');
    let negate = false;
    if (src.startsWith('not ')) {
      negate = true;
      src = src.slice(4);
    }
    if (src === 'true') {
      ret.parsed = {operator: 'true'};
    } else if (src === 'false') {
      ret.parsed = {operator: 'false_or_null'};
    } else if (src === '=false') {
      ret.parsed = {operator: 'false'};
    } else if (src === 'null') {
      ret.parsed = {operator: 'null'};
    } else if (src === 'not null') {
      ret.parsed = {operator: 'null', not: true};
    } else {
      const nonSpace = srcText.match(/[^\s]/);
      const startIndex = nonSpace ? nonSpace.index ?? 0 : 0;
      ret.log = [
        {
          message:
            'Illegal boolean filter. Must be one of true,false,=false,null,not null',
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
  unparse(bc: BooleanClause | null): string {
    if (bc === null) {
      return '';
    }
    const n = bc.not ? 'not ' : '';
    switch (bc.operator) {
      case 'true':
      case 'null':
        return n + bc.operator;
      case 'false_or_null':
        return n + 'false';
      case 'false':
        return n + '=false';
    }
  },
};
