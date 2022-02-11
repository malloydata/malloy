/*
 * Copyright 2022 Google LLC
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

import { Dialect } from "../../dialect";
import { Expr, Fragment, TimeTimeframe } from "../../model/malloy_types";
import { compressExpr, ExprValue, TimeType } from "./ast-types";

export function dateOffset(
  dialect: Dialect,
  from: Fragment[],
  op: "+" | "-",
  n: Fragment[],
  timeframe: TimeTimeframe
): Fragment[] {
  return compressExpr(dialect.sqlDateAdd(op, from, n, timeframe) as Expr);
}

export function timestampOffset(
  dialect: Dialect,
  from: Fragment[],
  op: "+" | "-",
  n: Fragment[],
  timeframe: TimeTimeframe
  // fromNotTimestamp = false
): Fragment[] {
  return compressExpr(dialect.sqlTimestampAdd(op, from, n, timeframe) as Expr);
}

export function toTimestampV(dialect: Dialect, v: ExprValue): ExprValue {
  if (v.dataType === "timestamp") {
    return v;
  }
  return {
    ...v,
    dataType: "timestamp",
    value: compressExpr(dialect.sqlTimestampCast(v.value) as Expr),
  };
}

export function resolution(timeframe: string): TimeType {
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
