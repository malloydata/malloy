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

export class HtmlSegmentMapRenderer extends HtmlChartRenderer {
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

    const lat1Field = metadata.fields[0];
    const lon1Field = metadata.fields[1];
    const lat2Field = metadata.fields[2];
    const lon2Field = metadata.fields[3];
    const colorField = metadata.fields[4];

    const colorType = colorField ? this.getDataType(colorField) : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: { title: colorField.name },
            scale: getColorScale(colorType, false),
          }
        : undefined;

    return {
      width: 250,
      height: 200,
      data: {
        values: this.mapData(
          typedData,
          [lat1Field, lon1Field, lat2Field, lon2Field, colorField],
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
            fill: "lightgray",
            stroke: "white",
          },
        },
        {
          mark: "line",
          encoding: {
            latitude: { field: lat1Field.name, type: "quantitative" },
            longitude: { field: lon1Field.name, type: "quantitative" },
            latitude2: { field: lat2Field.name, type: "quantitative" },
            longitude2: { field: lon2Field.name, type: "quantitative" },
            color: colorDef,
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
