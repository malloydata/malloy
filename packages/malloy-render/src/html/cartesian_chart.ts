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

import { DataArray } from "@malloydata/malloy";
import * as lite from "vega-lite";
import { HTMLChartRenderer } from "./chart";
import { getColorScale } from "./utils";
import { DEFAULT_SPEC } from "./vega_spec";

export abstract class HTMLCartesianChartRenderer extends HTMLChartRenderer {
  abstract getMark(): "bar" | "line" | "point";

  getSize(): { height: number; width: number } {
    if (this.size === "large") {
      return { height: 350, width: 500 };
    } else {
      return { height: 100, width: 150 };
    }
  }

  getVegaLiteSpec(data: DataArray): lite.TopLevelSpec {
    const fields = data.field.intrinsicFields;
    const xField = fields[0];
    const yField = fields[1];
    const colorField = fields[2];
    const sizeField = fields[3];
    const shapeField = fields[4];

    const xType = this.getDataType(xField);
    const yType = this.getDataType(yField);
    const colorType = colorField ? this.getDataType(colorField) : undefined;
    const sizeType = sizeField ? this.getDataType(sizeField) : undefined;
    const shapeType = shapeField ? this.getDataType(shapeField) : undefined;

    const mark = this.getMark();

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: { title: colorField.name },
            scale: getColorScale(colorType, mark === "bar"),
          }
        : { value: "#4285F4" };

    const sizeDef = sizeField
      ? {
          field: sizeField.name,
          type: sizeType,
          axis: { title: sizeField.name },
        }
      : undefined;

    const shapeDef = shapeField
      ? {
          field: shapeField.name,
          type: shapeType,
          axis: { title: shapeField.name },
        }
      : undefined;

    const xSort = xType === "nominal" ? null : undefined;
    const ySort = yType === "nominal" ? null : undefined;

    const xDef = {
      field: xField.name,
      type: xType,
      sort: xSort,
      axis: { title: xField.name },
    };

    const yDef = {
      field: yField.name,
      type: yType,
      sort: ySort,
      axis: { title: yField.name },
    };

    return {
      ...DEFAULT_SPEC,
      ...this.getSize(),
      data: {
        values: this.mapData(data),
      },
      mark,
      encoding: {
        x: xDef,
        y: yDef,
        size: sizeDef,
        color: colorDef,
        shape: shapeDef,
      },
      background: "transparent",
    };
  }
}
