/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface TinyToken {
  type: string;
  text: string;
}

/**
 * Simple framework for writing schema parsers. The parsers using this felt
 * better than the more ad-hoc code they replaced, and are smaller than
 * using a parser generator.
 *
 * NOTE: All parse errors are exceptions.
 */
export class TinyParser {
  private tokens: Generator<TinyToken>;
  private parseCursor = 0;
  private lookAhead?: TinyToken;
  private tokenMap: Record<string, RegExp>;

  /**
   * The token map is tested in order. Return TinyToken
   * is {type: tokenMapKey, text: matchingText }, except
   * for the special tokenMapKeys:
   * * space: skipped and never returned
   * * char: matched string return in both .type and .text
   * * q*: any token name starting with 'q' is assumed to be
   *   a quoted string and the text will have the first and
   *   last characters stripped
   */
  constructor(
    readonly input: string,
    tokenMap?: Record<string, RegExp>
  ) {
    this.tokens = this.tokenize(input);
    this.tokenMap = tokenMap ?? {
      space: /^\s+/,
      char: /^[,:[\]()-]/,
      id: /^\w+/,
      qstr: /^"\w+"/,
    };
  }

  parseError(str: string) {
    const errText =
      `INTERNAL ERROR parsing schema: ${str}\n` +
      `${this.input}\n` +
      `${' '.repeat(this.parseCursor)}^`;
    return new Error(errText);
  }

  peek(): TinyToken {
    if (this.lookAhead) {
      return this.lookAhead;
    } else {
      const {value} = this.tokens.next();
      const peekVal = value ?? {type: 'eof', text: ''};
      this.lookAhead = peekVal;
      return peekVal;
    }
  }

  private getNext(): TinyToken {
    const next = this.lookAhead ?? this.peek();
    this.lookAhead = undefined;
    return next;
  }

  /**
   * Return next token, if any token types are passed, read and require those
   * tokens, then return the last one.
   * @param types list of token types
   * @returns The last token read
   */
  next(...types: string[]): TinyToken {
    if (types.length === 0) return this.getNext();
    let next: TinyToken | undefined = undefined;
    let expected = types[0];
    for (const typ of types) {
      next = this.getNext();
      expected = typ;
      if (next.type !== typ) {
        next = undefined;
        break;
      }
    }
    if (next) return next;
    throw this.parseError(`Expected ${expected}`);
  }

  skipTo(type: string) {
    for (;;) {
      const next = this.next();
      if (next.type === 'eof') {
        throw this.parseError(`Expected token '${type}`);
      }
      if (next.type === type) {
        return;
      }
    }
  }

  private *tokenize(src: string): Generator<TinyToken> {
    const tokenList = this.tokenMap;
    while (this.parseCursor < src.length) {
      let notFound = true;
      for (const tokenType in tokenList) {
        const srcAtCursor = src.slice(this.parseCursor);
        const foundToken = srcAtCursor.match(tokenList[tokenType]);
        if (foundToken) {
          notFound = false;
          let tokenText = foundToken[0];
          this.parseCursor += tokenText.length;
          if (tokenType !== 'space') {
            if (tokenType[0] === 'q') {
              tokenText = tokenText.slice(1, -1); // strip quotes
            }
            yield {
              type: tokenType === 'char' ? tokenText : tokenType,
              text: tokenText,
            };
          }
        }
      }
      if (notFound) {
        yield {type: 'unexpected token', text: src};
        return;
      }
    }
  }
}
