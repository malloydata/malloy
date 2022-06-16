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
import { DataColumn, Explore, Field } from "@malloydata/malloy";
import usAtlas from "us-atlas/states-10m.json";
import { HTMLChartRenderer } from "./chart";
import { STATE_CODES } from "./state_codes";
import { getColorScale } from "./utils";

export class HTMLShapeMapRenderer extends HTMLChartRenderer {
  private getRegionField(explore: Explore): Field {
    return explore.intrinsicFields[0];
  }

  private getColorField(explore: Explore): Field {
    return explore.intrinsicFields[1];
  }

  getDataValue(data: DataColumn): string | number | undefined {
    if (data.isNumber()) {
      return data.value;
    } else if (data.isString()) {
      if (data.field === this.getRegionField(data.field.parentExplore)) {
        const id = STATE_CODES[data.value];
        if (id === undefined) {
          return undefined;
        }
        return id;
      } else {
        return data.value;
      }
    } else if (data.isNull()) {
      // ignore nulls
      return undefined;
    } else {
      throw new Error("Invalid field type for shape map.");
    }
  }

  getDataType(field: Field): "ordinal" | "quantitative" | "nominal" {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp()) {
        return "nominal";
      } else if (field.isString()) {
        if (field === this.getRegionField(field.parentExplore)) {
          return "quantitative";
        } else {
          return "nominal";
        }
      } else if (field.isNumber()) {
        return "quantitative";
      }
    }
    throw new Error("Invalid field type for shape map.");
  }

  getSize(): { height: number; width: number } {
    if (this.size === "large") {
      return { height: 350, width: 500 };
    } else {
      return { height: 200, width: 250 };
    }
  }

  getVegaLiteSpec(data: DataColumn): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error("Expected struct value not to be null.");
    }

    if (!data.isArray()) {
      throw new Error("Invalid data for shape map");
    }

    const regionField = this.getRegionField(data.field);
    const colorField = this.getColorField(data.field);

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

    const mapped = this.mapData(data).filter(
      (row) => row[regionField.name] !== undefined
    );

    return {
      ...this.getSize(),
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
        mark: { font: "var(--malloy-font-family, Roboto)" },
        title: {
          font: "var(--malloy-font-family, Roboto)",
          subtitleFont: "var(--malloy-font-family, Roboto)",
          fontWeight: 500,
        },
      },
    };
  }
}
