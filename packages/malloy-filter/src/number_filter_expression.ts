/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FilterParserReponse,
  isNumberClause,
  NumberClause,
} from './filter_clause';
import * as nearley from 'nearley';
import fnumber_grammar from './lib/fexpr_number_parser';
import {run_parser} from './nearley_parse';

export const NumberFilterExpression = {
  parse(src: string): FilterParserReponse<NumberClause> {
    const fnumber_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(fnumber_grammar)
    );
    const parse_result = run_parser(src, fnumber_parser);
    if (parse_result.parsed && isNumberClause(parse_result.parsed)) {
      return {parsed: parse_result.parsed, log: []};
    }
    return {parsed: null, log: parse_result.log};
  },
  unparse(nc: NumberClause | null): string {
    if (nc === null) {
      return '';
    }
    switch (nc.operator) {
      case '=':
      case '!=':
      case '>':
      case '<':
      case '<=':
      case '>=':
        if (nc.not) {
          return nc.values
            .map(v =>
              nc.operator === '=' ? `not ${v}` : `not ${nc.operator} ${v}`
            )
            .join(', ');
        }
        if (nc.operator === '=') {
          return nc.values.join(', ');
        }
        return nc.values.map(v => `${nc.operator} ${v}`).join(', ');
      case 'range': {
        const left = nc.startOperator === '>' ? '(' : '[';
        const right = nc.endOperator === '<' ? ')' : ']';
        const rExpr = `${left}${nc.startValue} to ${nc.endValue}${right}`;
        return nc.not ? `not ${rExpr}` : rExpr;
      }
      case 'null': {
        return nc.not ? 'not null' : 'null';
      }
      case 'and':
      case 'or':
        return nc.members
          .map(m => NumberFilterExpression.unparse(m))
          .join(` ${nc.operator} `);
      case ',':
        return nc.members
          .map(m => NumberFilterExpression.unparse(m))
          .join(', ');
      case '()': {
        const expr = '(' + NumberFilterExpression.unparse(nc.expr) + ')';
        return nc.not ? 'not ' + expr : expr;
      }
    }
    return `no unparse for ${JSON.stringify(nc)}`;
  },
};
