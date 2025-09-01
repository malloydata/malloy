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
  TemporalFieldType,
  TimestampUnit,
  CastType,
  TypecastExpr,
  TimeDeltaExpr,
  ExpressionValueType,
} from '../../model/malloy_types';
import {mkTemporal, isCastType, isDateUnit} from '../../model/malloy_types';

import type {TimeResult} from './types/time-result';

export function timeOffset(
  timeType: TemporalFieldType,
  from: Expr,
  op: '+' | '-',
  n: Expr,
  timeframe: TimestampUnit
): TimeDeltaExpr {
  return {
    node: 'delta',
    kids: {
      base: mkTemporal(from, timeType),
      delta: n,
    },
    op,
    units: timeframe,
  };
}

export function castTo(
  castType: CastType | {raw: string},
  from: Expr,
  fromType: ExpressionValueType,
  safe = false
): TypecastExpr {
  let cast: TypecastExpr;
  if (typeof castType !== 'string') {
    cast = {
      node: 'cast',
      dstSQLType: castType.raw,
      e: from,
      safe,
    };
  } else {
    const dstType = {type: castType};
    cast = {
      node: 'cast',
      dstType,
      e: from,
      safe,
    };
  }
  if (isCastType(fromType)) {
    cast.srcType = {type: fromType};
  }
  return cast;
}

export function resolution(timeframe: string): TemporalFieldType {
  switch (timeframe) {
    case 'hour':
    case 'minute':
    case 'second':
    case 'microsecond':
    case 'millisecond':
      return 'timestamp';
  }
  return 'date';
}

export function mkTimeResult(
  t: TimeResult,
  tt: TimestampUnit | undefined
): TimeResult {
  if (tt) {
    if (t.type === 'timestamp') {
      return {...t, timeframe: tt};
    }
    if (isDateUnit(tt)) {
      return {...t, timeframe: tt};
    }
  }
  return t;
}
