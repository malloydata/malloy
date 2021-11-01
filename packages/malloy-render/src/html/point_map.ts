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
import {
  FieldDef,
  QueryData,
  QueryValue,
  StructDef,
} from "@malloy-lang/malloy";
import usAtlas from "us-atlas/states-10m.json";
import { HtmlChartRenderer } from "./chart";
import { getColorScale } from "./utils";

export class HtmlPointMapRenderer extends HtmlChartRenderer {
  getDataValue(value: QueryValue, field: FieldDef): string | number {
    switch (field.type) {
      case "number":
        return value as number;
      case "timestamp":
      case "date":
      case "string":
        return value as string;
      default:
        throw new Error("Invalid field type for bar chart.");
    }
  }

  getDataType(field: FieldDef): "ordinal" | "quantitative" | "nominal" {
    switch (field.type) {
      case "date":
      case "timestamp":
      case "string":
        return "nominal";
      case "number":
        return "quantitative";
      default:
        throw new Error("Invalid field type for bar chart.");
    }
  }

  getVegaLiteSpec(data: QueryValue, metadata: StructDef): lite.TopLevelSpec {
    if (data === null) {
      throw new Error("Expected struct value not to be null.");
    }

    const typedData = data as QueryData;

    const latField = metadata.fields[0];
    const lonField = metadata.fields[1];
    const colorField = metadata.fields[2];
    const sizeField = metadata.fields[3];
    const shapeField = metadata.fields[4];

    const colorType = colorField ? this.getDataType(colorField) : undefined;
    const sizeType = sizeField ? this.getDataType(sizeField) : undefined;
    const shapeType = shapeField ? this.getDataType(shapeField) : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: { title: colorField.name },
            scale: getColorScale(colorType, false),
          }
        : undefined;

    const sizeDef = sizeField
      ? {
          field: sizeField.name,
          type: sizeType,
          axis: { title: sizeField.name },
        }
      : { value: 5 };

    const shapeDef = shapeField
      ? {
          field: shapeField.name,
          type: shapeType,
          axis: { title: shapeField.name },
        }
      : { value: "circle" };

    return {
      width: 250,
      height: 200,
      data: {
        values: this.mapData(
          typedData,
          [latField, lonField, colorField, shapeField, sizeField],
          metadata
        ),
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
            latitude: { field: latField.name, type: "quantitative" },
            longitude: { field: lonField.name, type: "quantitative" },
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
