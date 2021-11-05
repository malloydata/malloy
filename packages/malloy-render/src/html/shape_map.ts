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
import { STATE_CODES } from "./state_codes";
import { getColorScale } from "./utils";

export class HtmlShapeMapRenderer extends HtmlChartRenderer {
  getDataValue(
    value: QueryValue,
    field: FieldDef,
    metadata: StructDef
  ): string | number | undefined {
    switch (field.type) {
      case "number":
        return value as number;
      case "timestamp":
      case "date":
      case "string": {
        if (field === metadata.fields[0]) {
          const id = STATE_CODES[value as string];
          if (id === undefined) {
            return undefined;
          }
          return id;
        } else {
          return value as string;
        }
      }
      default:
        throw new Error("Invalid field type for bar chart.");
    }
  }

  getDataType(
    field: FieldDef,
    metadata: StructDef
  ): "ordinal" | "quantitative" | "nominal" {
    switch (field.type) {
      case "date":
      case "timestamp":
        return "nominal";
      case "string": {
        if (field === metadata.fields[0]) {
          return "quantitative";
        } else {
          return "nominal";
        }
      }
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

    const regionField = metadata.fields[0];
    const colorField = metadata.fields[1];

    const colorType = colorField
      ? this.getDataType(colorField, metadata)
      : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: { title: colorField.name },
            scale: getColorScale(colorType, false),
          }
        : undefined;

    const mapped = this.mapData(
      typedData,
      [regionField, colorField],
      metadata
    ).filter((row) => row[regionField.name] !== undefined);

    return {
      width: 250,
      height: 200,
      data: { values: mapped },
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
          transform: [
            {
              lookup: regionField.name,
              from: {
                data: {
                  values: usAtlas,
                  format: {
                    type: "topojson",
                    feature: "states",
                  },
                },
                key: "id",
              },
              as: "geo",
            },
          ],
          mark: "geoshape",
          encoding: {
            shape: { field: "geo", type: "geojson" },
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
