/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { DataArray } from "@malloydata/malloy";
import * as lite from "vega-lite";
import { HTMLChartRenderer } from "./chart";
import { getColorScale } from "./utils";
import { DEFAULT_SPEC } from "./vega_spec";

export abstract class HTMLCartesianChartRenderer extends HTMLChartRenderer {
  abstract getMark(): "bar" | "line" | "point";

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
            "field": colorField.name,
            "type": colorType,
            "axis": { "title": colorField.name },
            "scale": getColorScale(colorType, mark === "bar"),
          }
        : { "value": "#4285F4" };

    const sizeDef = sizeField
      ? {
          "field": sizeField.name,
          "type": sizeType,
          "axis": { "title": sizeField.name },
        }
      : undefined;

    const shapeDef = shapeField
      ? {
          "field": shapeField.name,
          "type": shapeType,
          "axis": { "title": shapeField.name },
        }
      : undefined;

    const xSort = xType === "nominal" ? null : undefined;
    const ySort = yType === "nominal" ? null : undefined;

    const xDef = {
      "field": xField.name,
      "type": xType,
      "sort": xSort,
      "axis": { "title": xField.name },
    };

    const yDef = {
      "field": yField.name,
      "type": yType,
      "sort": ySort,
      "axis": { "title": yField.name },
    };

    return {
      ...DEFAULT_SPEC,
      ...this.getSize(),
      "data": {
        "values": this.mapData(data),
      },
      mark,
      "encoding": {
        "x": xDef,
        "y": yDef,
        "size": sizeDef,
        "color": colorDef,
        "shape": shapeDef,
      },
      "background": "transparent",
    };
  }
}
