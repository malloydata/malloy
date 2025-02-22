import {
  NumberCondition,
  NumberRange,
  NumberOperator,
  NumberRangeOperator,
  NumberClause,
} from './clause_types';

export class NumberSerializer {
  constructor(private clauses: NumberClause[]) {
    this.clauses = clauses;
  }

  public serialize(): string {
    const result = NumberSerializer.clauseToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  // NumberOperator = '<=' | '>=' | '!=' | '=' | '>' | '<'
  private static numberConditionToString(
    operator: NumberOperator,
    value: number
  ): string {
    // Remove operator for eg "5, 7, 9".
    const operatorString = operator === '=' ? '' : operator;
    return operatorString + value;
  }

  private static getNegatedType(
    operator: NumberRangeOperator
  ): NumberRangeOperator {
    switch (operator) {
      case '<':
        return '>=';
      case '<=':
        return '>';
      case '>':
        return '<=';
      case '>=':
        return '<';
    }
  }

  private static isNumberOperator(value: string): boolean {
    return ['<=', '>=', '!=', '=', '>', '<'].includes(value);
  }

  private static rangeToString(clause: NumberRange): string {
    const negated: string =
      clause.startOperator === '<' || clause.startOperator === '<=' ? '!=' : '';
    const startOperator = negated
      ? NumberSerializer.getNegatedType(clause.startOperator)
      : clause.startOperator;
    const endOperator = negated
      ? NumberSerializer.getNegatedType(clause.endOperator)
      : clause.endOperator;
    const leftBracket: string = startOperator === '>' ? '(' : '[';
    const rightBracket: string = endOperator === '<' ? ')' : ']';
    return (
      negated +
      leftBracket +
      clause.startValue +
      ', ' +
      clause.endValue +
      rightBracket
    );
  }

  private static clauseToString(clauses: NumberClause[]): string {
    let result = '';
    for (const clause of clauses) {
      if (!('operator' in clause)) {
        throw new Error('Invalid number clause ' + JSON.stringify(clause));
      }
      if (clause.operator === 'range') {
        result += NumberSerializer.rangeToString(clause);
        result += ', ';
      } else if (clause.operator === 'NULL') {
        result += 'NULL, ';
      } else if (clause.operator === 'NOTNULL') {
        result += '-NULL, ';
      } else if (NumberSerializer.isNumberOperator(clause.operator)) {
        const numberClause: NumberCondition = clause as NumberCondition;
        for (const value of numberClause.values) {
          result += NumberSerializer.numberConditionToString(
            numberClause.operator,
            value
          );
          result += ', ';
        }
      }
    }
    return result;
  }
}
