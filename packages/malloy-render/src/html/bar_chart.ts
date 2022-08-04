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

import { DataColumn, Field } from "@malloydata/malloy";
import { HTMLCartesianChartRenderer } from "./cartesian_chart";

export class HTMLBarChartRenderer extends HTMLCartesianChartRenderer {
  getMark(): "bar" {
    return "bar";
  }

  getDataType(
    field: Field
  ): "temporal" | "ordinal" | "quantitative" | "nominal" {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp() || field.isString()) {
        return "nominal";
      } else if (field.isNumber()) {
        return "quantitative";
      }
    }
    throw new Error("Invalid field type for bar chart.");
  }

  getDataValue(data: DataColumn): Date | string | number | null {
    if (data.isNull()) {
      return null;
    } else if (
      data.isTimestamp() ||
      data.isDate() ||
      data.isNumber() ||
      data.isString()
    ) {
      return data.value;
    } else {
      throw new Error("Invalid field type for bar chart.");
    }
  }
}
