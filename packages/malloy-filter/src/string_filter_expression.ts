/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {FilterParserResponse, StringFilter} from './filter_interface';
import {isStringFilter} from './filter_interface';
import {parse as peggyStringParser} from './lib/fexpr_string_parser';
import {escape} from './clause_utils';
import {run_parser} from './peggy_parse';

export const StringFilterExpression = {
  parse(src: string): FilterParserResponse<StringFilter> {
    if (src.match(/^\s*$/)) {
      return {parsed: null, log: []};
    }
    const parse_result = run_parser(src, peggyStringParser);
    if (parse_result.parsed && isStringFilter(parse_result.parsed)) {
      return {parsed: parse_result.parsed, log: []};
    }
    return {parsed: null, log: parse_result.log};
  },
  unparse(sc: StringFilter | null): string {
    if (sc === null) {
      return '';
    }
    switch (sc.operator) {
      case '=':
        if (sc.not) {
          return sc.values.map(s => '-' + escape(s)).join(', ');
        }
        return sc.values.map(s => escape(s)).join(', ');
      case '~':
        if (sc.not) {
          return sc.escaped_values.map(s => '-' + s).join(', ');
        }
        return sc.escaped_values.join(', ');
      case 'starts':
        if (sc.not) {
          return sc.values.map(s => '-' + escape(s) + '%').join(', ');
        }
        return sc.values.map(s => escape(s) + '%').join(', ');
      case 'ends':
        if (sc.not) {
          return sc.values.map(s => '-%' + escape(s)).join(', ');
        }
        return sc.values.map(s => '%' + escape(s)).join(', ');
      case 'contains':
        if (sc.not) {
          return sc.values.map(s => '-%' + escape(s) + '%').join(', ');
        }
        return sc.values.map(s => '%' + escape(s) + '%').join(', ');
      case 'or':
        return sc.members
          .map(or => StringFilterExpression.unparse(or))
          .join(' | ');
      case 'and':
        return sc.members
          .map(or => StringFilterExpression.unparse(or))
          .join('; ');
      case ',':
        return sc.members
          .map(or => StringFilterExpression.unparse(or))
          .join(', ');
      case '()': {
        const expr = '(' + StringFilterExpression.unparse(sc.expr) + ')';
        return sc.not ? '-' + expr : expr;
      }
      case 'null':
        return sc.not ? '-null' : 'null';
      case 'empty':
        return sc.not ? '-empty' : 'empty';
    }
  },
};
