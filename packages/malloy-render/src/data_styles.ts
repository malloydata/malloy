/*
 * Copyright 2022 Google LLC
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

export type DataStyles = { [fieldName: string]: RenderDef };
export type ChartSize = "small" | "medium" | "large";

export type RenderDef =
  | ({ renderer?: undefined } & DataRenderOptions)
  | ({ renderer: "table" } & TableRenderOptions)
  | ({ renderer: "dashboard" } & DashboardRenderOptions)
  | ({ renderer: "text" } & TextRenderOptions)
  | ({ renderer: "currency" } & CurrencyRenderOptions)
  | ({ renderer: "image" } & ImageRenderOptions)
  | ({ renderer: "time" } & TimeRenderOptions)
  | ({ renderer: "json" } & JSONRenderOptions)
  | ({ renderer: "single_value" } & SingleValueRenderOptions)
  | ({ renderer: "list" } & ListRenderOptions)
  | ({ renderer: "list_detail" } & ListDetailRenderOptions)
  | ({ renderer: "cartesian_chart" } & CartesianChartRenderOptions)
  | ({ renderer: "bar_chart" } & BarChartRenderOptions)
  | ({ renderer: "scatter_chart" } & ScatterChartRenderOptions)
  | ({ renderer: "line_chart" } & LineChartRenderOptions)
  | ({ renderer: "point_map" } & PointMapRenderOptions)
  | ({ renderer: "segment_map" } & SegmentMapRenderOptions)
  | ({ renderer: "shape_map" } & ShapeMapRenderOptions)
  | ({ renderer: "number" } & NumberRenderOptions)
  | ({ renderer: "percent" } & PercentRenderOptions)
  | ({ renderer: "boolean" } & BooleanRenderOptions)
  | ({ renderer: "spark_line" } & SparkLineRenderOptions)
  | ({ renderer: "bytes" } & BytesRenderOptions)
  | ({ renderer: "link" } & LinkRenderOptions)
  | ({ renderer: "vega" } & VegaRenderOptions);

export interface DataRenderOptions {
  data?: {
    color?: string;
    label?: string;
  };
  sheet?: DataStyles;
}

export type StyleDefaults = {
  size?: ChartSize;
};

export interface TableRenderOptions extends DataRenderOptions {
  table?: {
    pivot?: string | string[];
  };
}

export interface DashboardRenderOptions extends DataRenderOptions {
  dashboard?: Record<string, unknown>;
}

export interface TextRenderOptions extends DataRenderOptions {
  text?: {
    italic?: boolean;
  };
}

export interface BytesRenderOptions extends TextRenderOptions {
  bytes?: Record<string, unknown>;
}

export interface CurrencyRenderOptions extends TextRenderOptions {
  currency?: {
    unit?: "dollars" | "pounds";
  };
}

export interface TimeRenderOptions extends TextRenderOptions {
  time?: Record<string, unknown>;
}

export interface NumberRenderOptions extends TextRenderOptions {
  number?: Record<string, unknown>;
}

export interface ImageRenderOptions extends TextRenderOptions {
  border?: boolean;
}

export interface PercentRenderOptions extends TextRenderOptions {
  percent?: Record<string, unknown>;
}

export interface BooleanRenderOptions extends TextRenderOptions {
  boolean?: Record<string, unknown>;
}

export interface JSONRenderOptions extends DataRenderOptions {
  json?: Record<string, unknown>;
}

export interface LinkRenderOptions extends DataRenderOptions {
  link?: Record<string, unknown>;
}

export interface VegaRenderOptions extends DataRenderOptions {
  spec?: lite.TopLevelSpec;
  spec_name?: string;
}

export interface SingleValueRenderOptions extends DataRenderOptions {
  // eslint-disable-next-line camelcase
  single_value?: Record<string, unknown>;
}

export interface ListRenderOptions extends DataRenderOptions {
  list?: {
    separator?: string;
    value?: string;
  };
}

export interface ListDetailRenderOptions extends DataRenderOptions {
  list?: {
    separator?: string;
    value?: string;
    detail?: string;
  };
}

export interface ChartRenderOptions extends DataRenderOptions {
  size?: ChartSize;
  chart?: {
    color?: string;
    shape?: string;
  };
}

export interface CartesianChartRenderOptions extends ChartRenderOptions {
  // eslint-disable-next-line camelcase
  chart?: {
    // eslint-disable-next-line camelcase
    x_axis?: string;
    // eslint-disable-next-line camelcase
    y_axis?: string;
    color?: string;
    shape?: string;
    spark_line?: boolean;
  };
}

export interface BarChartRenderOptions {
  size?: ChartSize;
}

export interface ScatterChartRenderOptions extends CartesianChartRenderOptions {
  // eslint-disable-next-line camelcase
  scatter_chart?: Record<string, unknown>;
}

export interface LineChartRenderOptions extends CartesianChartRenderOptions {
  // eslint-disable-next-line camelcase
  line_chart?: Record<string, unknown>;
}

export interface SparkLineRenderOptions extends LineChartRenderOptions {
  // eslint-disable-next-line camelcase
  spark_line?: Record<string, unknown>;
}

export interface PointMapRenderOptions extends ChartRenderOptions {
  chart?: {
    latitude?: string;
    longitude?: string;
    color?: string;
    shape?: string;
  };
}

export interface SegmentMapRenderOptions extends ChartRenderOptions {
  chart?: {
    latitude1?: string;
    longitude1?: string;
    latitude2?: string;
    longitude2?: string;
    color?: string;
    shape?: string;
  };
}

export interface ShapeMapRenderOptions extends ChartRenderOptions {
  chart?: {
    region?: string;
    color?: string;
    shape?: string;
  };
}
