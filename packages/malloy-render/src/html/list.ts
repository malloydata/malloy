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

import { DataColumn, Field, Explore } from "@malloy-lang/malloy";
import { StyleDefaults } from "../data_styles";
import { ContainerRenderer } from "./container";
import { yieldTask } from "./utils";

export class HTMLListRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "small",
  };

  getValueField(struct: Explore): Field {
    return struct.intrinsicFields[0];
  }

  getDetailField(_struct: Explore): Field | undefined {
    return undefined;
  }

  async render(table: DataColumn): Promise<string> {
    if (!table.isArray()) {
      return "Invalid data for chart renderer.";
    }
    if (table.rowCount === 0) {
      return "⌀";
    }

    const valueField = this.getValueField(table.field);
    const detailField = this.getDetailField(table.field);

    const renderedItems = [];
    for (const row of table) {
      let renderedItem = "";
      const childRenderer = this.childRenderers[valueField.name];
      const rendered = await childRenderer.render(row.cell(valueField));
      renderedItem += rendered;
      if (detailField) {
        const childRenderer = this.childRenderers[detailField.name];
        await yieldTask();
        const rendered = await childRenderer.render(row.cell(detailField));
        renderedItem += ` (${rendered})`;
      }
      renderedItems.push(renderedItem);
    }
    return `<span>${renderedItems.join(", ")}</span>`;
  }
}
