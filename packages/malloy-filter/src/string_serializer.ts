/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  StringClause,
  StringCondition,
  StringConditionOperator,
  StringMatch,
  StringMatchOperator,
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
      operator === '!=' ||
      operator === 'not_starts' ||
      operator === 'not_ends' ||
      operator === 'not_contains'
    );
  }

  private static escapeSpecialCharacters(input: string): string {
    return input.replace(/[,\\]/g, match => `\\${match}`);
  }

  private static escapeWildcardCharacters(input: string): string {
    return input.replace(/[_%]/g, match => `\\${match}`);
  }

  // export type StringConditionOperator =
  //  | 'starts' | 'ends' | 'contains' | 'notStarts' | 'notEnds' | 'notContains'
  //  | '='| '!=';
  private static StringConditionWordToString(
    operator: StringConditionOperator,
    value: string
  ): string {
    const negated: boolean = StringSerializer.isNegated(operator);
    if (value === 'null' || value === '-null') {
      return (negated ? '-' : '') + '\\' + value;
    }

    value = StringSerializer.escapeSpecialCharacters(value);
    value = StringSerializer.escapeWildcardCharacters(value);
    if (operator === 'starts' || operator === 'not_starts') {
      return (negated ? '-' : '') + value + '%';
    } else if (operator === 'ends' || operator === 'not_ends') {
      return (negated ? '-' : '') + '%' + value;
    } else if (operator === 'contains' || operator === 'not_contains') {
      return (negated ? '-' : '') + '%' + value + '%';
    }
    return (negated ? '-' : '') + value;
  }

  // export type StringMatchOperator = '~' | '!~';
  private static StringMatchWordToString(
    operator: StringMatchOperator,
    value: string
  ): string {
    const negated: boolean = operator === '!~' ? true : false;
    if (value === 'null' || value === '-null') {
      return (negated ? '-' : '') + '\\' + value;
    }
    value = StringSerializer.escapeSpecialCharacters(value);
    return (negated ? '-' : '') + value;
  }

  private static StringClauseToString(
    operator:
      | StringConditionOperator
      | StringMatchOperator
      | 'empty'
      | 'not_empty'
      | 'null'
      | 'not_null',
    clause: StringClause
  ): string {
    if (operator === 'empty') {
      return 'empty';
    } else if (operator === 'not_empty') {
      return '-empty';
    } else if (operator === 'null') {
      return 'null';
    } else if (operator === 'not_null') {
      return '-null';
    }
    let result = '';
    if ('values' in clause && clause.values.length > 0) {
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
    } else if ('escaped_values' in clause && clause.escaped_values.length > 0) {
      const condition: StringMatch = clause;
      for (const value of condition.escaped_values) {
        const word = StringSerializer.StringMatchWordToString(
          condition.operator,
          value
        );
        if (word) {
          result += word + ', ';
        }
      }
    }
    return result.trim().replace(/,$/, '');
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
