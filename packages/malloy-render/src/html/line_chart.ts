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

import { FieldDef, QueryValue } from "@malloy-lang/malloy";
import { HtmlCartesianChartRenderer } from "./cartesian_chart";

export class HtmlLineChartRenderer extends HtmlCartesianChartRenderer {
  getMark(): "line" {
    return "line";
  }

  getDataType(
    field: FieldDef
  ): "temporal" | "ordinal" | "quantitative" | "nominal" {
    switch (field.type) {
      case "date":
      case "timestamp":
        return "temporal";
      case "string":
        return "nominal";
      case "number":
        return "quantitative";
      default:
        throw new Error("Invalid field type for bar chart.");
    }
  }

  getDataValue(
    value: QueryValue,
    field: FieldDef
  ): Date | string | number | null {
    switch (field.type) {
      case "timestamp":
      case "date":
        return value === null
          ? null
          : new Date((value as { value: string }).value);
      case "number":
        return value as number;
      case "string":
        return value as string;
      default:
        throw new Error("Invalid field type for bar chart.");
    }
  }
}
