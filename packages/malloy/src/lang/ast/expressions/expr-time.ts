/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Expr,
  TemporalFieldType,
  TypecastExpr,
} from '../../../model/malloy_types';
import {isTemporalType} from '../../../model/malloy_types';

import type {FieldSpace} from '../types/field-space';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';

export class ExprTime extends ExpressionDef {
  elementType = 'timestampOrDate';
  readonly translationValue: ExprValue;
  constructor(timeType: TemporalFieldType, value: Expr, from?: ExprValue[]) {
    super();
    this.elementType = timeType;
    this.translationValue = computedExprValue({
      dataType: {type: timeType},
      value,
      from: from ?? [],
    });
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.translationValue;
  }

  static fromValue(timeType: TemporalFieldType, expr: ExprValue): ExprTime {
    let value = expr.value;
    if (timeType !== expr.type) {
      const toTs: TypecastExpr = {
        node: 'cast',
        safe: false,
        dstType: {type: timeType},
        e: expr.value,
      };
      if (isTemporalType(expr.type)) {
        toTs.srcType = {type: expr.type};
      }
      value = toTs;
    }
    return new ExprTime(timeType, value, [expr]);
  }
}
