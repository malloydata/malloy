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

import { FieldDef, isMeasureLike } from "@malloy-lang/malloy";
import {
  BarChartRenderOptions,
  ChartSize,
  StyleDefaults,
} from "../data_styles";
import { DataValue, DataPointer, isDataTree } from "../data_table";
import { HtmlVegaSpecRenderer, vegaSpecs } from "./vega_spec";

function isOrdninal(f: FieldDef): boolean {
  return ["string", "date", "timestamp", "boolean"].includes(f.type);
}

export class HtmlBarChartRenderer extends HtmlVegaSpecRenderer {
  size: ChartSize;
  constructor(styleDefaults: StyleDefaults, options: BarChartRenderOptions) {
    super(styleDefaults, vegaSpecs["bar_SM"]);
    this.size = options.size || this.styleDefaults.size || "medium";
  }

  async render(table: DataValue, _ref: DataPointer): Promise<string> {
    if (!isDataTree(table)) {
      throw new Error("Invalid type for chart renderer");
    }
    if (table.structDef.fields.length < 2) {
      return "Need at least 2 fields for a bar chart.";
    }
    let specName = "bar_";
    if (isOrdninal(table.structDef.fields[0])) {
      specName += "S";
    } else if (table.structDef.fields[0].type === "number") {
      specName += "N";
    } else {
      return "Invalid type for first field of a bar_chart";
    }
    specName += "M";
    if (table.structDef.fields.length >= 3) {
      const field = table.structDef.fields[2];
      if (isMeasureLike(field)) {
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
    return super.render(table, _ref);
  }
}
