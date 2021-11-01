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

import { FieldDef, StructDef } from "@malloy-lang/malloy";
import { StyleDefaults } from "../data_styles";
import { DataPointer, DataValue, isDataTree } from "../data_table";
import { ContainerRenderer } from "./container";

export class HtmlListRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "small",
  };

  getValueField(struct: StructDef): FieldDef {
    return struct.fields[0];
  }

  getDetailField(_struct: StructDef): FieldDef | undefined {
    return undefined;
  }

  async render(table: DataValue, _ref: DataPointer): Promise<string> {
    if (!isDataTree(table)) {
      return "Invalid data for chart renderer.";
    }
    if (table.rows.length === 0) {
      return "⌀";
    }
    const metadata = table.structDef;

    const valueField = this.getValueField(metadata);
    const detailField = this.getDetailField(metadata);

    const renderedItems = [];
    for (let rowNum = 0; rowNum < table.rows.length; rowNum++) {
      let renderedItem = "";
      const childRenderer = this.childRenderers[valueField.name];
      const rendered = await childRenderer.render(
        table.getValue(rowNum, valueField.name),
        new DataPointer(table, rowNum, valueField.name)
      );
      renderedItem += rendered;
      if (detailField) {
        const childRenderer = this.childRenderers[detailField.name];
        const rendered = await childRenderer.render(
          table.getValue(rowNum, detailField.name),
          new DataPointer(table, rowNum, detailField.name)
        );
        renderedItem += ` (${rendered})`;
      }
      renderedItems.push(renderedItem);
    }
    return `<span>${renderedItems.join(", ")}</span>`;
  }
}
