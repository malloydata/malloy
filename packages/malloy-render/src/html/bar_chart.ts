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
import { AtomicFieldType } from "@malloydata/malloy/src/malloy";
import {
  BarChartRenderOptions,
  ChartSize,
  StyleDefaults,
} from "../data_styles";
import { createErrorElement } from "./utils";
import { HTMLVegaSpecRenderer, vegaSpecs } from "./vega_spec";

function isOrdninal(field: Field): boolean {
  return (
    field.isAtomicField() &&
    (field.isString() ||
      field.isDate() ||
      field.isTimestamp() ||
      field.isBoolean())
  );
}

export class HTMLBarChartRenderer extends HTMLVegaSpecRenderer {
  size: ChartSize;
  constructor(
    document: Document,
    styleDefaults: StyleDefaults,
    options: BarChartRenderOptions
  ) {
    super(document, styleDefaults, vegaSpecs["bar_SM"]);
    this.size = options.size || this.styleDefaults.size || "medium";
  }

  async render(table: DataColumn): Promise<Element> {
    if (!table.isArray()) {
      return createErrorElement(
        this.document,
        "Invalid type for bar chart renderer"
      );
    }
    const fields = table.field.intrinsicFields;
    if (fields.length < 2) {
      return createErrorElement(
        this.document,
        "Need at least 2 fields for a bar chart."
      );
    }
    let specName = "bar_";
    if (isOrdninal(fields[0])) {
      specName += "S";
    } else if (
      fields[0].isAtomicField() &&
      fields[0].type === AtomicFieldType.Number
    ) {
      specName += "N";
    } else {
      return createErrorElement(
        this.document,
        "Invalid type for first field of a bar_chart"
      );
    }
    specName += "M";
    if (fields.length >= 3 && fields[2].isAtomicField()) {
      const field = fields[2];
      if (field.sourceWasMeasure() && field.isNumber()) {
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
      return createErrorElement(
        this.document,
        `Unknown vega spec '${specName}'`
      );
    }
    this.spec = spec;
    return super.render(table);
  }
}
