/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Expr, TemporalFieldType} from '../../../model/malloy_types';

import {asTimeType} from '../time-utils';

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

  protected computeExpression(_fs: FieldSpace): ExprValue {
    return this.translationValue;
  }

  static fromValue(timeType: TemporalFieldType, expr: ExprValue): ExprTime {
    return new ExprTime(timeType, asTimeType(timeType, expr), [expr]);
  }
}
