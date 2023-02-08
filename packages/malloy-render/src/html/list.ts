/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { DataColumn, Explore, Field } from "@malloydata/malloy";
import { StyleDefaults } from "../data_styles";
import { ContainerRenderer } from "./container";
import { createErrorElement, yieldTask } from "./utils";

export class HTMLListRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    "size": "small"
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
