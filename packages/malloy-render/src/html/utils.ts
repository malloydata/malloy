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

import { TimeTimeframe } from "malloy";
import { normalColors } from "./chart";

function numberFixedDigits(value: number, digits: number) {
  return value.toString().padStart(digits, "0");
}

export function timeToString(time: Date, timeframe: TimeTimeframe): string {
  switch (timeframe) {
    case "year": {
      const year = numberFixedDigits(time.getUTCFullYear(), 4);
      return `${year}`;
    }
    case "quarter": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const quarter = Math.trunc(time.getUTCMonth() / 4) + 1;
      return `${year}-Q${quarter}`;
    }
    case "month": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      return `${year}-${month}`;
    }
    case "week": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      return `WK${year}-${month}-${day}`;
    }
    case "day":
    case "date": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      return `${year}-${month}-${day}`;
    }
    case "hour": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      const hour = numberFixedDigits(time.getUTCHours(), 2);
      return `${year}-${month}-${day} ${hour}:00`;
    }
    case "minute": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      const hour = numberFixedDigits(time.getUTCHours(), 2);
      const minute = numberFixedDigits(time.getUTCMinutes(), 2);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    case "second": {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      const hour = numberFixedDigits(time.getUTCHours(), 2);
      const minute = numberFixedDigits(time.getUTCMinutes(), 2);
      const second = numberFixedDigits(time.getUTCSeconds(), 2);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
  }
  return "";
}

export function getColorScale(
  type: "temporal" | "ordinal" | "quantitative" | "nominal" | undefined,
  isRectMark: boolean
): { range: string[] } | undefined {
  if (type === undefined) {
    return undefined;
  }
  switch (type) {
    case "ordinal":
      return { range: ["#12B5CB", "#1A73E8"] };
    case "temporal":
    case "quantitative":
      return isRectMark
        ? { range: ["#1A73E8", "#E8710A"] }
        : { range: ["#1A73E8", "#12B5CB"] };
    case "nominal":
      return {
        range: normalColors,
      };
  }
}
