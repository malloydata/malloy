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

import { DataColumn, Field, Explore } from "@malloydata/malloy";
import { StyleDefaults } from "../data_styles";
import { ContainerRenderer } from "./container";
import { createErrorElement, yieldTask } from "./utils";

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

  async render(table: DataColumn): Promise<HTMLElement> {
    if (!table.isArray()) {
      return createErrorElement(
        this.document,
        "Invalid data for chart renderer."
      );
    }
    if (table.rowCount === 0) {
      return this.document.createElement("span");
    }

    const valueField = this.getValueField(table.field);
    const detailField = this.getDetailField(table.field);

    const element = this.document.createElement("span");
    let isFirst = true;
    for (const row of table) {
      if (!isFirst) {
        element.appendChild(this.document.createTextNode(", "));
      }
      isFirst = false;
      const childRenderer = this.childRenderers[valueField.name];
      const rendered = await childRenderer.render(row.cell(valueField));
      element.appendChild(rendered);
      if (detailField) {
        const childRenderer = this.childRenderers[detailField.name];
        await yieldTask();
        const rendered = await childRenderer.render(row.cell(detailField));
        element.appendChild(this.document.createTextNode("("));
        element.appendChild(rendered);
        element.appendChild(this.document.createTextNode(")"));
      }
    }
    return element;
  }
}
