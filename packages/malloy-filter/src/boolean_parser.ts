/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {BooleanClause, BooleanParserResponse, FilterLog} from './clause_types';
import {BaseParser} from './base_parser';

export class BooleanParser extends BaseParser {
  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    const specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
    const specialWords: SpecialToken[] = [
      {type: 'null', value: 'null', ignoreCase: true},
      {type: 'not_null', value: '-null', ignoreCase: true},
      {type: 'true', value: 'true', ignoreCase: true},
      {type: 'false', value: '=false', ignoreCase: true},
      {type: 'false_or_null', value: 'false', ignoreCase: true},
    ];
    const params: TokenizerParams = {
      trimWordWhitespace: true,
      splitOnWhitespace: true,
      specialSubstrings,
      specialWords: specialWords,
    };

    const tokenizer = new Tokenizer(this.inputString, params);
    this.tokens = tokenizer.parse();
    this.tokens = Tokenizer.convertSpecialWords(this.tokens, specialWords);
  }

  public parse(): BooleanParserResponse {
    this.index = 0;
    this.tokenize();
    const clauses: BooleanClause[] = [];
    const logs: FilterLog[] = [];
    while (this.index < this.tokens.length) {
      const token = this.getNext();
      if (token.type === ',') {
        this.index++;
      } else if (
        token.type === 'null' ||
        token.type === 'true' ||
        token.type === 'false' ||
        token.type === 'false_or_null' ||
        token.type === 'not_null'
      ) {
        const clause: BooleanClause = {operator: token.type};
        clauses.push(clause);
        this.index++;
      } else {
        logs.push({
          severity: 'error',
          message: 'Invalid token ' + token.value,
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        this.index++;
      }
    }
    return {clauses, logs};
  }
}
