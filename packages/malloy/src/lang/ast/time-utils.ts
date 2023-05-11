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
  AtomicFieldType,
  Expr,
  Fragment,
  TimeFieldType,
  TimestampUnit,
  TypecastFragment,
  isAtomicFieldType,
} from '../../model/malloy_types';

import {compressExpr} from './expressions/utils';
import {TimeResult} from './types/time-result';
import {FieldValueType} from './types/type-desc';

export function timeOffset(
  timeType: TimeFieldType,
  from: Expr,
  op: '+' | '-',
  n: Expr,
  timeframe: TimestampUnit
): Expr {
  return [
    {
      type: 'dialect',
      function: 'delta',
      base: {valueType: timeType, value: from},
      op,
      delta: n,
      units: timeframe,
    },
  ];
}

export function castTo(
  castType: AtomicFieldType,
  from: Expr,
  fromType: FieldValueType,
  safe = false
): Expr {
  const cast: TypecastFragment = {
    type: 'dialect',
    function: 'cast',
    dstType: castType,
    expr: from,
    safe,
  };
  if (isAtomicFieldType(fromType)) {
    cast.srcType = fromType;
  }
  return [cast];
}

export function castTimestampToDate(from: Expr, safe = false): Expr {
  const cast: TypecastFragment = {
    type: 'dialect',
    function: 'cast',
    dstType: 'date',
    srcType: 'timestamp',
    expr: from,
    safe,
  };
  return [cast];
}

export function castDateToTimestamp(from: Expr, safe = false): Expr {
  const cast: TypecastFragment = {
    type: 'dialect',
    function: 'cast',
    dstType: 'timestamp',
    srcType: 'date',
    expr: from,
    safe,
  };
  return [cast];
}

export function resolution(timeframe: string): TimeFieldType {
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

export function timeResult(
  t: TimeResult,
  tt: TimestampUnit | undefined
): TimeResult {
  if (tt) {
    return {...t, timeframe: tt};
  }
  return t;
}

export function timestampOffset(
  from: Fragment[],
  op: '+' | '-',
  n: Fragment[],
  timeframe: TimestampUnit,
  fromNotTimestamp = false
): Fragment[] {
  const useDatetime = ['week', 'month', 'quarter', 'year'].includes(timeframe);
  const add = op === '+' ? '_ADD' : '_SUB';
  const units = timeframe.toUpperCase();
  if (useDatetime) {
    return [
      `TIMESTAMP(DATETIME${add}(DATETIME(`,
      ...from,
      '),INTERVAL ',
      ...n,
      ` ${units}))`,
    ];
  }
  const typeFrom = fromNotTimestamp ? ['TIMESTAMP(', ...from, ')'] : from;
  return compressExpr([
    `TIMESTAMP${add}(`,
    ...typeFrom,
    ',INTERVAL ',
    ...n,
    ` ${units})`,
  ]);
}

export function dateOffset(
  from: Fragment[],
  op: '+' | '-',
  n: Fragment[],
  timeframe: TimestampUnit
): Fragment[] {
  const add = op === '+' ? '_ADD' : '_SUB';
  const units = timeframe.toUpperCase();
  return compressExpr([
    `DATE${add}(`,
    ...from,
    ',INTERVAL ',
    ...n,
    ` ${units})`,
  ]);
}
