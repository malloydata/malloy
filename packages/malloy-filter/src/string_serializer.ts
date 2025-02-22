import {
  StringClause,
  StringCondition,
  StringConditionOperator,
} from './clause_types';

export class StringSerializer {
  constructor(private clauses: StringClause[]) {
    this.clauses = clauses;
  }

  public serialize(): string {
    const result = StringSerializer.clauseToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  private static isNegated(operator: StringConditionOperator): boolean {
    return (
      operator === '!~' ||
      operator === '!=' ||
      operator === 'notStarts' ||
      operator === 'notEnds' ||
      operator === 'notContains'
    );
  }

  private static escapeSpecialCharacters(input: string): string {
    return input.replace(/[,\\]/g, match => `\\${match}`);
  }

  private static escapeWildcardCharacters(input: string): string {
    return input.replace(/[_%]/g, match => `\\${match}`);
  }

  // export type StringOperator =
  //  | 'starts' | 'ends' | 'contains' | 'notStarts' | 'notEnds' | 'notContains'
  //  | '~' | '=' | '!~' | '!=';
  private static StringConditionWordToString(
    operator: StringConditionOperator,
    value: string
  ): string {
    const negated: boolean = StringSerializer.isNegated(operator);
    if (value === 'NULL' || value === '-NULL') {
      return (negated ? '-' : '') + '\\' + value;
    }

    value = StringSerializer.escapeSpecialCharacters(value);
    if (operator === 'starts' || operator === 'notStarts') {
      value = StringSerializer.escapeWildcardCharacters(value);
      return (negated ? '-' : '') + value + '%';
    } else if (operator === 'ends' || operator === 'notEnds') {
      value = StringSerializer.escapeWildcardCharacters(value);
      return (negated ? '-' : '') + '%' + value;
    } else if (operator === 'contains' || operator === 'notContains') {
      value = StringSerializer.escapeWildcardCharacters(value);
      return (negated ? '-' : '') + '%' + value + '%';
    } else if (operator === '=' || operator === '!=') {
      value = StringSerializer.escapeWildcardCharacters(value);
      return (negated ? '-' : '') + value;
    }

    return (negated ? '-' : '') + value;
  }

  private static StringClauseToString(
    operator:
      | StringConditionOperator
      | 'EMPTY'
      | 'NOTEMPTY'
      | 'NULL'
      | 'NOTNULL',
    clause: StringClause
  ): string {
    if (operator === 'EMPTY') {
      return 'EMPTY';
    } else if (operator === 'NOTEMPTY') {
      return '-EMPTY';
    } else if (operator === 'NULL') {
      return 'NULL';
    } else if (operator === 'NOTNULL') {
      return '-NULL';
    }
    if (!('values' in clause) || clause.values.length === 0) {
      return '';
    }
    let result = '';
    const condition: StringCondition = clause;
    for (const value of condition.values) {
      const word = StringSerializer.StringConditionWordToString(
        condition.operator,
        value
      );
      if (word) {
        result += word + ', ';
      }
    }
    return result;
  }

  private static clauseToString(clauses: StringClause[]): string {
    let result = '';
    for (const clause of clauses) {
      const words = StringSerializer.StringClauseToString(
        clause.operator,
        clause
      );
      if (words) {
        result += words + ', ';
      }
    }
    return result;
  }
}
