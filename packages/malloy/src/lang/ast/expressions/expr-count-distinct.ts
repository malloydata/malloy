/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import {ExprAggregateFunction} from './expr-aggregate-function';
import type {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';

export class ExprCountDistinct extends ExprAggregateFunction {
  legalChildTypes = [
    TDU.numberT,
    TDU.stringT,
    TDU.dateT,
    TDU.timestampT,
    TDU.timestamptzT,
  ];
  constructor(expr: ExpressionDef) {
    super('distinct', expr);
  }

  returns(ev: ExprValue): ExprValue {
    return {
      type: 'number',
      numberType: 'integer',
      evalSpace: ev.evalSpace,
      expressionType: 'aggregate',
      value: ev.value,
      refSummary: ev.refSummary,
    };
  }
}
