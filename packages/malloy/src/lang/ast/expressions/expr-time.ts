/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  ExpressionType,
  Fragment,
  TimeFieldType,
  isTimeFieldType,
} from '../../../model/malloy_types';

import {FieldSpace} from '../types/field-space';
import {compressExpr} from './utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';

export class ExprTime extends ExpressionDef {
  elementType = 'timestampOrDate';
  readonly translationValue: ExprValue;
  constructor(
    timeType: TimeFieldType,
    value: Fragment[] | string,
    expressionType: ExpressionType = 'scalar'
  ) {
    super();
    this.elementType = timeType;
    this.translationValue = {
      dataType: timeType,
      expressionType,
      value: typeof value === 'string' ? [value] : value,
      evalSpace: 'constant',
    };
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.translationValue;
  }

  static fromValue(timeType: TimeFieldType, expr: ExprValue): ExprTime {
    let value = expr.value;
    if (timeType !== expr.dataType) {
      const toTs: Fragment = {
        type: 'dialect',
        function: 'cast',
        safe: false,
        dstType: timeType,
        expr: expr.value,
      };
      if (isTimeFieldType(expr.dataType)) {
        toTs.srcType = expr.dataType;
      }
      value = compressExpr([toTs]);
    }
    return new ExprTime(timeType, value, expr.expressionType);
  }
}
