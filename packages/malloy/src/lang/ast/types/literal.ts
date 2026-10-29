/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ExprString} from '../expressions/expr-string';
import {Boolean} from '../expressions/boolean';
import {
  LiteralDay,
  LiteralHour,
  LiteralMonth,
  LiteralTimestamp,
  LiteralYear,
} from '../expressions/time-literal';
import {ExprNumber} from '../expressions/expr-number';
import type {ExpressionDef} from './expression-def';

export type Literal =
  | LiteralTimestamp
  | LiteralHour
  | LiteralMonth
  | LiteralDay
  | LiteralYear
  | ExprNumber
  | ExprString
  | Boolean;

export function isLiteral(value: ExpressionDef) {
  return (
    value instanceof LiteralTimestamp ||
    value instanceof LiteralHour ||
    value instanceof LiteralMonth ||
    value instanceof LiteralDay ||
    value instanceof LiteralYear ||
    value instanceof ExprNumber ||
    value instanceof ExprString ||
    value instanceof Boolean
  );
}
