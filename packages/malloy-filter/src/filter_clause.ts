/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ClauseBase {
  operator: string;
}

export function isClauseBase(o: Object): o is ClauseBase {
  return 'operator' in o;
}

interface Negateable {
  not?: boolean;
}

export interface Null extends ClauseBase, Negateable {
  operator: 'null';
}

export type ChainOp = 'and' | 'or' | ',';
export function isChainOp(s: string): s is ChainOp {
  return ['and', 'or', ','].includes(s);
}

interface ClauseChain<T> extends ClauseBase {
  operator: ChainOp;
  members: T[];
}

type BooleanChainOp = 'and' | 'or';
export interface BooleanChain<T> extends ClauseBase {
  operator: BooleanChainOp;
  members: T[];
}

interface ClauseGroup<T> extends ClauseBase, Negateable {
  operator: '()';
  expr: T;
}

export type StringConditionOperator = 'starts' | 'ends' | 'contains' | '=';
export function isStringCondition(sc: StringClause): sc is StringCondition {
  return ['starts', 'ends', 'contains', '='].includes(sc.operator);
}

export interface StringCondition extends ClauseBase, Negateable {
  operator: StringConditionOperator;
  values: string[];
}

export interface StringMatch extends ClauseBase, Negateable {
  operator: '~';
  escaped_values: string[];
}

export interface StringEmpty extends ClauseBase, Negateable {
  operator: 'empty';
}

export type StringClause =
  | StringCondition
  | StringMatch
  | Null
  | StringEmpty
  | ClauseChain<StringClause>
  | ClauseGroup<StringClause>;

export type BooleanOperator = 'true' | 'false' | 'false_or_null';

export interface BooleanCondition extends Negateable {
  operator: BooleanOperator;
}

export type BooleanClause = BooleanCondition | Null;

export function isBooleanClause(bc: Object): bc is BooleanClause {
  return (
    'operator' in bc &&
    typeof bc.operator === 'string' &&
    ['null', 'true', 'false', 'false_or_null'].includes(bc.operator)
  );
}

export function isStringClause(sc: Object): sc is StringClause {
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

export type NumberOperator = '<=' | '>=' | '!=' | '=' | '>' | '<';

export interface NumberCondition extends ClauseBase, Negateable {
  operator: NumberOperator;
  values: string[];
}

export type NumberRangeOperator = '<=' | '>=' | '>' | '<';

export interface NumberRange extends ClauseBase, Negateable {
  operator: 'range';
  startOperator: NumberRangeOperator;
  startValue: string;
  endOperator: NumberRangeOperator;
  endValue: string;
}

export type NumberClause =
  | NumberCondition
  | NumberRange
  | Null
  | ClauseGroup<NumberClause>
  | BooleanChain<NumberClause>;

export function isNumberClause(sc: Object): sc is NumberClause {
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

export interface Before extends Negateable {
  operator: 'before';
  before: Moment;
}

export interface After extends Negateable {
  operator: 'after';
  after: Moment;
}

export interface To extends Negateable {
  operator: 'to';
  fromMoment: Moment;
  toMoment: Moment;
}

export interface For extends Negateable, Duration {
  operator: 'for';
  begin: Moment;
}

// N units starting in the past, including this one
export interface in_last extends Negateable, Duration {
  operator: 'in_last';
}

// Nunits starting in the past, not including this one
export interface JustUnits extends Negateable, Duration {
  operator: 'last' | 'next';
}

export interface InMoment extends Negateable {
  operator: 'in';
  in: Moment;
}

export type TemporalClause =
  | Null
  | Before
  | After
  | To
  | For
  | JustUnits
  | in_last
  | InMoment
  | BooleanChain<TemporalClause>
  | ClauseGroup<TemporalClause>;

export function isTemporalClause(sc: Object): sc is TemporalClause {
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

export type FilterLogSeverity = 'error' | 'warn';

export interface FilterLog {
  message: string;
  startIndex: number;
  endIndex: number;
  severity: FilterLogSeverity;
}

export interface FilterParserReponse<T extends ClauseBase> {
  parsed: T | null;
  log: FilterLog[];
}
