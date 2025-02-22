import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {
  BooleanClause,
  BooleanOperator,
  BooleanParserResponse,
  FilterError,
} from './clause_types';
import {BaseParser} from './base_parser';

export class BooleanParser extends BaseParser {
  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    const specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
    const specialWords: SpecialToken[] = [
      {type: 'NULL', value: 'null', ignoreCase: true},
      {type: 'NOTNULL', value: '-null', ignoreCase: true},
      {type: 'TRUE', value: 'true', ignoreCase: true},
      {type: 'FALSE', value: 'false', ignoreCase: true},
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
    const errors: FilterError[] = [];
    while (this.index < this.tokens.length) {
      const token = this.getNext();
      if (token.type === ',') {
        this.index++;
      } else if (
        token.type === 'NULL' ||
        token.type === 'TRUE' ||
        token.type === 'FALSE' ||
        token.type === 'NOTNULL'
      ) {
        const clause: BooleanClause = {operator: token.type as BooleanOperator};
        clauses.push(clause);
        this.index++;
      } else {
        errors.push({
          message: 'Invalid token ' + token.value,
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        this.index++;
      }
    }
    return {clauses, errors};
  }
}
