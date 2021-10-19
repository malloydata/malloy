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

import { FieldDef, StructDef } from "malloy";
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

  async render(
    dom: Document,
    table: DataValue,
    _ref: DataPointer,
    onDrill: (drillQuery: string) => void
  ): Promise<Element> {
    if (!isDataTree(table)) {
      const element = document.createElement("span");
      element.innerText = "Invalid data for chart renderer.";
      return element;
    }
    if (table.rows.length === 0) {
      const element = document.createElement("span");
      element.innerText = "⌀";
      return element;
    }
    const metadata = table.structDef;

    const valueField = this.getValueField(metadata);
    const detailField = this.getDetailField(metadata);

    const element = dom.createElement("span");
    for (let rowNum = 0; rowNum < table.rows.length; rowNum++) {
      const childRenderer = this.childRenderers[valueField.name];
      const rendered = await childRenderer.render(
        dom,
        table.getValue(rowNum, valueField.name),
        new DataPointer(table, rowNum, valueField.name),
        onDrill
      );
      element.appendChild(rendered);
      if (detailField) {
        const childRenderer = this.childRenderers[detailField.name];
        const rendered = await childRenderer.render(
          dom,
          table.getValue(rowNum, detailField.name),
          new DataPointer(table, rowNum, detailField.name),
          onDrill
        );
        element.appendChild(dom.createTextNode("("));
        element.appendChild(rendered);
        element.appendChild(dom.createTextNode(")"));
      }
    }
    return element;
  }
}
