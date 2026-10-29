/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import {ExprAggregateFunction} from './expr-aggregate-function';
import type {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';

export class ExprMin extends ExprAggregateFunction {
  legalChildTypes = [
    TDU.numberT,
    TDU.stringT,
    TDU.dateT,
    TDU.timestampT,
    TDU.timestamptzT,
  ];
  constructor(expr: ExpressionDef) {
    super('min', expr);
  }
  returns(ev: ExprValue): ExprValue {
    return ev;
  }
}
