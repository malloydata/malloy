/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

interface FilterOperator<T extends string> {
  operator: T;
}

interface Negateable {
  not?: boolean;
}

export interface Null extends FilterOperator<'null'>, Negateable {}

export type ChainOp = 'and' | 'or' | ',';
export function isChainOp(s: string): s is ChainOp {
  return ['and', 'or', ','].includes(s);
}

interface ClauseChain<T> extends FilterOperator<ChainOp> {
  members: T[];
}

type BooleanChainOp = 'and' | 'or';
export interface BooleanChain<T> extends FilterOperator<BooleanChainOp> {
  members: T[];
}

interface ClauseGroup<T> extends FilterOperator<'()'>, Negateable {
  expr: T;
}

export type StringConditionOperator = 'starts' | 'ends' | 'contains' | '=';
export function isStringCondition(sc: StringFilter): sc is StringCondition {
  return ['starts', 'ends', 'contains', '='].includes(sc.operator);
}

export interface StringCondition
  extends FilterOperator<StringConditionOperator>,
    Negateable {
  values: string[];
}

export interface StringMatch extends FilterOperator<'~'>, Negateable {
  escaped_values: string[];
}

export interface StringEmpty extends FilterOperator<'empty'>, Negateable {}

export type StringFilter =
  | StringCondition
  | StringMatch
  | Null
  | StringEmpty
  | ClauseChain<StringFilter>
  | ClauseGroup<StringFilter>;

export function isStringFilter(sc: Object): sc is StringFilter {
  return (
    'operator' in sc &&
    typeof sc.operator === 'string' &&
    [
      'starts',
      'ends',
      'contains',
      '=',
      '~',
      'null',
      'empty',
      'and',
      'or',
      ',',
      '()',
    ].includes(sc.operator)
  );
}

export type BooleanOperator = 'true' | 'false' | 'false_or_null';

export interface BooleanCondition extends Negateable {
  operator: BooleanOperator;
}

export type BooleanFilter = BooleanCondition | Null;

export function isBooleanFilter(bc: Object): bc is BooleanFilter {
  return (
    'operator' in bc &&
    typeof bc.operator === 'string' &&
    ['null', 'true', 'false', 'false_or_null'].includes(bc.operator)
  );
}

export type NumberOperator = '<=' | '>=' | '!=' | '=' | '>' | '<';

export interface NumberCondition
  extends FilterOperator<NumberOperator>,
    Negateable {
  values: string[];
}

export type NumberRangeOperator = '<=' | '>=' | '>' | '<';

export interface NumberRange extends FilterOperator<'range'>, Negateable {
  startOperator: NumberRangeOperator;
  startValue: string;
  endOperator: NumberRangeOperator;
  endValue: string;
}

export type NumberFilter =
  | NumberCondition
  | NumberRange
  | Null
  | ClauseGroup<NumberFilter>
  | BooleanChain<NumberFilter>;

export function isNumberFilter(sc: Object): sc is NumberFilter {
  return (
    'operator' in sc &&
    typeof sc.operator === 'string' &&
    [
      'range',
      '<=',
      '>=',
      '!=',
      '=',
      '>',
      '<',
      'and',
      'or',
      '()',
      'null',
    ].includes(sc.operator)
  );
}

export type TemporalUnit =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export interface TemporalLiteral {
  moment: 'literal';
  units?: TemporalUnit;
  literal: string;
}

export interface Duration {
  units: TemporalUnit;
  n: string;
}

export interface WeekdayMoment {
  moment:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
  which: 'last' | 'next';
}

export interface WhichdayMoment {
  moment: 'yesterday' | 'today' | 'tomorrow';
}

export interface FromNowMoment extends Duration {
  moment: 'from_now';
}

export interface AgoMoment extends Duration {
  moment: 'ago';
}

export interface NowMoment {
  moment: 'now';
}

export interface UnitMoment {
  moment: 'this' | 'last' | 'next';
  units: TemporalUnit;
}

export type Moment =
  | UnitMoment
  | NowMoment
  | AgoMoment
  | FromNowMoment
  | TemporalLiteral
  | WhichdayMoment
  | WeekdayMoment;

export interface Before extends FilterOperator<'before'>, Negateable {
  before: Moment;
}

export interface After extends FilterOperator<'after'>, Negateable {
  after: Moment;
}

export interface To extends FilterOperator<'to'>, Negateable {
  fromMoment: Moment;
  toMoment: Moment;
}

export interface For extends FilterOperator<'for'>, Negateable, Duration {
  begin: Moment;
}

// N units starting in the past, including this one
export interface in_last
  extends FilterOperator<'in_last'>,
    Negateable,
    Duration {}

// Nunits starting in the past, not including this one
export interface JustUnits
  extends FilterOperator<'last' | 'next'>,
    Negateable,
    Duration {}

export interface InMoment extends FilterOperator<'in'>, Negateable {
  in: Moment;
}

export type TemporalFilter =
  | Null
  | Before
  | After
  | To
  | For
  | JustUnits
  | in_last
  | InMoment
  | BooleanChain<TemporalFilter>
  | ClauseGroup<TemporalFilter>;

export function isTemporalFilter(sc: Object): sc is TemporalFilter {
  return (
    'operator' in sc &&
    typeof sc.operator === 'string' &&
    [
      'literal',
      'before',
      'after',
      'to',
      'for',
      'in',
      'and',
      'or',
      'in_last',
      'this',
      'last',
      'next',
      '()',
      'null',
    ].includes(sc.operator)
  );
}

export type FilterExpression =
  | BooleanFilter
  | NumberFilter
  | StringFilter
  | TemporalFilter;

export function isFilterExpression(
  obj: Object | undefined
): obj is FilterExpression {
  return !!obj && 'operator' in obj;
}

export type FilterLogSeverity = 'error' | 'warn';

export interface FilterLog {
  message: string;
  startIndex: number;
  endIndex: number;
  severity: FilterLogSeverity;
}

export interface FilterParserResponse<T extends FilterExpression> {
  parsed: T | null;
  log: FilterLog[];
}

export type FilterableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'timestamp'
  | 'date';
export function isFilterable(s: string): s is FilterableType {
  return ['string', 'number', 'boolean', 'timestamp', 'date'].includes(s);
}
