/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
import {FilterLog} from './clause_types';

type DatePrefix = 'before' | 'after';

export class DateParser extends BaseParser {
  private static readonly yearRegex: RegExp = /[%_]/;
  private static readonly negatedStartRegex: RegExp = /^-(.+)$/;

  constructor(input: string) {
    super(input);
  }

  private tokenize(): void {
    const specialSubstrings: SpecialToken[] = [{type: ',', value: ','}];
    // Do not reorder.
    const specialWords: SpecialToken[] = [
      {
        type: 'unitoftime',
        value: /^(second|minute|hour|day|week|month|quarter|year)s?$/i,
        ignoreCase: true,
      },
      {
        type: 'dayofweek',
        value: /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
        ignoreCase: true,
      },
      {type: 'date', value: /^\d{4}-\d{2}-\d{2}T\d\d$/},
      {type: 'date', value: /^\d{4}-\d{2}-\d{2}$/},
      {type: 'date', value: /^\d{4}-\d{2}$/},
      {type: 'date', value: /^\d{4}-[Qq][1234]$/},
      {
        type: 'date',
        value: /^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d\[[a-zA-Z_/]*\]$/,
      },
      {type: 'date', value: /^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d[.,]\d+$/},
      {type: 'date', value: /^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d$/},
      {type: 'date', value: /^\d{4}-\d{2}-\d{2}T\d\d:\d\d$/},
      {type: 'time', value: /^\d\d:\d\d:\d\d\[[a-zA-Z_/]*\]$/},
      {type: 'time', value: /^\d\d:\d\d:\d\d[.,]\d+$/},
      {type: 'time', value: /^\d\d:\d\d:\d\d$/},
      {type: 'time', value: /^\d\d:\d\d$/},
      {type: 'not_null', value: '-null', ignoreCase: true},
      {type: 'null', value: 'null', ignoreCase: true},
      {type: 'prefix', value: /^(before|after)/i, ignoreCase: true},
      {type: 'today', value: 'today', ignoreCase: true},
      {type: 'yesterday', value: 'yesterday', ignoreCase: true},
      {type: 'tomorrow', value: 'tomorrow', ignoreCase: true},
      {type: 'now', value: 'now', ignoreCase: true},
      {type: 'this', value: 'this', ignoreCase: true},
      {type: 'last', value: 'last', ignoreCase: true},
      {type: 'next', value: 'next', ignoreCase: true},
      {type: 'ago', value: 'ago', ignoreCase: true},
      {type: 'from', value: 'from', ignoreCase: true},
      {type: 'for', value: 'for', ignoreCase: true},
      {type: 'to', value: 'to', ignoreCase: true},
      {type: 'year', value: /^\d\d\d\d$/}, // Years are ambiguous, and require special handling.
      {type: 'number', value: /^[\d.]+/, ignoreCase: true},
    ];
    const params: TokenizerParams = {
      trimWordWhitespace: true,
      splitOnWhitespace: true,
      specialSubstrings,
      specialWords,
    };

    const tokenizer = new Tokenizer(this.inputString, params);
    this.tokens = tokenizer.parse();
    this.tokens = this.mergeDateTimeTokens();
    this.tokens = this.mergeMomentTokens();
  }

  private mergeDateTimeTokens(): Token[] {
    const output: Token[] = [];
    this.index = 0;
    let previous: Token | undefined = undefined;
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (
        previous &&
        previous.type === 'date' &&
        previous.value.length >= 10 &&
        (token.type === 'time' ||
          (token.type === 'number' && token.value.length === 2))
      ) {
        previous.value = previous.value + ' ' + token.value;
        previous.endIndex = token.endIndex;
        previous = undefined;
      } else {
        previous = token;
        output.push(token);
      }
      this.index++;
    }
    return output;
  }

  private mergeMomentTokens(): Token[] {
    const output: Token[] = [];
    this.index = 0;
    while (this.index < this.tokens.length) {
      // Do not reorder.
      if (
        this.matchAndMerge('last|unitoftime', output) ||
        this.matchAndMerge('last|dayofweek', output) ||
        this.matchAndMerge('last|number|unitoftime', output) ||
        this.matchAndMerge('last|year|unitoftime', output) ||
        this.matchAndMerge('this|unitoftime', output) ||
        this.matchAndMerge('next|unitoftime', output) ||
        this.matchAndMerge('next|dayofweek', output) ||
        this.matchAndMerge('next|number|unitoftime', output) ||
        this.matchAndMerge('next|year|unitoftime', output) ||
        this.matchAndMerge('number|unitoftime|ago', output) ||
        this.matchAndMerge('year|unitoftime|ago', output) ||
        this.matchAndMerge('number|unitoftime|from|now', output) ||
        this.matchAndMerge('year|unitoftime|from|now', output) ||
        this.matchAndMerge('number|unitoftime', output) ||
        this.matchAndMerge('year|unitoftime', output) ||
        this.matchAndMerge('today', output) ||
        this.matchAndMerge('yesterday', output) ||
        this.matchAndMerge('tomorrow', output) ||
        this.matchAndMerge('date', output) ||
        this.matchAndMerge('year', output) ||
        this.matchAndMerge('now', output)
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
    const logs: FilterLog[] = [];
    this.index = 0;
    while (this.index < this.tokens.length) {
      const token = this.getNext();
      if (token.type === ',') {
        if (prefix) {
          logs.push({
            severity: 'error',
            message: 'Invalid ' + prefix,
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          });
        } else if (this.index > 0 && this.tokens[this.index - 1].type === ',') {
          logs.push({
            severity: 'warn',
            message: 'Empty clause',
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          });
        }
        this.index++;
      } else if (token.type === 'prefix') {
        prefix = token.value as DatePrefix;
        this.index++;
      } else if (this.handleRange(clauses)) {
        if (prefix) {
          logs.push({
            severity: 'error',
            message: 'Invalid ' + prefix,
            startIndex: token.startIndex,
            endIndex: token.endIndex,
          });
          this.index++;
        }
      } else if (this.handleMerged(prefix, clauses)) {
        prefix = undefined;
      } else if (token.type === 'null' || token.type === 'not_null') {
        prefix = undefined;
        clauses.push({operator: token.type});
        this.index++;
      } else {
        logs.push({
          severity: 'error',
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
    return {clauses, logs};
  }

  private static createMomentClause(
    prefix: DatePrefix | undefined,
    moment: DateMoment
  ): DateClause {
    if (!prefix) {
      return {operator: 'on', moment}; // DateOnClause
    } else if (prefix === 'before') {
      return {operator: 'before', moment}; // DateBeforeClause
    } else {
      return {operator: 'after', moment}; // DateAfterClause
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
    const moment: IntervalMoment = {type: 'interval', kind, unit};
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
      tokens[2].type === 'ago' ? 'ago' : 'from_now';
    if (!DateParser.isValidNumber(amount)) {
      return undefined;
    }
    const moment: OffsetMoment = {
      type: 'offset_from_now',
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
      tokens[2].type === 'last' ? 'last' : 'next';
    if (!DateParser.isValidNumber(amount)) {
      return undefined;
    }
    const moment: SpanMoment = {type: 'span_from_now', direction, amount, unit};
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
    const operator = 'duration';
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
    const dateStr = tokens[0].value;
    const matcher: RegExpExecArray | null = /^\d{4}-\d{2}-\d{2}[Tt ](.+)$/.exec(
      dateStr
    );
    const timeStr = matcher ? matcher[1] : '';

    let unit: DateTimeUnit = 'year';
    if (timeStr.length > 8) {
      unit = 'instant';
    } else if (timeStr.length > 5) {
      unit = 'second';
    } else if (timeStr.length > 2) {
      unit = 'minute';
    } else if (timeStr.length === 2) {
      unit = 'hour';
    } else if (dateStr.length > 7) {
      unit = 'day';
    } else if (dateStr.length > 4) {
      unit = /[qQ]/.test(dateStr) ? 'quarter' : 'month';
    }
    const moment: AbsoluteMoment = {type: 'absolute', date: dateStr, unit};
    return DateParser.createMomentClause(prefix, moment);
  }

  // NOW  YESTERDAY  TODAY  TOMORROW
  private static createNamedMoment(
    prefix: DatePrefix | undefined,
    tokens: Token[]
  ): DateClause {
    let momentName: DateMomentName = 'now';
    switch (tokens[0].type) {
      case 'today':
        momentName = 'today';
        break;
      case 'yesterday':
        momentName = 'yesterday';
        break;
      case 'tomorrow':
        momentName = 'tomorrow';
        break;
    }
    const moment: NamedMoment = {type: 'named', name: momentName};
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
      token.type === 'MERGE:number|unitoftime' ||
      token.type === 'MERGE:year|unitoftime'
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
      case 'MERGE:last|unitoftime':
      case 'MERGE:last|dayofweek':
      case 'MERGE:this|unitoftime':
      case 'MERGE:next|unitoftime':
      case 'MERGE:next|dayofweek':
        return this.createIntervalMoment(prefix, tokens);
      case 'MERGE:last|number|unitoftime':
      case 'MERGE:last|year|unitoftime':
      case 'MERGE:next|number|unitoftime':
      case 'MERGE:next|year|unitoftime':
        return this.createSpanMoment(prefix, tokens);
      case 'MERGE:number|unitoftime|ago':
      case 'MERGE:year|unitoftime|ago':
      case 'MERGE:number|unitoftime|from|now':
      case 'MERGE:year|unitoftime|from|now':
        return this.createOffsetMoment(prefix, tokens);
      case 'MERGE:number|unitoftime':
      case 'MERGE:year|unitoftime':
        return this.createDateDuration(prefix, tokens);
      case 'MERGE:date':
      case 'MERGE:year':
        return this.createAbsoluteMoment(prefix, tokens);
      case 'MERGE:now':
      case 'MERGE:today':
      case 'MERGE:yesterday':
      case 'MERGE:tomorrow':
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
      (this.isMatchingToken(this.index + 1, 'to', true) ||
        this.isMatchingToken(this.index + 1, 'for', true)) &&
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
      if (operator === 'to') {
        const endClause = DateParser.createClauseFromMerged(
          undefined,
          endToken
        );
        if (endClause === undefined || !('moment' in endClause)) {
          return false;
        }
        const clause: DateBetweenClause = {
          operator: 'to_range',
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
          operator: 'for_range',
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
