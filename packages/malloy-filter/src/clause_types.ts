/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type NumberOperator = '<=' | '>=' | '!=' | '=' | '>' | '<';

export type NumberValue = number;

export interface NumberCondition {
  operator: NumberOperator;
  values: NumberValue[];
}

export interface NumberNull {
  operator: 'null';
}

export interface NumberNotNull {
  operator: 'not_null';
}

export type NumberRangeOperator = '<=' | '>=' | '>' | '<';

export interface NumberRange {
  operator: 'range';
  startOperator: NumberRangeOperator;
  startValue: NumberValue;
  endOperator: NumberRangeOperator;
  endValue: NumberValue;
}

export type NumberClause =
  | NumberCondition
  | NumberRange
  | NumberNull
  | NumberNotNull;

export type StringConditionOperator =
  | 'starts'
  | 'ends'
  | 'contains'
  | 'not_starts'
  | 'not_ends'
  | 'not_contains'
  | '='
  | '!=';

export type StringMatchOperator = '~' | '!~';

export type StringValue = string;

export interface StringCondition {
  operator: StringConditionOperator;
  values: StringValue[];
}

export interface StringMatch {
  operator: StringMatchOperator;
  escaped_values: StringValue[];
}

export interface StringNull {
  operator: 'null';
}

export interface StringNotNull {
  operator: 'not_null';
}

export interface StringEmpty {
  operator: 'empty';
}

export interface StringNotEmpty {
  operator: 'not_empty';
}

export type StringClause =
  | StringCondition
  | StringMatch
  | StringNull
  | StringNotNull
  | StringEmpty
  | StringNotEmpty;

export type BooleanOperator =
  | 'true'
  | 'false'
  | 'false_or_null'
  | 'null'
  | 'not_null';

export interface BooleanClause {
  operator: BooleanOperator;
}

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
