import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {
  DateRange,
  DatePrefix,
  DateMoment,
  DateMomentNow,
  DateMomentInterval,
  DateMomentNumberInterval,
  DateMomentNumberUnit,
  DateMomentNumber,
  DateTimeUnit,
  DateWeekday,
  DateMomentIntervalOperator,
  DateMomentNumberIntervalOperator,
  DateMomentNumberUnitOperator,
  DateMomentNumberOperator,
  DateMomentNowOperator,
  DateClause,
  Clause,
} from './clause_types';
import {BaseParser} from './base_parser';
import {Token} from './token_types';
import {FilterParserResponse, FilterError} from './filter_types';

interface MergedToken extends Token {
  moment?: DateMoment;
}

export class DateParser extends BaseParser {
  private static readonly yearRegex: RegExp = /[%_]/;
  private static readonly negatedStartRegex: RegExp = /^-(.+)$/;

  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    let specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
    let specialWords: SpecialToken[] = [
      {
        type: 'UNITOFTIME',
        value: /^(second|minute|hour|day|week|month|quarter|year)s?$/i,
        ignoreCase: true,
      },
      {
        type: 'DAYOFWEEK',
        value: /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
        ignoreCase: true,
      },
      {type: 'DATE', value: /^\d\d\d\d\-\d\d\-\d\d$/},
      {type: 'DATE', value: /^\d\d\d\d\-\d\d$/},
      {type: 'TIME', value: /^\d\d:\d\d:\d\d\.\d+$/},
      {type: 'TIME', value: /^\d\d:\d\d:\d\d$/},
      {type: 'TIME', value: /^\d\d:\d\d$/},
      {type: 'NOTNULL', value: '-null', ignoreCase: true},
      {type: 'NULL', value: 'null', ignoreCase: true},
      {type: 'PREFIX', value: /^(before|after)/i, ignoreCase: true},
      {type: 'TODAY', value: 'today', ignoreCase: true},
      {type: 'YESTERDAY', value: 'yesterday', ignoreCase: true},
      {type: 'TOMORROW', value: 'tomorrow', ignoreCase: true},
      {type: 'NOW', value: 'now', ignoreCase: true},
      {type: 'THIS', value: 'this', ignoreCase: true},
      {type: 'LAST', value: 'last', ignoreCase: true},
      {type: 'NEXT', value: 'next', ignoreCase: true},
      {type: 'AGO', value: 'ago', ignoreCase: true},
      {type: 'FROM', value: 'from', ignoreCase: true},
      {type: 'FOR', value: 'for', ignoreCase: true},
      {type: 'TO', value: 'to', ignoreCase: true},
      {type: 'YEARORNUMBER', value: /^\d\d\d\d$/}, // Years are ambiguous, and require special handling.
      {type: 'NUMBER', value: /^[\d\.]+/, ignoreCase: true},
    ];
    const params: TokenizerParams = {
      trimWordWhitespace: true,
      splitOnWhitespace: true,
      specialSubstrings,
      specialWords,
    };

    const tokenizer = new Tokenizer(this.inputString, params);
    this.tokens = tokenizer.parse();
    // console.log('Tokens before moments ', ...this.tokens);
    this.tokens = this.mergeMomentTokens();
  }

  private mergeMomentTokens(): Token[] {
    let output: Token[] = [];
    this.index = 0;
    while (this.index < this.tokens.length) {
      if (
        this.matchAndMerge('LAST|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge('LAST|DAYOFWEEK', this.tokens, output) ||
        this.matchAndMerge('LAST|NUMBER|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge(
          'LAST|YEARORNUMBER|UNITOFTIME',
          this.tokens,
          output
        ) ||
        this.matchAndMerge('THIS|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge('NEXT|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge('NEXT|DAYOFWEEK', this.tokens, output) ||
        this.matchAndMerge('NEXT|NUMBER|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge(
          'NEXT|YEARORNUMBER|UNITOFTIME',
          this.tokens,
          output
        ) ||
        this.matchAndMerge('NUMBER|UNITOFTIME|AGO', this.tokens, output) ||
        this.matchAndMerge(
          'YEARORNUMBER|UNITOFTIME|AGO',
          this.tokens,
          output
        ) ||
        this.matchAndMerge('NUMBER|UNITOFTIME|FROM|NOW', this.tokens, output) ||
        this.matchAndMerge(
          'YEARORNUMBER|UNITOFTIME|FROM|NOW',
          this.tokens,
          output
        ) ||
        this.matchAndMerge('NUMBER|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge('YEARORNUMBER|UNITOFTIME', this.tokens, output) ||
        this.matchAndMerge('DATE|TIME', this.tokens, output) ||
        this.matchAndMerge('TODAY', this.tokens, output) ||
        this.matchAndMerge('YESTERDAY', this.tokens, output) ||
        this.matchAndMerge('TOMORROW', this.tokens, output) ||
        this.matchAndMerge('DATE', this.tokens, output) ||
        this.matchAndMerge('YEARORNUMBER', this.tokens, output) ||
        this.matchAndMerge('NOW', this.tokens, output)
      ) {
        continue;
      } else {
        output.push(this.tokens[this.index]);
        this.index++;
      }
    }
    return output;
  }

  private matchAndMerge(
    types: string,
    tokens: Token[],
    output: Token[]
  ): boolean {
    const idx = this.index;
    const matchedTokens = Tokenizer.matchTypes(types, tokens, idx);
    if (matchedTokens) {
      output.push({
        type: 'MOMENT:' + types,
        value: '',
        values: matchedTokens,
        startIndex: matchedTokens[0].startIndex,
        endIndex: matchedTokens[matchedTokens.length - 1].endIndex,
      });
      this.index += matchedTokens.length;
      return true;
    }
    return false;
  }

  public parse(): FilterParserResponse {
    this.tokenize();
    let prefix: DatePrefix | undefined = undefined;
    let clauses: DateClause[] = [];
    let errors: FilterError[] = [];
    this.index = 0;
    while (this.index < this.tokens.length) {
      let token = this.getNext();
      if (token.type === ',') {
        if (prefix) {
          errors.push({
            message: 'Invalid ' + prefix,
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          });
        }
        this.index++;
      } else if (token.type === 'PREFIX') {
        prefix = token.value as DatePrefix;
        this.index++;
      } else if (this.handleRange(clauses)) {
        if (prefix) {
          errors.push({
            message: 'Invalid ' + prefix,
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          });
          this.index++;
        }
      } else if (this.handleMoment(prefix, clauses)) {
        prefix = undefined;
      } else {
        errors.push({
          message: 'Invalid token ' + token.value,
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        prefix = undefined;
        this.index++;
      }
    }
    return {clauses, errors};
  }

  // LAST|DAYOFWEEK
  private static createMomentInterval(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentInterval {
    const operator: DateMomentIntervalOperator = tokens[0]
      .type as DateMomentIntervalOperator;
    const unit: DateTimeUnit | DateWeekday = tokens[1].value as
      | DateTimeUnit
      | DateWeekday;
    let moment: DateMomentInterval = {operator, unit};
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  // LAST|NUMBER|UNITOFTIME
  private static createMomentNumberInterval(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentNumberInterval {
    const type0 = tokens[0].type;
    const operator: DateMomentNumberIntervalOperator =
      type0 === 'LAST' ? 'LASTN' : 'NEXTN';
    const value: string = tokens[1].value;
    const unit: DateTimeUnit = tokens[2].value as DateTimeUnit;
    let moment: DateMomentNumberInterval = {operator, value, unit};
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  // NUMBER|UNITOFTIME|AGO
  private static createMomentNumberIntervalAgo(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentNumberInterval {
    const operator: DateMomentNumberIntervalOperator = 'AGO';
    const value: string = tokens[0].value;
    const unit: DateTimeUnit = tokens[1].value as DateTimeUnit;
    let moment: DateMomentNumberInterval = {operator, value, unit};
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  // NUMBER|UNITOFTIME|FROM|NOW
  private static createMomentNumberIntervalFromNow(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentNumberInterval | undefined {
    const operator: DateMomentNumberIntervalOperator = 'FROMNOW';
    const value: string = tokens[0].value;
    const unit: DateTimeUnit = tokens[1].value as DateTimeUnit;
    let moment: DateMomentNumberInterval = {operator, value, unit};
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  // NUMBER|UNITOFTIME
  private static createMomentNumberUnit(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentNumberUnit {
    const operator: DateMomentNumberUnitOperator = 'TIMEBLOCK';
    const value: string = tokens[0].value;
    const unit: DateTimeUnit = tokens[1].value as DateTimeUnit;
    let moment: DateMomentNumberUnit = {operator, value, unit};
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  // DATE  DATE|TIME
  private static createMomentNumber(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentNumber {
    const operator: DateMomentNumberOperator =
      tokens.length == 2 ? 'DATETIME' : 'DATE';
    let moment: DateMomentNumber = {operator, date: tokens[0].value};
    if (tokens.length == 2) {
      moment.time = tokens[1].value;
    }
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  // NOW  YESTERDAY  TODAY  TOMORROW
  private static createMomentNow(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateMomentNow {
    const operator: DateMomentNowOperator = tokens[0]
      .type as DateMomentNowOperator;
    let moment: DateMomentNow = {operator};
    if (prefix) {
      moment.prefix = prefix;
    }
    return moment;
  }

  private static createMomentFromToken(
    prefix: DatePrefix | undefined,
    token: Token
  ): DateMoment | undefined {
    const tokens: Token[] = token.values || [];
    switch (token.type) {
      case 'MOMENT:LAST|UNITOFTIME':
      case 'MOMENT:LAST|DAYOFWEEK':
      case 'MOMENT:THIS|UNITOFTIME':
      case 'MOMENT:NEXT|UNITOFTIME':
      case 'MOMENT:NEXT|DAYOFWEEK':
        return this.createMomentInterval(prefix, tokens);
      case 'MOMENT:LAST|NUMBER|UNITOFTIME':
      case 'MOMENT:LAST|YEARORNUMBER|UNITOFTIME':
      case 'MOMENT:NEXT|NUMBER|UNITOFTIME':
      case 'MOMENT:NEXT|YEARORNUMBER|UNITOFTIME':
        return this.createMomentNumberInterval(prefix, tokens);
      case 'MOMENT:NUMBER|UNITOFTIME|AGO':
      case 'MOMENT:YEARORNUMBER|UNITOFTIME|AGO':
        return this.createMomentNumberIntervalAgo(prefix, tokens);
      case 'MOMENT:NUMBER|UNITOFTIME|FROM|NOW':
      case 'MOMENT:YEARORNUMBER|UNITOFTIME|FROM|NOW':
        return this.createMomentNumberIntervalFromNow(prefix, tokens);
      case 'MOMENT:NUMBER|UNITOFTIME':
      case 'MOMENT:YEARORNUMBER|UNITOFTIME':
        return this.createMomentNumberUnit(prefix, tokens);
      case 'MOMENT:DATE|TIME':
      case 'MOMENT:DATE':
      case 'MOMENT:YEARORNUMBER':
        return this.createMomentNumber(prefix, tokens);
      case 'MOMENT:NOW':
      case 'MOMENT:TODAY':
      case 'MOMENT:YESTERDAY':
      case 'MOMENT:TOMORROW':
        return this.createMomentNow(prefix, tokens);
      default:
        return undefined;
    }
  }

  private isMatchingToken(
    position: number,
    value: string,
    exactMatch: boolean
  ): boolean {
    if (position < 0 || position >= this.tokens.length) {
      return false;
    }
    return exactMatch
      ? this.tokens[position].type === value
      : this.tokens[position].type.startsWith(value);
  }

  private handleRange(clauses: Clause[]): boolean {
    if (
      this.isMatchingToken(this.index, 'MOMENT', false) &&
      (this.isMatchingToken(this.index + 1, 'TO', true) ||
        this.isMatchingToken(this.index + 1, 'FOR', true)) &&
      this.isMatchingToken(this.index + 2, 'MOMENT', false)
    ) {
      const startMoment: DateMoment | undefined =
        DateParser.createMomentFromToken(undefined, this.tokens[this.index]);
      const endMoment: DateMoment | undefined =
        DateParser.createMomentFromToken(
          undefined,
          this.tokens[this.index + 2]
        );
      const operator: 'TO' | 'FOR' = this.tokens[this.index + 1].type as
        | 'TO'
        | 'FOR';
      this.index += 3;
      if (startMoment === undefined || endMoment === undefined) {
        return false;
      }
      const dateRange: DateRange = {
        start: startMoment,
        operator,
        end: endMoment,
      };
      clauses.push(dateRange);
      return true;
    }
    return false;
  }

  private handleMoment(
    prefix: DatePrefix | undefined,
    clauses: DateClause[]
  ): boolean {
    const token: Token = this.getNext();
    if (token.type.startsWith('MOMENT')) {
      const clause: DateMoment | undefined = DateParser.createMomentFromToken(
        prefix,
        token
      );
      this.index++;
      if (clause === undefined) {
        return false;
      }
      clauses.push(clause);
      return true;
    }
    return false;
  }
}
