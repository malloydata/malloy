import {SpecialToken, Tokenizer, TokenizerParams} from './tokenizer';
import {
  DateTimeUnit,
  DateWeekday,
  DateMomentName,
  NamedMoment,
  DateMomentIntervalOperator,
  IntervalMoment,
  DateMomentOffsetFromNowDirection,
  OffsetMoment,
  DateMomentSpanFromNowDirection,
  SpanMoment,
  AbsoluteMoment,
  DateMoment,
  DateBetweenClause,
  Duration,
  DateForClause,
  DateDurationClause,
  DateClause,
  DateParserResponse,
} from './date_types';
import {BaseParser} from './base_parser';
import {Token} from './token_types';
import {FilterError} from './clause_types';

type DatePrefix = 'BEFORE' | 'AFTER';

export class DateParser extends BaseParser {
  private static readonly yearRegex: RegExp = /[%_]/;
  private static readonly negatedStartRegex: RegExp = /^-(.+)$/;

  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    const specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
    const specialWords: SpecialToken[] = [
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
      {type: 'DATE', value: /^\d\d\d\d-\d\d-\d\d$/},
      {type: 'DATE', value: /^\d\d\d\d-\d\d$/},
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
      {type: 'YEAR', value: /^\d\d\d\d$/}, // Years are ambiguous, and require special handling.
      {type: 'NUMBER', value: /^[\d.]+/, ignoreCase: true},
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
    const output: Token[] = [];
    this.index = 0;
    while (this.index < this.tokens.length) {
      if (
        this.matchAndMerge('LAST|UNITOFTIME', output) ||
        this.matchAndMerge('LAST|DAYOFWEEK', output) ||
        this.matchAndMerge('LAST|NUMBER|UNITOFTIME', output) ||
        this.matchAndMerge('LAST|YEAR|UNITOFTIME', output) ||
        this.matchAndMerge('THIS|UNITOFTIME', output) ||
        this.matchAndMerge('NEXT|UNITOFTIME', output) ||
        this.matchAndMerge('NEXT|DAYOFWEEK', output) ||
        this.matchAndMerge('NEXT|NUMBER|UNITOFTIME', output) ||
        this.matchAndMerge('NEXT|YEAR|UNITOFTIME', output) ||
        this.matchAndMerge('NUMBER|UNITOFTIME|AGO', output) ||
        this.matchAndMerge('YEAR|UNITOFTIME|AGO', output) ||
        this.matchAndMerge('NUMBER|UNITOFTIME|FROM|NOW', output) ||
        this.matchAndMerge('YEAR|UNITOFTIME|FROM|NOW', output) ||
        this.matchAndMerge('NUMBER|UNITOFTIME', output) ||
        this.matchAndMerge('YEAR|UNITOFTIME', output) ||
        this.matchAndMerge('DATE|TIME', output) ||
        this.matchAndMerge('TODAY', output) ||
        this.matchAndMerge('YESTERDAY', output) ||
        this.matchAndMerge('TOMORROW', output) ||
        this.matchAndMerge('DATE', output) ||
        this.matchAndMerge('YEAR', output) ||
        this.matchAndMerge('NOW', output)
      ) {
        continue;
      } else {
        output.push(this.tokens[this.index]);
        this.index++;
      }
    }
    return output;
  }

  private matchAndMerge(types: string, output: Token[]): boolean {
    const idx = this.index;
    const matchedTokens = Tokenizer.matchTypes(types, this.tokens, idx);
    if (matchedTokens) {
      output.push({
        type: 'MERGE:' + types,
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

  public parse(): DateParserResponse {
    this.tokenize();
    let prefix: DatePrefix | undefined = undefined;
    const clauses: DateClause[] = [];
    const errors: FilterError[] = [];
    this.index = 0;
    while (this.index < this.tokens.length) {
      const token = this.getNext();
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
      } else if (this.handleMerged(prefix, clauses)) {
        prefix = undefined;
      } else if (token.type === 'NULL' || token.type === 'NOTNULL') {
        prefix = undefined;
        clauses.push({operator: token.type});
        this.index++;
      } else {
        errors.push({
          message:
            'Invalid token ' + token.value ||
            (token.values ? token.values.join(' ') : ''),
          startIndex: token.startIndex,
          endIndex: token.endIndex,
        });
        prefix = undefined;
        this.index++;
      }
    }
    return {clauses, errors};
  }

  private static createMomentClause(
    prefix: DatePrefix | undefined,
    moment: DateMoment
  ): DateClause {
    if (!prefix) {
      return {operator: 'ON', moment}; // DateOnClause
    } else if (prefix === 'BEFORE') {
      return {operator: 'BEFORE', moment}; // DateBeforeClause
    } else {
      return {operator: 'AFTER', moment}; // DateAfterClause
    }
  }

  // (BEFORE|AFTER) LAST|DAYOFWEEK
  private static createIntervalMoment(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause {
    const kind: DateMomentIntervalOperator = tokens[0]
      .type as DateMomentIntervalOperator;
    const unit: DateTimeUnit | DateWeekday = tokens[1].value as
      | DateTimeUnit
      | DateWeekday;
    const moment: IntervalMoment = {type: 'INTERVAL', kind, unit};
    return DateParser.createMomentClause(prefix, moment);
  }

  // NUMBER|UNITOFTIME|AGO
  // NUMBER|UNITOFTIME|FROM|NOW
  private static createOffsetMoment(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause | undefined {
    const amount = Number(tokens[0].value);
    const unit: DateTimeUnit = tokens[1].value as DateTimeUnit;
    const direction: DateMomentOffsetFromNowDirection =
      tokens[2].type === 'AGO' ? 'AGO' : 'FROMNOW';
    if (!DateParser.isValidNumber(amount)) {
      return undefined;
    }
    const moment: OffsetMoment = {
      type: 'OFFSET_FROM_NOW',
      direction,
      amount,
      unit,
    };
    return DateParser.createMomentClause(prefix, moment);
  }

  // (LAST|NEXT)|NUMBER|UNITOFTIME
  private static createSpanMoment(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause | undefined {
    const amount = Number(tokens[0].value);
    const unit: DateTimeUnit = tokens[1].value as DateTimeUnit;
    const direction: DateMomentSpanFromNowDirection =
      tokens[2].type === 'LAST' ? 'LAST' : 'NEXT';
    if (!DateParser.isValidNumber(amount)) {
      return undefined;
    }
    const moment: SpanMoment = {type: 'SPAN_FROM_NOW', direction, amount, unit};
    return DateParser.createMomentClause(prefix, moment);
  }

  // (NUMBER|YEAR)|UNITOFTIME
  private static createDateDuration(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause | undefined {
    if (prefix) {
      return undefined; // before 7 hours is ambiguous, not allowed.
    }
    const operator = 'DURATION';
    const amount = Number(tokens[0].value);
    const unit: DateTimeUnit = tokens[1].value as DateTimeUnit;
    if (!DateParser.isValidNumber(amount)) {
      return undefined;
    }
    const clause: DateDurationClause = {operator, duration: {amount, unit}};
    return clause;
  }

  // (BEFORE|AFTER)  DATE  DATE|TIME
  private static createAbsoluteMoment(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause {
    let unit: DateTimeUnit = 'YEAR';
    let date = tokens[0].value;
    if (tokens.length === 2) {
      const timeStr = tokens[1].value;
      date += ' ' + timeStr;
      if (timeStr.length > 5) unit = 'SECOND';
      else unit = 'MINUTE';
    } else if (date.length > 7) {
      unit = 'DAY';
    } else if (date.length > 4) {
      unit = 'MONTH';
    }
    const moment: AbsoluteMoment = {type: 'ABSOLUTE', date, unit};
    return DateParser.createMomentClause(prefix, moment);
  }

  // NOW  YESTERDAY  TODAY  TOMORROW
  private static createNamedMoment(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause {
    let momentName: DateMomentName = 'NOW';
    switch (tokens[0].type) {
      case 'TODAY':
        momentName = 'TODAY';
        break;
      case 'YESTERDAY':
        momentName = 'YESTERDAY';
        break;
      case 'TOMORROW':
        momentName = 'TOMORROW';
        break;
    }
    const moment: NamedMoment = {type: 'NAMED', name: momentName};
    return DateParser.createMomentClause(prefix, moment);
  }

  private static isValidNumber(value: number): boolean {
    return Number.isNaN(value) === false;
  }

  private static createDurationFromMerged(token: Token): Duration | undefined {
    if (!token.values || token.values.length !== 2) {
      return undefined;
    }
    if (
      token.type === 'MERGE:NUMBER|UNITOFTIME' ||
      token.type === 'MERGE:YEAR|UNITOFTIME'
    ) {
      const value = Number(token.values[0].value);
      if (!DateParser.isValidNumber(value)) {
        return undefined;
      }
      const unit = token.values[1].value as DateTimeUnit;
      return {amount: value, unit: unit};
    }
    return undefined;
  }

  private static createClauseFromMerged(
    prefix: DatePrefix | undefined,
    token: Token
  ): DateClause | undefined {
    const tokens: Token[] = token.values || [];
    switch (token.type) {
      case 'MERGE:LAST|UNITOFTIME':
      case 'MERGE:LAST|DAYOFWEEK':
      case 'MERGE:THIS|UNITOFTIME':
      case 'MERGE:NEXT|UNITOFTIME':
      case 'MERGE:NEXT|DAYOFWEEK':
        return this.createIntervalMoment(prefix, tokens);
      case 'MERGE:LAST|NUMBER|UNITOFTIME':
      case 'MERGE:LAST|YEAR|UNITOFTIME':
      case 'MERGE:NEXT|NUMBER|UNITOFTIME':
      case 'MERGE:NEXT|YEAR|UNITOFTIME':
        return this.createSpanMoment(prefix, tokens);
      case 'MERGE:NUMBER|UNITOFTIME|AGO':
      case 'MERGE:YEAR|UNITOFTIME|AGO':
      case 'MERGE:NUMBER|UNITOFTIME|FROM|NOW':
      case 'MERGE:YEAR|UNITOFTIME|FROM|NOW':
        return this.createOffsetMoment(prefix, tokens);
      case 'MERGE:NUMBER|UNITOFTIME':
      case 'MERGE:YEAR|UNITOFTIME':
        return this.createDateDuration(prefix, tokens);
      case 'MERGE:DATE|TIME':
      case 'MERGE:DATE':
      case 'MERGE:YEAR':
        return this.createAbsoluteMoment(prefix, tokens);
      case 'MERGE:NOW':
      case 'MERGE:TODAY':
      case 'MERGE:YESTERDAY':
      case 'MERGE:TOMORROW':
        return this.createNamedMoment(prefix, tokens);
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

  private handleRange(clauses: DateClause[]): boolean {
    if (
      this.isMatchingToken(this.index, 'MERGE', false) &&
      (this.isMatchingToken(this.index + 1, 'TO', true) ||
        this.isMatchingToken(this.index + 1, 'FOR', true)) &&
      this.isMatchingToken(this.index + 2, 'MERGE', false)
    ) {
      const startToken = this.tokens[this.index];
      const operator = this.tokens[this.index + 1].type; // TO | FOR
      const endToken = this.tokens[this.index + 2];
      const startClause = DateParser.createClauseFromMerged(
        undefined,
        startToken
      );
      this.index += 3;
      if (startClause === undefined || !('moment' in startClause)) {
        return false;
      }
      if (operator === 'TO') {
        const endClause = DateParser.createClauseFromMerged(
          undefined,
          endToken
        );
        if (endClause === undefined || !('moment' in endClause)) {
          return false;
        }
        const clause: DateBetweenClause = {
          operator: 'TO_RANGE',
          from: startClause.moment,
          to: endClause.moment,
        };
        clauses.push(clause);
      } else {
        const endDuration = DateParser.createDurationFromMerged(endToken);
        if (endDuration === undefined) {
          return false;
        }
        const clause: DateForClause = {
          operator: 'FOR_RANGE',
          from: startClause.moment,
          duration: endDuration,
        };
        clauses.push(clause);
      }
      return true;
    }
    return false;
  }

  private handleMerged(
    prefix: DatePrefix | undefined,
    clauses: DateClause[]
  ): boolean {
    const token: Token = this.getNext();
    if (token.type.startsWith('MERGE')) {
      const clause = DateParser.createClauseFromMerged(prefix, token);
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
