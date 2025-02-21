import {FilterError, FilterParserResponse} from './filter_types';
import {Token} from './token_types';
import {BooleanParser} from './boolean_parser';
import {StringParser} from './string_parser';
import {NumberParser} from './number_parser';
import {DateParser} from './date_parser';
import {BaseParser} from './base_parser';

export type FilterType = 'boolean' | 'number' | 'string' | 'date';

export class FilterParser {
  constructor(
    private input: string,
    private type: FilterType
  ) {
    this.input = input;
    this.type = type;
  }

  private initParser(): BaseParser {
    switch (this.type) {
      case 'boolean':
        return new BooleanParser(this.input);
      case 'number':
        return new NumberParser(this.input);
      case 'string':
        return new StringParser(this.input);
      case 'date':
        return new DateParser(this.input);
    }
  }

  /* eslint-disable no-console */
  public getTokens(): Token[] {
    let tokens: Token[] = [];
    try {
      const parser = this.initParser();
      tokens = parser.getTokens();
    } catch (ex: Error | unknown) {
      if (ex instanceof Error) console.error('Error: ', ex.message, '\n');
      else {
        console.error('Unknown error: ', ex, '\n');
      }
    }
    return tokens;
  }
  /* eslint-enable no-console */

  private makeErrorMessage(message: string): FilterError {
    return {message, startIndex: 0, endIndex: this.input.length};
  }

  public parse(): FilterParserResponse {
    try {
      const parser = this.initParser();
      return parser.parse();
    } catch (ex: Error | unknown) {
      if (ex instanceof Error) {
        return {clauses: [], errors: [this.makeErrorMessage(ex.message)]};
      } else {
        return {
          clauses: [],
          errors: [this.makeErrorMessage('Unknown error ' + ex)],
        };
      }
    }
  }
}
