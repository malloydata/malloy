import {
  FilterParserReponse,
  isNumberClause,
  NumberClause,
} from './filter_clause';
import * as nearley from 'nearley';
import fstring_grammar from './lib/fexpr_string_parser';

export const NumberFilterExpression = {
  parse(src: string): FilterParserReponse<NumberClause> {
    const fstring_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(fstring_grammar)
    );
    fstring_parser.feed(src);
    const results = fstring_parser.finish();
    const expr = results[0];
    if (isNumberClause(expr)) {
      return {parsed: expr, log: []};
    }
    return {
      parsed: null,
      log: [
        {
          message: 'Parse did not return a legal expression',
          startIndex: 0,
          endIndex: src.length - 1,
          severity: 'error',
        },
      ],
    };
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
