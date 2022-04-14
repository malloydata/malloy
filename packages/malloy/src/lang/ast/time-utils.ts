/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import {
  TimestampUnit,
  Expr,
  TimeFieldType,
  TypecastFragment,
  AtomicFieldType,
} from "../../model/malloy_types";

export function timeOffset(
  timeType: TimeFieldType,
  from: Expr,
  op: "+" | "-",
  n: Expr,
  timeframe: TimestampUnit
): Expr {
  return [
    {
      type: "dialect",
      function: "delta",
      base: { valueType: timeType, value: from },
      op,
      delta: n,
      units: timeframe,
    },
  ];
}

export function castTo(
  castType: AtomicFieldType,
  from: Expr,
  safe = false
): Expr {
  const cast: TypecastFragment = {
    type: "dialect",
    function: "cast",
    dstType: castType,
    expr: from,
    safe,
  };
  return [cast];
}

export function castTimestampToDate(from: Expr, safe = false): Expr {
  const cast: TypecastFragment = {
    type: "dialect",
    function: "cast",
    dstType: "date",
    srcType: "timestamp",
    expr: from,
    safe,
  };
  return [cast];
}

export function castDateToTimestamp(from: Expr, safe = false): Expr {
  const cast: TypecastFragment = {
    type: "dialect",
    function: "cast",
    dstType: "timestamp",
    srcType: "date",
    expr: from,
    safe,
  };
  return [cast];
}

export function resolution(timeframe: string): TimeFieldType {
  switch (timeframe) {
    case "hour":
    case "minute":
    case "second":
    case "microsecond":
    case "millisecond":
      return "timestamp";
  }
  return "date";
}
