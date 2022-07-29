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
  DataArray,
  DataColumn,
  Field,
  TimestampTimeframe,
} from "@malloydata/malloy";
import usAtlas from "us-atlas/states-10m.json";
import { HTMLChartRenderer } from "./chart";
import { getColorScale, timeToString } from "./utils";

export class HTMLPointMapRenderer extends HTMLChartRenderer {
  getDataValue(data: DataColumn): string | number {
    if (data.isNumber() || data.isString()) {
      return data.value;
    } else if (data.isTimestamp() || data.isDate()) {
      return timeToString(
        data.value,
        data.field.timeframe || TimestampTimeframe.Second
      );
    }
    throw new Error("Invalid field type for point map chart.");
  }

  getDataType(field: Field): "ordinal" | "quantitative" | "nominal" {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp() || field.isString()) {
        return "nominal";
      } else if (field.isNumber()) {
        return "quantitative";
      }
    }
    throw new Error("Invalid field type for point map.");
  }

  getVegaLiteSpec(data: DataArray): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error("Expected struct value not to be null.");
    }

    const fields = data.field.intrinsicFields;

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
      ...this.getSize(),
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
          labelFont: "var(--malloy-font-family, Roboto)",
          titleFont: "var(--malloy-font-family, Roboto)",
          titleFontWeight: 500,
          titleColor: "var(--malloy-title-color, #505050)",
          labelColor: "var(--malloy-label-color, #000000)",
          titleFontSize: 12,
        },
        legend: {
          labelFont: "var(--malloy-font-family, Roboto)",
          titleFont: "var(--malloy-font-family, Roboto)",
          titleFontWeight: 500,
          titleColor: "var(--malloy-title-color, #505050)",
          labelColor: "var(--malloy-label-color, #000000)",
          titleFontSize: 12,
        },
        header: {
          labelFont: "var(--malloy-font-family, Roboto)",
          titleFont: "var(--malloy-font-family, Roboto)",
          titleFontWeight: 500,
        },
        mark: { font: "var(--malloy-Roboto" },
        title: {
          font: "var(--malloy-font-family, Roboto)",
          subtitleFont: "var(--malloy-font-family, Roboto)",
          fontWeight: 500,
        },
      },
    };
  }
}
