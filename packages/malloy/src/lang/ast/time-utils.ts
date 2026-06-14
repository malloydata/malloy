/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
