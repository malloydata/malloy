import {Token} from './token_types';

export abstract class BaseParser {
  protected inputString: string;
  protected index: number;
  protected tokens: Token[];

  constructor(inputString: string) {
    this.index = 0;
    this.tokens = [];
    this.inputString = inputString;
  }

  public getTokens(): Token[] {
    return this.tokens;
  }

  protected getAt(index: number): Token {
    return this.tokens[index];
  }

  protected getNext(): Token {
    return this.getAt(this.index);
  }

  protected static matchTokenTypes(
    candidates: string[],
    index: number,
    tokens: Token[]
  ): boolean {
    const maxIndex = index + candidates.length;
    if (index < 0 || maxIndex > tokens.length) {
      return false;
    }
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i] !== tokens[i + index].type) {
        return false;
      }
    }
    return true;
  }
}
