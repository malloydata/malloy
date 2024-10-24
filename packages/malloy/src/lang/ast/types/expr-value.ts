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
  Expr,
  FieldValueType,
  TemporalFieldType,
  TimestampUnit,
  maxOfExpressionTypes,
  mergeEvalSpaces,
} from '../../../model';
import {ExprResult} from './expr-result';
import {TimeResult} from './time-result';

export type ExprValue = ExprResult | TimeResult;

export function computedExprValue({
  value,
  dataType,
  rawType,
  from,
}: {
  value: Expr;
  dataType: FieldValueType;
  rawType?: string;
  from: ExprValue[];
}): ExprValue {
  return {
    value,
    dataType,
    rawType,
    expressionType: maxOfExpressionTypes(from.map(e => e.expressionType)),
    evalSpace: mergeEvalSpaces(...from.map(e => e.evalSpace)),
  };
}

export function computedTimeResult({
  value,
  dataType,
  rawType,
  from,
  timeframe,
}: {
  value: Expr;
  rawType?: string;
  dataType: TemporalFieldType;
  timeframe?: TimestampUnit;
  from: ExprValue[];
}) {
  return {...computedExprValue({value, dataType, rawType, from}), timeframe};
}

export function computedErrorExprValue({
  dataType,
  rawType,
  from,
  error,
}: {
  error: string;
  rawType?: string;
  dataType?: FieldValueType;
  from: ExprValue[];
}) {
  return computedExprValue({
    dataType: dataType || 'error',
    rawType,
    value: {node: 'error', message: error},
    from,
  });
}

export function literalExprValue(options: {
  value: Expr;
  rawType?: string;
  dataType: FieldValueType;
}): ExprValue {
  // Makes literal, output, scalar because from is empty
  return computedExprValue({...options, from: []});
}

export function literalTimeResult({
  value,
  dataType,
  rawType,
  timeframe,
}: {
  value: Expr;
  rawType?: string;
  dataType: TemporalFieldType;
  timeframe?: TimestampUnit;
}): TimeResult {
  return {
    ...computedExprValue({value, dataType, rawType, from: []}),
    dataType,
    timeframe,
  };
}
