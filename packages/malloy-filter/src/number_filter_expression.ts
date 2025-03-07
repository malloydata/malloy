import {NumberClause} from './clause_types';

export const NumberFilterExpression = {
  unparse(nc: NumberClause): string {
    switch (nc.operator) {
      case '=':
      case '!=':
      case '>':
      case '<':
      case '<=':
      case '>=': {
        if (!nc.not) {
          if (nc.operator === '=') {
            return nc.values.join(', ');
          }
          return nc.values.map(v => `${nc.operator} ${v}`).join(', ');
        }
        break;
      }
      case 'range':
        if (!nc.not) {
          const left = nc.startOperator === '>' ? '(' : '[';
          const right = nc.endOperator === '<' ? ')' : ']';
          return `${left}${nc.startValue} to ${nc.endValue}${right}`;
        }
        break;
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
