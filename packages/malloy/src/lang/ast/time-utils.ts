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
  AtomicTypeDef,
  Expr,
  TemporalFieldType,
  TimestampUnit,
  TypecastExpr,
  TimeDeltaExpr,
  ExpressionValueType,
} from '../../model/malloy_types';
import {
  mkTemporal,
  isBasicAtomicType,
  isDateUnit,
  TD,
} from '../../model/malloy_types';

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
  castType: AtomicTypeDef | {raw: string},
  from: Expr,
  fromType: ExpressionValueType,
  safe = false
): TypecastExpr {
  let cast: TypecastExpr;
  if ('type' in castType) {
    cast = {
      node: 'cast',
      dstType: castType,
      e: from,
      safe,
    };
  } else {
    cast = {
      node: 'cast',
      dstSQLType: castType.raw,
      e: from,
      safe,
    };
  }
  if (isBasicAtomicType(fromType)) {
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
    if (TD.isAnyTimestamp(t)) {
      return {...t, timeframe: tt};
    }
    if (isDateUnit(tt)) {
      return {...t, timeframe: tt};
    }
  }
  return t;
}
