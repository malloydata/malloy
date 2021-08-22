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

import { QueryData, StructDef } from "malloy";
import * as lite from "vega-lite";
import { HtmlChartRenderer } from "./chart";
import { getColorScale } from "./utils";

export abstract class HtmlCartesianChartRenderer extends HtmlChartRenderer {
  abstract getMark(): "bar" | "line" | "point";

  getVegaLiteSpec(data: QueryData, metadata: StructDef): lite.TopLevelSpec {
    const xField = metadata.fields[0];
    const yField = metadata.fields[1];
    const colorField = metadata.fields[2];
    const sizeField = metadata.fields[3];
    const shapeField = metadata.fields[4];

    const xType = this.getDataType(xField, metadata);
    const yType = this.getDataType(yField, metadata);
    const colorType = colorField
      ? this.getDataType(colorField, metadata)
      : undefined;
    const sizeType = sizeField
      ? this.getDataType(sizeField, metadata)
      : undefined;
    const shapeType = shapeField
      ? this.getDataType(shapeField, metadata)
      : undefined;

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
      width: 150,
      height: 100,
      data: {
        values: this.mapData(
          data,
          [xField, yField, colorField, sizeField, shapeField],
          metadata
        ),
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
      config: {
        // axis: {
        //   labelFont: "Roboto",
        //   titleFont: "Roboto",
        //   titleFontWeight: 500,
        //   titleColor: "#505050",
        //   titleFontSize: 12,
        // },
        legend: {
          labelFont: "Roboto",
          titleFont: "Roboto",
          titleFontWeight: 500,
          titleColor: "#505050",
          titleFontSize: 12,
        },
        // header: {
        //   labelFont: "Roboto",
        //   titleFont: "Roboto",
        //   titleFontWeight: 500,
        // },
        // mark: { font: "Roboto" },
        // title: { font: "Roboto", subtitleFont: "Roboto", fontWeight: 500 },
      },
    };
  }
}
