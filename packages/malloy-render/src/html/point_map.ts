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

import * as lite from "vega-lite";
import { DataArray, DataColumn, Field } from "@malloy-lang/malloy";
import usAtlas from "us-atlas/states-10m.json";
import { HTMLChartRenderer } from "./chart";
import { getColorScale } from "./utils";

export class HTMLPointMapRenderer extends HTMLChartRenderer {
  getDataValue(data: DataColumn): string | number {
    if (data.isNumber() || data.isString()) {
      return data.getValue();
    } else if (data.isTimestamp() || data.isDate()) {
      // TODO crs
      return data.getValue() as unknown as string;
    }
    throw new Error("Invalid field type for bar chart.");
  }

  getDataType(field: Field): "ordinal" | "quantitative" | "nominal" {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp() || field.isString()) {
        return "nominal";
      } else if (field.isNumber()) {
        return "quantitative";
      }
    }
    throw new Error("Invalid field type for bar chart.");
  }

  getVegaLiteSpec(data: DataArray): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error("Expected struct value not to be null.");
    }

    const fields = data.getField().getFields();

    const latField = fields[0];
    const lonField = fields[1];
    const colorField = fields[2];
    const sizeField = fields[3];
    const shapeField = fields[4];

    const colorType = colorField ? this.getDataType(colorField) : undefined;
    const sizeType = sizeField ? this.getDataType(sizeField) : undefined;
    const shapeType = shapeField ? this.getDataType(shapeField) : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.getName(),
            type: colorType,
            axis: { title: colorField.getName() },
            scale: getColorScale(colorType, false),
          }
        : undefined;

    const sizeDef = sizeField
      ? {
          field: sizeField.getName(),
          type: sizeType,
          axis: { title: sizeField.getName() },
        }
      : { value: 5 };

    const shapeDef = shapeField
      ? {
          field: shapeField.getName(),
          type: shapeType,
          axis: { title: shapeField.getName() },
        }
      : { value: "circle" };

    return {
      width: 250,
      height: 200,
      data: {
        values: this.mapData(data),
      },
      projection: {
        type: "albersUsa",
      },
      layer: [
        {
          data: {
            values: usAtlas,
            format: {
              type: "topojson",
              feature: "states",
            },
          },
          mark: {
            type: "geoshape",
            fill: "#efefef",
            stroke: "white",
          },
        },
        {
          mark: "point",
          encoding: {
            latitude: { field: latField.getName(), type: "quantitative" },
            longitude: { field: lonField.getName(), type: "quantitative" },
            size: sizeDef,
            color: colorDef,
            shape: shapeDef,
          },
        },
      ],
      background: "transparent",
      config: {
        axis: {
          labelFont: "Roboto",
          titleFont: "Roboto",
          titleFontWeight: 500,
          titleColor: "#505050",
          titleFontSize: 12,
        },
        legend: {
          labelFont: "Roboto",
          titleFont: "Roboto",
          titleFontWeight: 500,
          titleColor: "#505050",
          titleFontSize: 12,
        },
        header: {
          labelFont: "Roboto",
          titleFont: "Roboto",
          titleFontWeight: 500,
        },
        mark: { font: "Roboto" },
        title: { font: "Roboto", subtitleFont: "Roboto", fontWeight: 500 },
      },
    };
  }
}
