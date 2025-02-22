import {StringClause, StringOperator} from './clause_types';

export class StringSerializer {
  constructor(private clauses: StringClause[]) {
    this.clauses = clauses;
  }

  public serialize(): string {
    const result = StringSerializer.clauseToString(this.clauses);
    return result.trim().replace(/,$/, '');
  }

  private static isNegated(operator: StringOperator): boolean {
    return (
      operator === 'NOTEMPTY' ||
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

  // export type StringOperator = 'EMPTY' | 'NOTEMPTY' | 'starts' | 'ends' | 'contains' | 'notStarts' |
  // 'notEnds' | 'notContains' | '~' | '=' | '!~' | '!=';
  private static StringClauseToString(
    operator: StringOperator,
    value: string | null
  ): string {
    if (operator === 'EMPTY') {
      return 'EMPTY';
    } else if (operator === 'NOTEMPTY') {
      return '-EMPTY';
    }

    const negated: boolean = StringSerializer.isNegated(operator);
    if (value === null) {
      return negated ? '-NULL' : 'NULL';
    }
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

  private static clauseToString(clauses: StringClause[]): string {
    let result = '';
    for (const genericClause of clauses) {
      const clause: StringClause = genericClause as StringClause;
      for (const value of clause.values) {
        const word = StringSerializer.StringClauseToString(
          clause.operator,
          value
        );
        if (word) {
          result += word + ', ';
        }
      }
    }
    return result;
  }
}
