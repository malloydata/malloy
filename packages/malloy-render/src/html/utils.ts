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

import { DateTimeframe, TimestampTimeframe } from "@malloydata/malloy";

export function getColorScale(
  type: "temporal" | "ordinal" | "quantitative" | "nominal" | undefined,
  isRectMark: boolean,
  hasOverlappingText = false
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
        ? hasOverlappingText
          ? { range: ["#6BA4EE", "#EEA361"] }
          : { range: ["#1A73E8", "#E8710A"] }
        : { range: ["#1A73E8", "#12B5CB"] };
    case "nominal":
      return hasOverlappingText
        ? {
            range: [
              "#6BA4EE",
              "#66CEDC",
              "#EC72B8",
              "#EEA361",
              "#F9C85B",
              "#AACD85",
              "#B87CED",
              "#ACB0B3",
            ],
          }
        : {
            range: [
              "#1A73E8",
              "#12B5CB",
              "#E52592",
              "#E8710A",
              "#F9AB00",
              "#7CB342",
              "#9334E6",
              "#80868B",
            ],
          };
  }
}

function numberFixedDigits(value: number, digits: number) {
  return value.toString().padStart(digits, "0");
}

export function timeToString(
  time: Date,
  timeframe: DateTimeframe | TimestampTimeframe
): string {
  switch (timeframe) {
    case TimestampTimeframe.Year:
    case DateTimeframe.Year: {
      const year = numberFixedDigits(time.getUTCFullYear(), 4);
      return `${year}`;
    }
    case TimestampTimeframe.Quarter:
    case DateTimeframe.Quarter: {
      const year = numberFixedDigits(time.getUTCFullYear(), 4);
      const quarter = Math.floor(time.getUTCMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case TimestampTimeframe.Month:
    case DateTimeframe.Month: {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      return `${year}-${month}`;
    }
    case TimestampTimeframe.Week:
    case DateTimeframe.Week: {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      return `WK${year}-${month}-${day}`;
    }
    case DateTimeframe.Date:
    case TimestampTimeframe.Date: {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      return `${year}-${month}-${day}`;
    }
    case TimestampTimeframe.Hour: {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      const hour = numberFixedDigits(time.getUTCHours(), 2);
      return `${year}-${month}-${day} ${hour}:00 for 1 hour`;
    }
    case TimestampTimeframe.Minute: {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      const hour = numberFixedDigits(time.getUTCHours(), 2);
      const minute = numberFixedDigits(time.getUTCMinutes(), 2);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    case TimestampTimeframe.Second: {
      const year = numberFixedDigits(time.getUTCFullYear(), 2);
      const month = numberFixedDigits(time.getUTCMonth() + 1, 2);
      const day = numberFixedDigits(time.getUTCDate(), 2);
      const hour = numberFixedDigits(time.getUTCHours(), 2);
      const minute = numberFixedDigits(time.getUTCMinutes(), 2);
      const second = numberFixedDigits(time.getUTCSeconds(), 2);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    default:
      throw new Error("Unknown timeframe.");
  }
}

/**
 * Use this function to break up expensive computation over multiple tasks.
 *
 * @returns A promise, which when awaited, puts subsequent code in a separate task.
 *
 * This is useful for cases when expensive code needs to run "concurrently" with a
 * rendering / UI task. Sprinkling in `yieldTask`s into a long task allows other
 * tasks to run periodically.
 */
export async function yieldTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function createErrorElement(
  document: Document,
  error: string | Error
): HTMLElement {
  const element = document.createElement("span");
  element.classList.add("error");
  element.appendChild(
    document.createTextNode(typeof error === "string" ? error : error.message)
  );
  return element;
}

export function createNullElement(document: Document): HTMLElement {
  const element = document.createElement("span");
  element.appendChild(document.createTextNode("∅"));
  element.classList.add("value-null");
  return element;
}

export function createDrillIcon(document: Document): HTMLElement {
  const drill = document.createElement("div");
  drill.style.borderRadius = "20px";
  drill.style.backgroundColor = "#efefef";
  drill.style.width = "27px";
  drill.style.height = "14px";
  drill.style.display = "flex";
  drill.style.justifyContent = "center";
  drill.style.alignItems = "center";
  drill.style.gap = "2px";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.style.backgroundColor = "rgb(181 181 181)";
    dot.style.borderRadius = "5px";
    dot.style.width = "4px";
    dot.style.height = "4px";
    drill.appendChild(dot);
  }
  return drill;
}
