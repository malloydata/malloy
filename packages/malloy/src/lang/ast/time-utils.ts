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
  TimeLiteralFragment,
} from "../../model/malloy_types";
import { GranularResult, TimeResult } from "./ast-types";

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

export function timeResult(
  t: TimeResult,
  tt: TimestampUnit | undefined
): TimeResult | GranularResult {
  if (tt) {
    return { ...t, timeframe: tt };
  }
  return t;
}

export function timeLiteral(
  literalStr: string,
  timeType: TimeFieldType,
  tz: string
): Expr {
  const fragment: TimeLiteralFragment = {
    type: "dialect",
    function: "timeLiteral",
    literal: literalStr,
    literalType: timeType,
    timezone: tz,
  };
  return [fragment];
}
