/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {
  NumberCondition,
  NumberRange,
  NumberOperator,
  NumberRangeOperator,
  NumberClause,
  NumberParserResponse,
  FilterLog,
} from './clause_types';
import {BaseParser} from './base_parser';
import {Token} from './token_types';

export class NumberParser extends BaseParser {
  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    const specialSubstrings: SpecialToken[] = [
      {type: ',', value: ','},
      {type: '[', value: '['},
      {type: ']', value: ']'},
      {type: '(', value: '('},
      {type: ')', value: ')'},
      {type: '<=', value: '<='},
      {type: '>=', value: '>='},
      {type: '!=', value: '!='},
      {type: '=', value: '='},
      {type: '>', value: '>'},
      {type: '<', value: '<'},
    ];
    const specialWords = [
      {type: 'not_null', value: '-null', ignoreCase: true},
      {type: 'null', value: 'null', ignoreCase: true},
    ];
    const params: TokenizerParams = {
      trimWordWhitespace: true,
      combineAdjacentWords: false,
      splitOnWhitespace: true,
      specialSubstrings,
      specialWords,
    };

    const tokenizer = new Tokenizer(this.inputString, params);
    this.tokens = tokenizer.parse();
  }

  public parse(): NumberParserResponse {
    this.index = 0;
    this.tokenize();
    let clauses: NumberClause[] = [];
    const logs: FilterLog[] = [];
    while (this.index < this.tokens.length) {
      const token = this.getNext();
      if (token.type === ',') {
        this.index++;
      } else if (this.isRangeStart(this.index)) {
        clauses = this.checkRange(token, false, clauses, logs);
      } else if (token.type === '!=' && this.isRangeStart(this.index + 1)) {
        this.index++;
        clauses = this.checkRange(token, true, clauses, logs);
      } else if (this.checkNull(clauses)) {
        this.index++;
      } else if (
        this.checkNumericExpression('<=', clauses) ||
        this.checkNumericExpression('>=', clauses) ||
        this.checkNumericExpression('<', clauses) ||
        this.checkNumericExpression('>', clauses) ||
        this.checkNumericExpression('!=', clauses) ||
        this.checkNumericExpression('=', clauses)
      ) {
        this.index += 2;
      } else if (this.checkSimpleNumber(clauses)) {
        this.index++;
      } else {
        logs.push({
          severity: 'error',
          message: 'Invalid expression',
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        this.index++;
      }
    }
    return {clauses: NumberParser.groupClauses(clauses), logs};
  }

  private static groupClauses(clauses: NumberClause[]): NumberClause[] {
    if (clauses.length < 2) {
      return clauses;
    }
    let previous: NumberClause | undefined = undefined;
    const outputs: NumberClause[] = [];
    for (let i = 0; i < clauses.length; i++) {
      const clause: NumberClause = clauses[i];
      if (clause.operator === 'range') {
        previous = undefined;
        outputs.push(clause);
      } else if (
        previous !== undefined &&
        previous.operator === clause.operator &&
        'values' in previous &&
        'values' in clause
      ) {
        previous.values.push(...clause.values);
      } else {
        previous = clause;
        outputs.push(clause);
      }
    }
    return outputs;
  }

  private matchTokens(candidates: string[]): boolean {
    return BaseParser.matchTokenTypes(candidates, this.index, this.tokens);
  }

  private checkRange(
    token: Token,
    negated: boolean,
    clauses: NumberClause[],
    logs: FilterLog[]
  ): NumberClause[] {
    if (this.matchTokens(['[', 'word', ',', 'word', ']'])) {
      return negated
        ? this.consumeRange('<', '>', clauses, logs)
        : this.consumeRange('>=', '<=', clauses, logs);
    } else if (this.matchTokens(['[', 'word', ',', 'word', ')'])) {
      return negated
        ? this.consumeRange('<', '>=', clauses, logs)
        : this.consumeRange('>=', '<', clauses, logs);
    } else if (this.matchTokens(['(', 'word', ',', 'word', ']'])) {
      return negated
        ? this.consumeRange('<=', '>', clauses, logs)
        : this.consumeRange('>', '<=', clauses, logs);
    } else if (this.matchTokens(['(', 'word', ',', 'word', ')'])) {
      return negated
        ? this.consumeRange('<=', '>=', clauses, logs)
        : this.consumeRange('>', '<', clauses, logs);
    } else {
      logs.push({
        severity: 'error',
        message: 'Invalid range expression',
        startIndex: token.startIndex,
        endIndex: token.endIndex,
      });
      this.index++;
    }
    return clauses;
  }

  private isRangeStart(position: number): boolean {
    if (position < 0 || position >= this.tokens.length) {
      return false;
    }
    const tokenType = this.tokens[position].type;
    return tokenType === '[' || tokenType === '(';
  }

  private static parseNumber(value: string): number {
    if (value.toUpperCase() === 'inf') {
      return Infinity;
    } else if (value.toUpperCase() === '-inf') {
      return -Infinity;
    } else {
      return Number(value);
    }
  }

  private static isValidNumber(value: number): boolean {
    return Number.isNaN(value) === false;
  }

  private consumeRange(
    startOperator: NumberRangeOperator,
    endOperator: NumberRangeOperator,
    clauses: NumberClause[],
    logs: FilterLog[]
  ): NumberClause[] {
    const startToken = this.getAt(this.index + 1);
    const endToken = this.getAt(this.index + 3);
    const startValue: number = NumberParser.parseNumber(startToken.value);
    const endValue: number = NumberParser.parseNumber(endToken.value);
    if (!NumberParser.isValidNumber(startValue)) {
      logs.push({
        severity: 'error',
        message: 'Invalid number',
        startIndex: startToken.startIndex,
        endIndex: startToken.endIndex,
      });
    } else if (!NumberParser.isValidNumber(endValue)) {
      logs.push({
        severity: 'error',
        message: 'Invalid number',
        startIndex: endToken.startIndex,
        endIndex: endToken.endIndex,
      });
    } else {
      const clause: NumberRange = {
        operator: 'range',
        startOperator: startOperator,
        startValue: startValue,
        endOperator: endOperator,
        endValue: endValue,
      };
      clauses.push(clause);
    }
    this.index += 5;
    return clauses;
  }

  private checkNumericExpression(
    tokenType: NumberOperator,
    clauses: NumberClause[]
  ): boolean {
    if (
      this.getNext().type === tokenType &&
      this.index < this.tokens.length - 1
    ) {
      const numericValue: number = NumberParser.parseNumber(
        this.getAt(this.index + 1).value
      );
      if (!NumberParser.isValidNumber(numericValue)) {
        return false;
      }
      const clause: NumberCondition = {
        operator: tokenType,
        values: [numericValue],
      };
      clauses.push(clause);
      return true;
    }
    return false;
  }

  private checkSimpleNumber(clauses: NumberClause[]): boolean {
    if (this.getNext().type === 'word') {
      const numericValue: number = NumberParser.parseNumber(
        this.getAt(this.index).value
      );
      if (!NumberParser.isValidNumber(numericValue)) {
        return false;
      }
      const clause: NumberCondition = {operator: '=', values: [numericValue]};
      clauses.push(clause);
      return true;
    }
    return false;
  }

  private checkNull(clauses: NumberClause[]): boolean {
    const type = this.getNext().type;
    if (type === 'null') {
      clauses.push({operator: 'null'});
      return true;
    } else if (type === 'not_null') {
      clauses.push({operator: 'not_null'});
      return true;
    }
    return false;
  }
}
