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

export class HTMLSegmentMapRenderer extends HTMLChartRenderer {
  getDataValue(data: DataColumn): string | number | null {
    if (data.isNull() || data.isNumber() || data.isString()) {
      return data.value;
    }
    throw new Error("Invalid field type for segment map.");
  }

  getDataType(field: Field): "ordinal" | "quantitative" | "nominal" {
    if (field.isAtomicField()) {
      if (field.isString()) {
        return "nominal";
      } else if (field.isNumber()) {
        return "quantitative";
      }
      // TODO dates nominal?
    }
    throw new Error("Invalid field type for segment map.");
  }

  getVegaLiteSpec(data: DataArray): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error("Expected struct value not to be null.");
    }

    const fields = data.field.intrinsicFields;

    const lat1Field = fields[0];
    const lon1Field = fields[1];
    const lat2Field = fields[2];
    const lon2Field = fields[3];
    const colorField = fields[4];

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
