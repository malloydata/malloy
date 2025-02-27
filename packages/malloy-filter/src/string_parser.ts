/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {
  StringClause,
  StringCondition,
  StringMatchOperator,
  StringConditionOperator,
  FilterLog,
  StringParserResponse,
} from './clause_types';
import {BaseParser} from './base_parser';

export class StringParser extends BaseParser {
  private static readonly percentRegex: RegExp = /(?<!\\)%/;
  private static readonly underscoreRegex: RegExp = /(?<!\\)_/;
  private static readonly percentStartRegex: RegExp = /^%/;
  private static readonly percentEndRegex: RegExp = /(?<!\\)%$/;
  private static readonly negatedStartRegex: RegExp = /^-(.+)$/;
  private static readonly singleBackslashRegex: RegExp = /(?<!\\)\\(?!\\)/g;

  // TODO: Replace the invalid tokens with support for conjunctive clauses.
  private static readonly invalidTokens: string[] = ['|', ';', '(', ')'];

  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    const specialSubstrings: SpecialToken[] = [
      {type: ',', value: ','},
      {
        type: StringParser.invalidTokens[0],
        value: StringParser.invalidTokens[0],
      },
      {
        type: StringParser.invalidTokens[1],
        value: StringParser.invalidTokens[1],
      },
      {
        type: StringParser.invalidTokens[2],
        value: StringParser.invalidTokens[2],
      },
      {
        type: StringParser.invalidTokens[3],
        value: StringParser.invalidTokens[3],
      },
    ];
    const specialWords: SpecialToken[] = [
      {type: 'null', value: 'null', ignoreCase: true},
      {type: 'empty', value: 'empty', ignoreCase: true},
      {type: 'not_null', value: '-null', ignoreCase: true},
      {type: 'not_empty', value: '-empty', ignoreCase: true},
    ];
    const params: TokenizerParams = {
      trimWordWhitespace: true,
      combineAdjacentWords: true,
      specialSubstrings,
      specialWords: specialWords,
    };

    const tokenizer = new Tokenizer(this.inputString, params);
    this.tokens = tokenizer.parse();
    this.tokens = Tokenizer.convertSpecialWords(this.tokens, specialWords);
  }

  public parse(): StringParserResponse {
    this.index = 0;
    this.tokenize();
    let clauses: StringClause[] = [];
    const logs: FilterLog[] = [];
    while (this.index < this.tokens.length) {
      const token = this.getNext();
      if (token.type === ',') {
        if (this.index > 0 && this.tokens[this.index - 1].type === ',') {
          logs.push({
            severity: 'warn',
            message: 'Empty clause',
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          });
        }
        this.index++;
      } else if (StringParser.invalidTokens.includes(token.type)) {
        logs.push({
          severity: 'error',
          message: 'Invalid unescaped token: ' + token.type,
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        this.index++;
      } else if (
        token.type === 'null' ||
        token.type === 'not_null' ||
        token.type === 'empty' ||
        token.type === 'not_empty'
      ) {
        clauses.push({operator: token.type});
        this.index++;
      } else if (this.checkSimpleWord(clauses)) {
        this.index++;
      } else {
        logs.push({
          severity: 'warn',
          message: 'Empty clause',
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        this.index++;
      }
    }
    clauses = StringParser.groupClauses(clauses);
    return {
      clauses,
      logs,
    };
  }

  private static groupClauses(clauses: StringClause[]): StringClause[] {
    if (clauses.length < 2) {
      return clauses;
    }
    let previous: StringClause = clauses[0];
    const outputs: StringClause[] = [previous];
    for (let i = 1; i < clauses.length; i++) {
      const current = clauses[i];
      if (
        previous.operator === current.operator &&
        'values' in previous &&
        'values' in current
      ) {
        previous.values.push(...current.values);
      } else if (
        previous.operator === current.operator &&
        'escaped_values' in previous &&
        'escaped_values' in current
      ) {
        previous.escaped_values.push(...current.escaped_values);
      } else {
        previous = current;
        outputs.push(current);
      }
    }
    return outputs;
  }

  private static percentInMiddle(word: string): boolean {
    if (word.length < 3) return false;
    word = word.substring(1, word.length - 1);
    return StringParser.percentRegex.test(word);
  }

  private static removeBackslashes(word: string): string {
    StringParser.singleBackslashRegex.lastIndex = 0;
    return word.replace(StringParser.singleBackslashRegex, _match => '');
  }

  private checkSimpleWord(clauses: StringClause[]): boolean {
    const token = this.getNext();
    if (token.type !== 'word') {
      return false;
    }
    const negatedMatch = StringParser.negatedStartRegex.exec(token.value);
    let word = negatedMatch ? negatedMatch[1] : token.value;

    const isPercentStart = StringParser.percentStartRegex.test(word);
    const isPercentEnd = StringParser.percentEndRegex.test(word);
    const isPercentBoth = isPercentStart && isPercentEnd;
    const isUnderscore = StringParser.underscoreRegex.test(word);
    const isPercentMiddle = StringParser.percentInMiddle(word);

    let operator: StringConditionOperator = negatedMatch ? '!=' : '=';
    if (isUnderscore || isPercentMiddle || (isPercentBoth && word.length < 3)) {
      // Special handling for string match
      const matchOperator: StringMatchOperator = negatedMatch ? '!~' : '~';
      if (word.length === 0) {
        return false;
      }
      clauses.push({operator: matchOperator, escaped_values: [word]});
      return true;
    } else if (isPercentBoth && word.length > 2) {
      operator = negatedMatch ? 'not_contains' : 'contains';
      word = word.substring(1, word.length - 1);
    } else if (isPercentStart) {
      operator = negatedMatch ? 'not_ends' : 'ends';
      word = word.substring(1, word.length);
    } else if (isPercentEnd) {
      operator = negatedMatch ? 'not_starts' : 'starts';
      word = word.substring(0, word.length - 1);
    } else {
      // = or !=
    }
    word = StringParser.removeBackslashes(word);
    if (word.length === 0) {
      return false;
    }

    const clause: StringCondition = {operator: operator, values: [word]};
    clauses.push(clause);
    return true;
  }
}
