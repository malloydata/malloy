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

import { Fragment, TimeTimeframe } from "../../model/malloy_types";
import { compressExpr, ExprValue, TimeType } from "./ast-types";

export function dateOffset(
  from: Fragment[],
  op: "+" | "-",
  n: Fragment[],
  timeframe: TimeTimeframe
): Fragment[] {
  const add = op === "+" ? "_ADD" : "_SUB";
  const units = timeframe.toUpperCase();
  return compressExpr([
    `DATE${add}(`,
    ...from,
    `,INTERVAL `,
    ...n,
    ` ${units})`,
  ]);
}

export function timestampOffset(
  from: Fragment[],
  op: "+" | "-",
  n: Fragment[],
  timeframe: TimeTimeframe,
  fromNotTimestamp = false
): Fragment[] {
  const useDatetime = ["week", "month", "quarter", "year"].includes(timeframe);
  const add = op === "+" ? "_ADD" : "_SUB";
  const units = timeframe.toUpperCase();
  if (useDatetime) {
    return compressExpr([
      `TIMESTAMP(DATETIME${add}(DATETIME(`,
      ...from,
      `),INTERVAL `,
      ...n,
      ` ${units}))`,
    ]);
  }
  const typeFrom = fromNotTimestamp ? ["TIMESTAMP(", ...from, ")"] : from;
  return compressExpr([
    `TIMESTAMP${add}(`,
    ...typeFrom,
    `,INTERVAL `,
    ...n,
    ` ${units})`,
  ]);
}

export function toTimestampV(v: ExprValue): ExprValue {
  if (v.dataType === "timestamp") {
    return v;
  }
  return {
    ...v,
    dataType: "timestamp",
    value: compressExpr(["TIMESTAMP(", ...v.value, ")"]),
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
