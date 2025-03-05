/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ClauseBase {
  operator: string;
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

export interface BooleanCondition {
  operator: BooleanOperator;
}

export type BooleanClause = BooleanCondition | Null;

export type FilterLogSeverity = 'error' | 'warn';

export interface FilterLog {
  message: string;
  startIndex: number;
  endIndex: number;
  severity: FilterLogSeverity;
}

export interface BooleanParserResponse {
  clauses: BooleanClause[];
  logs: FilterLog[];
}

export interface NumberParserResponse {
  clauses: NumberClause[];
  logs: FilterLog[];
}

export interface StringParserResponse {
  clauses: StringClause[];
  logs: FilterLog[];
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
  | ClauseChain<NumberClause>;

export function isNumberClause(sc: Object): sc is StringClause {
  return (
    'operator' in sc &&
    typeof sc.operator === 'string' &&
    ['range', '<=', '>=', '!=', '=', '>', '<', 'and', 'or', ',', '()'].includes(
      sc.operator
    )
  );
}
