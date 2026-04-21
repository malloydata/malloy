/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface TinyToken {
  cursor: number;
  type: string;
  text: string;
}

/**
 * Tiny combined lexer/parser for short recursive-descent parsers.
 *
 * TinyParser is intentionally small and biased toward readability over
 * framework features. It is primarily used for schema and type parsers where
 * a hand-written parser is clearer than ad-hoc regex matching, but a parser
 * generator would be overkill.
 *
 * Design goals:
 * - Keep parser implementations short and readable.
 * - Support custom tokenization rules per parser.
 * - Make parser intent obvious at call sites.
 * - Minimize hidden consumption and parser-state surprises.
 *
 * Core parser API:
 * - peek(): inspect the next token without consuming it.
 * - read(): consume and return the next token, regardless of type.
 * - eof(): true if the next token is end-of-input.
 * - expect(...types): consume a required sequence of token types.
 * - expectText(...texts): consume a required sequence of token texts.
 * - match(...types): consume an optional sequence of token types.
 * - matchText(...texts): consume an optional sequence of token texts.
 *
 * Semantics:
 * - expect*() is for required grammar and throws on failure.
 * - match*() is for optional grammar and is atomic. If the full sequence does
 *   not match, nothing is consumed.
 * - peek() remains available, but most optional syntax should prefer match*().
 *
 * Token rules are tested in order. The first matching rule wins.
 *
 * Special token rule names:
 * - space: matched text is skipped and never returned.
 * - char: matched text becomes both token.type and token.text.
 * - q*: any token name starting with q is treated as quoted text and has its
 *   first and last characters stripped from token.text.
 *
 * NOTE: All parse errors are exceptions.
 */
export class TinyParseError extends Error {}
export class TinyParser {
  private readonly tokens: TinyToken[] = [];
  private tokenCursor = 0;
  private scanCursor = 0;
  private scanState: 'scanning' | 'afterUnexpected' | 'done' = 'scanning';
  protected parseCursor = 0;
  private readonly tokenMap: Record<string, RegExp>;

  /**
   * The token map is tested in order and the first matching rule wins.
   */
  constructor(
    readonly input: string,
    tokenMap?: Record<string, RegExp>
  ) {
    this.tokenMap = tokenMap ?? {
      space: /^\s+/,
      char: /^[,:[\]()-]/,
      id: /^\w+/,
      qstr: /^"\w+"/,
    };
  }

  parseError(str: string) {
    this.parseCursor = this.peek().cursor;
    const errText =
      `INTERNAL ERROR parsing schema: ${str}\n` +
      `${this.input}\n` +
      `${' '.repeat(this.parseCursor)}^`;
    return new TinyParseError(errText);
  }

  peek(): TinyToken {
    return this.peekAt(0);
  }

  read(): TinyToken {
    return this.consume();
  }

  eof(): boolean {
    return this.peek().type === 'eof';
  }

  private peekAt(offset: number): TinyToken {
    this.fillBufferTo(this.tokenCursor + offset);
    const token = this.tokens[this.tokenCursor + offset] ?? this.eofToken();
    this.parseCursor = token.cursor;
    return token;
  }

  /**
   * Return next token, if any token types are passed, read and require those
   * tokens, then return the last one.
   * @param types list of token types
   * @returns The last token read
   */
  expect(...types: string[]): TinyToken {
    if (types.length === 0) {
      throw new Error('TinyParser.expect() requires at least one token type');
    }
    let next: TinyToken | undefined;
    for (const typ of types) {
      next = this.peek();
      if (next.type !== typ) {
        throw this.parseError(`Expected token type '${typ}'`);
      }
      this.consume();
    }
    return next!;
  }

  expectText(...texts: string[]): TinyToken {
    if (texts.length === 0) {
      throw new Error(
        'TinyParser.expectText() requires at least one token text'
      );
    }
    let next: TinyToken | undefined;
    for (const txt of texts) {
      next = this.peek();
      if (next.text.toUpperCase() !== txt.toUpperCase()) {
        throw this.parseError(`Expected '${txt}'`);
      }
      this.consume();
    }
    return next!;
  }

  match(...types: string[]): TinyToken | undefined {
    if (types.length === 0) {
      throw new Error('TinyParser.match() requires at least one token type');
    }
    for (let index = 0; index < types.length; index += 1) {
      if (this.peekAt(index).type !== types[index]) {
        return undefined;
      }
    }
    return this.consume(types.length);
  }

  matchText(...texts: string[]): TinyToken | undefined {
    if (texts.length === 0) {
      throw new Error(
        'TinyParser.matchText() requires at least one token text'
      );
    }
    for (let index = 0; index < texts.length; index += 1) {
      if (
        this.peekAt(index).text.toUpperCase() !== texts[index].toUpperCase()
      ) {
        return undefined;
      }
    }
    return this.consume(texts.length);
  }

  skipTo(type: string) {
    for (;;) {
      const next = this.read();
      if (next.type === 'eof') {
        throw this.parseError(`Expected token '${type}`);
      }
      if (next.type === type) {
        return;
      }
    }
  }

  dump(): TinyToken[] {
    const parts: TinyToken[] = [];
    let cursor = 0;
    let state: 'scanning' | 'afterUnexpected' | 'done' = 'scanning';
    while (state !== 'done') {
      const {token, nextCursor, nextState} = this.scanToken(cursor, state);
      if (token.type === 'eof') {
        break;
      }
      parts.push(token);
      cursor = nextCursor;
      state = nextState;
    }
    return parts;
  }

  private fillBufferTo(index: number) {
    while (this.tokens.length <= index) {
      this.tokens.push(this.readNextToken());
    }
  }

  private consume(count = 1): TinyToken {
    let token = this.peek();
    for (let index = 0; index < count; index += 1) {
      token = this.peek();
      this.tokenCursor += 1;
    }
    this.parseCursor = this.peek().cursor;
    return token;
  }

  private readNextToken(): TinyToken {
    const {token, nextCursor, nextState} = this.scanToken(
      this.scanCursor,
      this.scanState
    );
    this.scanCursor = nextCursor;
    this.scanState = nextState;
    return token;
  }

  private scanToken(
    cursor: number,
    state: 'scanning' | 'afterUnexpected' | 'done'
  ): {
    token: TinyToken;
    nextCursor: number;
    nextState: 'scanning' | 'afterUnexpected' | 'done';
  } {
    if (state === 'done') {
      return {
        token: this.eofToken(),
        nextCursor: this.input.length,
        nextState: 'done',
      };
    }
    if (state === 'afterUnexpected' || cursor >= this.input.length) {
      return {
        token: this.eofToken(),
        nextCursor: this.input.length,
        nextState: 'done',
      };
    }

    let nextCursor = cursor;
    while (nextCursor < this.input.length) {
      const srcAtCursor = this.input.slice(nextCursor);
      let matched = false;
      for (const tokenType in this.tokenMap) {
        const foundToken = srcAtCursor.match(this.tokenMap[tokenType]);
        if (foundToken) {
          matched = true;
          let tokenText = foundToken[0];
          const tokenCursor = nextCursor;
          nextCursor += tokenText.length;
          if (tokenType === 'space') {
            break;
          }
          if (tokenType[0] === 'q') {
            tokenText = tokenText.slice(1, -1);
          }
          return {
            token: {
              cursor: tokenCursor,
              type: tokenType === 'char' ? tokenText : tokenType,
              text: tokenText,
            },
            nextCursor,
            nextState: 'scanning',
          };
        }
      }
      if (!matched) {
        return {
          token: {
            cursor: nextCursor,
            type: 'unexpected token',
            text: this.input,
          },
          nextCursor: this.input.length,
          nextState: 'afterUnexpected',
        };
      }
    }

    return {
      token: this.eofToken(),
      nextCursor: this.input.length,
      nextState: 'done',
    };
  }

  private eofToken(): TinyToken {
    return {cursor: this.input.length, type: 'eof', text: ''};
  }
}
