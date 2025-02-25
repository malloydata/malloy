/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Token} from './token_types';

export interface SpecialToken {
  type: string;
  value: string | RegExp;
  ignoreCase?: boolean; // This is only applicable for typeof value == string.  It is ignored for RegExp.
}

interface SpecialTokenMatch extends SpecialToken {
  matchedString: string; // The actual string in the input that matched SpecialToken.value.
}

export interface TokenizerParams {
  specialSubstrings: SpecialToken[]; // Applied to the raw string on the first pass.
  specialWords: SpecialToken[]; // Applied to the 'word' tokens as a second pass.
  combineAdjacentWords?: boolean;
  splitOnWhitespace?: boolean;
  trimWordWhitespace?: boolean;
  separators?: RegExp;
}

export class Tokenizer {
  private input: string;
  private index: number;
  private specialSubstrings: SpecialToken[]; // Applied to the raw string on the first pass.
  private specialWords: SpecialToken[]; // Applied to the 'word' tokens as a second pass.
  private params: TokenizerParams;

  constructor(input: string, params: TokenizerParams) {
    this.index = 0;
    this.specialSubstrings = params.specialSubstrings;
    this.specialWords = params.specialWords;
    this.params = params;
    this.input = input;
  }

  private tokenize(): Token[] {
    let tokens: Token[] = [];
    let wordStart = -1;
    let wordEnd = -1;
    let special: SpecialTokenMatch | undefined;
    while (this.hasMoreInput()) {
      if (this.params.splitOnWhitespace && this.isWhitespace(this.index)) {
        this.maybeConsumeWord(wordStart, wordEnd, tokens);
        wordStart = -1;
        this.consumeWhitespace();
      } else if (this.input[this.index] === '\\') {
        if (wordStart === -1) {
          wordStart = this.index;
        }
        wordEnd = this.index;
        this.index++;
        if (this.hasMoreInput()) {
          // Unless backslash is at the end, handle next char.
          wordEnd = this.index;
          this.index++;
        }
      } else if ((special = this.isSpecialSubstring())) {
        this.maybeConsumeWord(wordStart, wordEnd, tokens);
        wordStart = -1;
        this.consumeSpecialSubstring(special, tokens);
      } else {
        if (wordStart === -1) {
          wordStart = this.index;
        }
        wordEnd = this.index;
        this.index++;
      }
    }
    this.maybeConsumeWord(wordStart, wordEnd, tokens);

    tokens = Tokenizer.convertSpecialWords(tokens, this.specialWords);

    if (this.params.combineAdjacentWords) {
      tokens = Tokenizer.combineAdjacentWords(tokens);
    }
    if (this.params.trimWordWhitespace) {
      tokens = Tokenizer.trimWordWhitespace(tokens);
    }
    return tokens;
  }

  public parse(): Token[] {
    let tokens = this.tokenize();
    if (this.params.trimWordWhitespace) {
      tokens = Tokenizer.trimWordWhitespace(tokens);
    }
    return tokens;
  }

  private hasMoreInput(): boolean {
    return this.index < this.input.length;
  }

  private isWhitespace(idx: number): boolean {
    return /\s/.test(this.input[idx]);
  }

  private consumeWhitespace(): void {
    while (this.hasMoreInput() && this.isWhitespace(this.index)) {
      this.index++;
    }
  }
  private maybeConsumeWord(
    wordStart: number,
    wordEnd: number,
    tokens: Token[]
  ): void {
    if (wordStart >= 0 && wordEnd >= wordStart) {
      tokens.push({
        type: 'word',
        value: this.input.substring(wordStart, wordEnd + 1),
        startIndex: wordStart,
        endIndex: wordEnd + 1,
      });
    }
  }

  private isSpecialSubstring(): SpecialTokenMatch | undefined {
    for (const special of this.specialSubstrings) {
      if (special.value instanceof RegExp) {
        const shifted = this.input.substring(this.index); // create a substring starting at index.
        const matcher = special.value.exec(shifted);
        if (matcher) {
          return {
            type: special.type,
            value: special.value,
            matchedString: matcher[0],
          };
        }
      } else {
        const subString = this.input.slice(
          this.index,
          this.index + special.value.length
        );
        const matches = special.ignoreCase
          ? subString.toLowerCase() === special.value.toLowerCase()
          : subString === special.value;
        if (matches) {
          const value = special.ignoreCase
            ? subString.toLowerCase()
            : subString;
          return {
            type: special.type,
            value: special.value,
            matchedString: value,
          };
        }
      }
    }
    return undefined;
  }

  private consumeSpecialSubstring(
    special: SpecialTokenMatch,
    tokens: Token[]
  ): void {
    tokens.push({
      type: special.type,
      value: special.matchedString,
      startIndex: this.index,
      endIndex: this.index + special.matchedString.length,
    });
    this.index += special.matchedString.length;
  }

  public static combineAdjacentWords(tokens: Token[]): Token[] {
    const output: Token[] = [];
    let previousToken: Token | undefined = undefined;
    for (let i = 0; i < tokens.length; i++) {
      const currentToken: Token = tokens[i];
      if (
        currentToken.type === 'word' &&
        previousToken &&
        previousToken.type === 'word'
      ) {
        previousToken.value += currentToken.value;
        previousToken.endIndex = currentToken.endIndex;
      } else {
        output.push(currentToken);
      }
      previousToken = currentToken;
    }
    return output;
  }

  public static trimWordWhitespace(tokens: Token[]): Token[] {
    const output: Token[] = [];
    for (const token of tokens) {
      if (token.type === 'word') {
        token.value = token.value.trim();
      }
      output.push(token);
    }
    return output;
  }

  public static isSpecialWord(
    token: Token,
    specials: SpecialToken[]
  ): Token | undefined {
    for (const special of specials) {
      if (special.value instanceof RegExp) {
        const regexp = special.value;
        regexp.lastIndex = 0; // Set the starting index for the search
        if (regexp.test(token.value)) {
          const value = special.ignoreCase
            ? token.value.toLowerCase()
            : token.value;
          return {
            type: special.type,
            value: value,
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          };
        }
      } else {
        const matches = special.ignoreCase
          ? token.value.toLowerCase() === special.value.toLowerCase()
          : token.value === special.value;
        if (matches) {
          const value = special.ignoreCase
            ? token.value.toLowerCase()
            : token.value;
          return {
            type: special.type,
            value: value,
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          };
        }
      }
    }
    return undefined;
  }

  public static convertSpecialWords(
    tokens: Token[],
    specials: SpecialToken[]
  ): Token[] {
    const output: Token[] = [];
    let special: Token | undefined = undefined;
    for (const token of tokens) {
      if (
        token.type === 'word' &&
        (special = Tokenizer.isSpecialWord(token, specials))
      ) {
        output.push(special);
      } else {
        output.push(token);
      }
    }
    return output;
  }

  /**
   * Checks if the token types starting at the given index match the types in the input string.
   *
   * @param types - A string of types separated by '|'.  Eg 'TYPEA|TYPEB|TYPEC'
   * @param tokens - An array of tokens.
   * @param index - The index into the token array to start checking from.
   * @returns True if the token types match, false otherwise.
   */
  public static matchTypes(
    types: string,
    tokens: Token[],
    index: number
  ): Token[] | undefined {
    const typeArray = types.split('|');
    if (index < 0 || index + typeArray.length > tokens.length) {
      return undefined;
    }
    // Iterate over the types and check if they match the token types
    for (let i = 0; i < typeArray.length; i++) {
      if (index + i >= tokens.length) {
        return undefined;
      }
      if (tokens[index + i].type !== typeArray[i]) {
        return undefined;
      }
    }
    return tokens.slice(index, index + typeArray.length);
  }

  /**
   * Merges tokens that match a given type string into a single token with a specified merge type.
   *
   * @param types - A string of types separated by '|'.
   * @param tokens - An array of tokens.
   * @param mergeType - The type to use for the merged token.
   * @returns The updated token list with merged tokens.
   */
  public static mergeTypes(
    types: string,
    tokens: Token[],
    mergeType: string
  ): Token[] {
    const output: Token[] = [];
    let i = 0;
    while (i < tokens.length) {
      // Check if the current token matches the type string
      const matchedTokens = Tokenizer.matchTypes(types, tokens, i);
      if (matchedTokens && matchedTokens.length > 0) {
        const mergedToken: Token = {
          type: mergeType,
          value: '',
          values: matchedTokens,
          startIndex: matchedTokens[0].startIndex,
          endIndex: matchedTokens[matchedTokens.length - 1].endIndex,
        };
        output.push(mergedToken);
        i += matchedTokens.length;
      } else {
        output.push(tokens[i]);
        i++;
      }
    }
    return output;
  }
}
