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

import { DataColumn, Field } from "@malloy-lang/malloy";
import { AtomicFieldType } from "@malloy-lang/malloy/src/malloy";
import {
  BarChartRenderOptions,
  ChartSize,
  StyleDefaults,
} from "../data_styles";
import { HTMLVegaSpecRenderer, vegaSpecs } from "./vega_spec";

function isOrdninal(field: Field): boolean {
  return (
    field.isAtomicField() &&
    [
      AtomicFieldType.String,
      AtomicFieldType.Date,
      AtomicFieldType.Timestamp,
      AtomicFieldType.Boolean,
    ].includes(field.getType())
  );
}

export class HTMLBarChartRenderer extends HTMLVegaSpecRenderer {
  size: ChartSize;
  constructor(styleDefaults: StyleDefaults, options: BarChartRenderOptions) {
    super(styleDefaults, vegaSpecs["bar_SM"]);
    this.size = options.size || this.styleDefaults.size || "medium";
  }

  async render(table: DataColumn): Promise<string> {
    if (!table.isArray()) {
      throw new Error("Invalid type for chart renderer");
    }
    const fields = table.getField().getFields();
    if (fields.length < 2) {
      return "Need at least 2 fields for a bar chart.";
    }
    let specName = "bar_";
    if (isOrdninal(fields[0])) {
      specName += "S";
    } else if (
      fields[0].isAtomicField() &&
      fields[0].getType() === AtomicFieldType.Number
    ) {
      specName += "N";
    } else {
      return "Invalid type for first field of a bar_chart";
    }
    specName += "M";
    if (fields.length >= 3) {
      const field = fields[2];
      if (field.isMeasureLike()) {
        specName += "M";
      } else if (isOrdninal(field)) {
        specName += "S";
      }
    }
    let spec = vegaSpecs[`${specName}_${this.size}`];
    if (spec === undefined) {
      spec = vegaSpecs[specName];
    }
    if (spec === undefined) {
      return `Unknown renderer ${specName}`;
    }
    this.spec = spec;
    return super.render(table);
  }
}
