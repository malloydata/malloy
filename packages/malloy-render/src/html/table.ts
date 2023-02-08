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

import { DataColumn } from "@malloydata/malloy";
import { StyleDefaults } from "../data_styles";
import { getDrillQuery } from "../drill";
import { ContainerRenderer } from "./container";
import { HTMLNumberRenderer } from "./number";
import { createDrillIcon, yieldTask } from "./utils";

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    "size": "medium"
  };

  async render(table: DataColumn): Promise<HTMLElement> {
    if (!table.isArray() && !table.isRecord()) {
      throw new Error("Invalid type for Table Renderer");
    }
    const header = this.document.createElement("tr");
    table.field.intrinsicFields.forEach((field) => {
      const name = field.name;
      const childRenderer = this.childRenderers[name];
      const isNumeric = childRenderer instanceof HTMLNumberRenderer;
      const headerCell = this.document.createElement("th");
      headerCell.style.cssText = `
        padding: 8px;
        color: var(--malloy-title-color, #505050);
        border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
        text-align: ${isNumeric ? "right" : "left"};
      `;
      headerCell.innerHTML = name.replace(/_/g, "_&#8203;");
      header.appendChild(headerCell);
    });
    if (this.options.isDrillingEnabled) {
      const drillHeader = this.document.createElement("th");
      drillHeader.style.cssText = `
        padding: 8px;
        color: var(--malloy-title-color, #505050);
        border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
        width: 25px;
      `;
      header.appendChild(drillHeader);
    }

    const tableBody = this.document.createElement("tbody");

    for (const row of table) {
      const rowElement = this.document.createElement("tr");
      for (const field of table.field.intrinsicFields) {
        const childRenderer = this.childRenderers[field.name];
        const isNumeric = childRenderer instanceof HTMLNumberRenderer;
        await yieldTask();
        const rendered = await childRenderer.render(row.cell(field));
        const cellElement = this.document.createElement("td");
        cellElement.style.cssText = `
          padding: ${childRenderer instanceof HTMLTableRenderer ? "0" : "8px"};
          vertical-align: top;
          border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
          ${isNumeric ? "text-align: right;" : ""}
        `;
        cellElement.appendChild(rendered);
        rowElement.appendChild(cellElement);
      }
      if (this.options.isDrillingEnabled) {
        const drillCell = this.document.createElement("td");
        const drillIcon = createDrillIcon(this.document);
        drillCell.appendChild(drillIcon);
        drillCell.style.cssText = `
          padding: 8px;
          vertical-align: top;
          border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
          width: 25px;
          cursor: pointer
        `;
        drillCell.onclick = () => {
          if (this.options.onDrill) {
            const { drillQuery, drillFilters } = getDrillQuery(row);
            this.options.onDrill(drillQuery, drillIcon, drillFilters);
          }
        };
        rowElement.appendChild(drillCell);
      }
      tableBody.appendChild(rowElement);
    }
    const tableElement = this.document.createElement("table");
    tableElement.style.cssText = `
      border: 1px solid var(--malloy-border-color, #eaeaea);
      vertical-align: top;
      border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
      border-collapse: collapse;
      width: 100%;
    `;
    const tableHead = this.document.createElement("thead");
    tableHead.appendChild(header);
    tableElement.appendChild(tableHead);
    tableElement.appendChild(tableBody);
    return tableElement;
  }
}
