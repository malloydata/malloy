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
import {
  FieldDef,
  QueryData,
  QueryDataRow,
  QueryValue,
  StructDef,
} from "@malloy-lang/malloy";
import { Renderer } from "../renderer";
import { DataPointer, DataValue, isDataTree } from "../data_table";
import { StyleDefaults } from "../data_styles";

export abstract class HTMLChartRenderer implements Renderer {
  abstract getDataType(
    field: FieldDef,
    metadata: StructDef
  ): "temporal" | "ordinal" | "quantitative" | "nominal";

  abstract getDataValue(
    value: QueryValue,
    field: FieldDef,
    metadata: StructDef
  ): Date | string | number | null | undefined;

  mapData(
    data: QueryData,
    dataFields: (FieldDef | undefined)[],
    metadata: StructDef
  ): { [p: string]: string | number | Date | undefined | null }[] {
    return data.map((row: QueryDataRow) => {
      const mappedRow: {
        [p: string]: string | number | Date | undefined | null;
      } = {};
      for (const dataField of dataFields) {
        if (dataField) {
          mappedRow[dataField.name] = this.getDataValue(
            row[dataField.name],
            dataField,
            metadata
          );
        }
      }
      return mappedRow;
    });
  }

  constructor(protected styleDefaults: StyleDefaults) {}

  abstract getVegaLiteSpec(
    data: QueryData,
    metadata: StructDef
  ): lite.TopLevelSpec;

  async render(table: DataValue, _ref: DataPointer): Promise<string> {
    if (!isDataTree(table)) {
      throw new Error("Invalid type for chart renderer");
    }

    const spec = this.getVegaLiteSpec(table.rows, table.structDef);

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
    return await view.toSVG();
  }
}
