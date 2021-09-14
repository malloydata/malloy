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
import { FieldDef, QueryDataRow, QueryValue, StructDef } from "malloy";
import { HtmlChartRenderer } from "./chart";
import { cloneDeep } from "lodash";
import { getColorScale } from "./utils";
import { StyleDefaults } from "../data_styles";

type DataContainer = Array<unknown> | Record<string, unknown>;

export const DEFAULT_SPEC: Partial<lite.TopLevelSpec> = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  config: {
    header: {
      labelFont: "Roboto",
      titleFont: "Roboto",
      titleFontWeight: 500,
    },
    text: { font: "Roboto" },
    mark: { font: "Roboto" },
    title: { font: "Roboto", subtitleFont: "Roboto", fontWeight: 500 },
    axis: {
      labelFont: "Roboto",
      titleFont: "Roboto",
      titleFontWeight: 500,
      titleColor: "#505050",
      titleFontSize: 12,
    },
    legend: {
      titleFontWeight: 500,
      titleColor: "#505050",
      titleFontSize: 12,
      labelFont: "Roboto",
      titleFont: "Roboto",
    },
  },
};

const sizeSmall = {
  height: 80,
  width: 150,
};

// const sizeMedium = {
//   height: 150,
//   width: 200,
// };

const sizeLarge = {
  height: 350,
  width: 500,
};

// bar with text in the bars.
const bar_SM: lite.TopLevelSpec = {
  ...DEFAULT_SPEC,
  encoding: {
    y: { field: "#{1}", type: "nominal", axis: null },
  },
  layer: [
    {
      mark: { type: "bar", color: "#aec7e8" },
      encoding: {
        x: {
          field: "#{2}",
          type: "quantitative",
        },
        color: { value: "#4285F4" },
      },
    },
    {
      mark: { type: "text", align: "left", x: 5 },
      encoding: {
        text: { field: "#{1}" },
      },
    },
  ],
};

const bar_SMS: lite.TopLevelSpec = {
  ...bar_SM,
  layer: [
    {
      ...bar_SM.layer[0],
      encoding: {
        // LTNOTE: I have no idea why this won't work.
        // ...bar_SM.layer[1].encoding,
        x: {
          field: "#{2}",
          type: "quantitative",
        },
        color: {
          field: "#{3}",
          scale: getColorScale("nominal", true, true),
          // scale: { range: backgroundColors },
        },
      },
    },
    bar_SM.layer[1],
  ],
};

const bar_SMM: lite.TopLevelSpec = {
  ...bar_SM,
  layer: [
    {
      ...bar_SM.layer[0],
      encoding: {
        // LTNOTE: I have no idea why this won't work.
        // ...bar_SM.layer[1].encoding,
        x: {
          field: "#{2}",
          type: "quantitative",
        },
        color: {
          field: "#{3}",
          type: "quantitative",
          scale: getColorScale("quantitative", true, true),
        },
      },
    },
    bar_SM.layer[1],
  ],
};

// simple column chart
const bar_NM: lite.TopLevelSpec = {
  ...DEFAULT_SPEC,
  mark: "bar",
  data: [],
  height: 150,
  width: 200,
  encoding: {
    x: { field: "#{1}", type: "nominal" },
    y: { field: "#{2}", type: "quantitative" },
    color: { value: "#4285F4" },
  },
};

const bar_NMS: lite.TopLevelSpec = {
  ...bar_NM,
  encoding: {
    ...bar_NM.encoding,
    color: {
      field: "#{3}",
      type: "nominal",
      scale: getColorScale("nominal", true),
    },
  },
};

const bar_NMM: lite.TopLevelSpec = {
  ...bar_NM,
  encoding: {
    ...bar_NM.encoding,
    color: {
      field: "#{3}",
      type: "quantitative",
      scale: getColorScale("quantitative", true),
    },
  },
};

export const vegaSpecs: Record<string, lite.TopLevelSpec> = {
  bar_SM,

  bar_SM_small: { ...bar_SM, ...sizeSmall },
  // bar_SM_medium: { ...bar_SM, ...sizeMedium }, // just use the default
  bar_SM_large: { ...bar_SM, ...sizeLarge },

  bar_SMS,
  bar_NM,
  bar_NMS,
  bar_NMM,
  bar_SMM,
  bar_SSMMM: {
    ...DEFAULT_SPEC,
    repeat: ["#{3}", "#{4}", "#{5}"],
    spec: {
      description: "A simple bar chart with embedded data.",
      encoding: {
        y: { field: "#{1}", type: "nominal", axis: null },
      },
      layer: [
        {
          mark: {
            type: "bar",
          },
          encoding: {
            x: {
              field: { repeat: "repeat" },
              type: "quantitative",
            },
            color: {
              field: "#{2}",
              scale: getColorScale("nominal", true, true),
            },
          },
        },
        {
          mark: { type: "text", align: "left", x: 5 },
          encoding: {
            text: { field: "#{1}" },
            detail: { aggregate: "count" },
          },
        },
      ],
    },
  },
  bubble_NNM: {
    ...DEFAULT_SPEC,
    data: [],
    mark: "circle",
    width: 400,
    encoding: {
      y: {
        field: "#{1}",
        type: "ordinal",
      },
      x: {
        field: "#{2}",
        type: "ordinal",
      },
      size: {
        field: "#{3}",
        type: "quantitative",
      },
      color: { value: "#4285F4" },
    },
  },
  heat_NNM: {
    ...DEFAULT_SPEC,
    data: [],
    mark: "bar",
    width: 400,
    encoding: {
      y: {
        field: "#{1}",
        type: "ordinal",
      },
      x: {
        field: "#{2}",
        type: "ordinal",
      },
      color: {
        field: "#{3}",
        type: "quantitative",
        scale: getColorScale("quantitative", false),
      },
    },
  },
  heat_SNM: {
    ...DEFAULT_SPEC,
    data: [],
    mark: "bar",
    width: 400,
    encoding: {
      y: {
        field: "#{1}",
        type: "nominal",
      },
      x: {
        field: "#{2}",
        type: "ordinal",
      },
      color: {
        field: "#{3}",
        type: "quantitative",
        scale: getColorScale("quantitative", false),
      },
    },
  },
  stacked_line_STM: {
    ...DEFAULT_SPEC,
    height: 50,
    data: [],
    mark: "area",
    encoding: {
      x: {
        field: "#{2}",
        type: "temporal",
        axis: { grid: false },
      },
      y: {
        field: "#{3}",
        type: "quantitative",
        axis: { grid: false },
        title: null,
      },
      color: {
        field: "#{1}",
        type: "nominal",
        legend: null,
        scale: getColorScale("nominal", false),
      },
      row: {
        field: "#{1}",
        type: "nominal",
      },
    },
  },
  grid_line_SSTM: {
    ...DEFAULT_SPEC,
    height: 50,
    data: [],
    mark: "area",
    encoding: {
      x: {
        field: "#{3}",
        type: "temporal",
        axis: { grid: false },
      },
      y: {
        field: "#{4}",
        type: "quantitative",
        axis: { grid: false },
        title: null,
      },
      color: {
        field: "#{1}",
        type: "nominal",
        legend: null,
        scale: getColorScale("nominal", false),
      },
      row: {
        field: "#{1}",
        type: "nominal",
      },
      column: {
        field: "#{2}",
        type: "nominal",
      },
    },
  },
};

export function isDataContainer(a: unknown): a is DataContainer {
  return a instanceof Array || a instanceof Object;
}

export class HtmlVegaSpecRenderer extends HtmlChartRenderer {
  spec: lite.TopLevelSpec;

  constructor(styleDefaults: StyleDefaults, spec: lite.TopLevelSpec) {
    super(styleDefaults);
    this.spec = spec;
  }

  getDataValue(
    value: QueryValue,
    field: FieldDef
  ): Date | string | number | null {
    switch (field.type) {
      case "timestamp":
      case "date":
        return value === null
          ? null
          : new Date((value as { value: string }).value);
      case "number":
        return value as number;
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

  translateField(metadata: StructDef, fieldString: string): string {
    const m = fieldString.match(/#\{(?<fieldnum>\d+)\}/);
    if (m && m.groups) {
      return metadata.fields[parseInt(m.groups["fieldnum"]) - 1].name;
    }
    return fieldString;
  }

  translateFields(node: DataContainer, metadata: StructDef): void {
    if (node instanceof Array) {
      for (const e of node) {
        if (isDataContainer(e)) {
          this.translateFields(e, metadata);
        }
      }
    } else if (node instanceof Object) {
      for (const [key, value] of Object.entries(node)) {
        if (key === "field" && typeof value === "string") {
          node[key] = this.translateField(metadata, value);
        } else if (key === "repeat" && value instanceof Array) {
          for (const k of value.keys()) {
            const fieldName = value[k];
            if (typeof fieldName === "string") {
              value[k] = this.translateField(metadata, fieldName);
            }
          }
        } else {
          if (isDataContainer(value)) {
            this.translateFields(value, metadata);
          }
        }
      }
    }
  }

  // formatData(data: QueryDataRow, metadata: StructDef): VegaData {
  //   const ret: VegaData = [];

  //   for (const row of QueryDataRow) {
  //     forEach){

  //     }
  //   }
  //   return ret;
  // }

  getVegaLiteSpec(data: QueryValue, metadata: StructDef): lite.TopLevelSpec {
    if (data === null) {
      throw new Error("Expected struct value not to be null.");
    }

    const newSpec = cloneDeep(this.spec);

    this.translateFields(newSpec as unknown as DataContainer, metadata);
    const rdata = {
      values: this.mapData(data as QueryDataRow[], metadata.fields, metadata),
    };
    newSpec.data = rdata;

    return newSpec;
  }
}
