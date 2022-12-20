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
import * as vega from "vega";
import { DataArray, DataColumn, Field } from "@malloydata/malloy";
import { Renderer } from "../renderer";
import { ChartRenderOptions, StyleDefaults } from "../data_styles";

type MappedRow = { [p: string]: string | number | Date | undefined | null };

export abstract class HTMLChartRenderer implements Renderer {
  size: string;
  abstract getDataType(
    field: Field
  ): "temporal" | "ordinal" | "quantitative" | "nominal";

  abstract getDataValue(
    value: DataColumn
  ): Date | string | number | null | undefined;

  mapData(data: DataArray): MappedRow[] {
    const mappedRows: MappedRow[] = [];
    for (const row of data) {
      const mappedRow: {
        [p: string]: string | number | Date | undefined | null;
      } = {};
      for (const field of data.field.intrinsicFields) {
        mappedRow[field.name] = this.getDataValue(row.cell(field));
      }
      mappedRows.push(mappedRow);
    }
    return mappedRows;
  }

  getSize(): { height: number; width: number } {
    if (this.size === "large") {
      return { height: 350, width: 500 };
    } else {
      return { height: 175, width: 250 };
    }
  }

  constructor(
    protected readonly document: Document,
    protected styleDefaults: StyleDefaults,
    options: ChartRenderOptions = {}
  ) {
    this.size = options.size || this.styleDefaults.size || "medium";
  }

  abstract getVegaLiteSpec(data: DataArray): lite.TopLevelSpec;

  async render(table: DataColumn): Promise<HTMLElement> {
    if (!table.isArray()) {
      throw new Error("Invalid type for chart renderer");
    }

    const spec = this.getVegaLiteSpec(table);

    const vegaspec = lite.compile(spec, {
      logger: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        level(newLevel: number) {
          if (newLevel !== undefined) {
            return this;
          }
          return 0;
        },
        info() {
          return this;
        },
        error() {
          return this;
        },
        warn() {
          return this;
        },
        debug() {
          return this;
        },
      },
    }).spec;
    const view = new vega.View(vega.parse(vegaspec), {
      renderer: "none",
    });
    view.logger().level(-1);
    const element = this.document.createElement("div");
    element.innerHTML = await view.toSVG();
    return element;
  }
}
