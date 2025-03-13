/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {BinaryOperator} from '../../../model';

export type LogicalMalloyOperator = 'and' | 'or';
export type ArithmeticMalloyOperator = '+' | '-' | '*' | '/' | '%';
export type EqualityMalloyOperator = '~' | '!~' | '=' | '!=';
export type CompareMalloyOperator =
  | '<'
  | '<='
  | '>'
  | '>='
  | EqualityMalloyOperator;
export type BinaryMalloyOperator =
  | ArithmeticMalloyOperator
  | CompareMalloyOperator
  | LogicalMalloyOperator;

export function getExprNode(mo: BinaryMalloyOperator): BinaryOperator {
  switch (mo) {
    case '~':
      return 'like';
    case '!~':
      return '!like';
  }
  return mo;
}

export function isEquality(op: string): op is EqualityMalloyOperator {
  return op === '=' || op === '!=' || op === '~' || op === '!~';
}
export function isComparison(op: string): op is CompareMalloyOperator {
  return (
    isEquality(op) || op === '>=' || op === '<=' || op === '>' || op === '<'
  );
}
