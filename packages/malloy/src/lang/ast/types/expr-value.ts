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

import type {
  Expr,
  ExpressionValueTypeDef,
  TemporalTypeDef,
  TimestampUnit,
} from '../../../model';
import {maxOfExpressionTypes, mergeEvalSpaces} from '../../../model';
import {
  emptyCompositeFieldUsage,
  mergeCompositeFieldUsage,
} from '../../../model/composite_source_utils';
import type {ExprResult} from './expr-result';
import type {TimeResult} from './time-result';

export type ExprValue = ExprResult | TimeResult;

export function computedExprValue({
  value,
  dataType,
  from,
}: {
  value: Expr;
  dataType: ExpressionValueTypeDef;
  from: ExprValue[];
}): ExprValue {
  return {
    ...dataType,
    value,
    expressionType: maxOfExpressionTypes(from.map(e => e.expressionType)),
    evalSpace: mergeEvalSpaces(...from.map(e => e.evalSpace)),
    compositeFieldUsage: mergeCompositeFieldUsage(
      ...from.map(e => e.compositeFieldUsage)
    ),
  };
}

export function computedTimeResult({
  value,
  dataType,
  from,
  timeframe,
}: {
  value: Expr;
  dataType: TemporalTypeDef;
  timeframe?: TimestampUnit;
  from: ExprValue[];
}): TimeResult {
  const xv = computedExprValue({value, dataType, from});
  const y: TimeResult = {
    ...dataType,
    expressionType: xv.expressionType,
    evalSpace: xv.evalSpace,
    value: xv.value,
    compositeFieldUsage: mergeCompositeFieldUsage(
      ...from.map(e => e.compositeFieldUsage)
    ),
  };
  if (timeframe) {
    y.timeframe = timeframe;
  }
  return y;
}

export function computedErrorExprValue({
  dataType,
  from,
  error,
}: {
  error: string;
  dataType?: ExpressionValueTypeDef;
  from: ExprValue[];
}): ExprValue {
  return computedExprValue({
    dataType: dataType ?? {type: 'error'},
    value: {node: 'error', message: error},
    from,
  });
}

export function literalExprValue(options: {
  value: Expr;
  dataType: ExpressionValueTypeDef;
}): ExprValue {
  // Makes literal, output, scalar because from is empty
  return computedExprValue({...options, from: []});
}

export function literalTimeResult({
  value,
  dataType,
  timeframe,
}: {
  value: Expr;
  dataType: TemporalTypeDef;
  timeframe?: TimestampUnit;
}): TimeResult {
  const xv = computedExprValue({value, dataType, from: []});
  const y: TimeResult = {
    ...dataType,
    expressionType: xv.expressionType,
    evalSpace: xv.evalSpace,
    value: xv.value,
    compositeFieldUsage: emptyCompositeFieldUsage(),
  };
  if (timeframe) {
    y.timeframe = timeframe;
  }
  return y;
}
