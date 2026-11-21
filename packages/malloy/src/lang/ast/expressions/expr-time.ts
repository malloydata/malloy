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
import type {Unsettled} from '../types/morphic-value';

export class ExprTime extends ExpressionDef {
  elementType = 'timestampOrDate';
  /** A time already computed, which may be morphic */
  constructor(readonly translationValue: Unsettled) {
    super();
  }

  static of(
    timeType: TemporalFieldType,
    value: Expr,
    from: ExprValue[] = []
  ): ExprTime {
    const time = new ExprTime(
      computedExprValue({dataType: {type: timeType}, value, from})
    );
    time.elementType = timeType;
    return time;
  }

  protected computeExpression(_fs: FieldSpace): Unsettled {
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
    return ExprTime.of(timeType, value, [expr]);
  }
}
