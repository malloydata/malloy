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

import { DataColumn } from "@malloydata/malloy";
import { StyleDefaults } from "../data_styles";
import { getDrillQuery } from "../drill";
import { ContainerRenderer } from "./container";
import { HTMLNumberRenderer } from "./number";
import { createDrillIcon, yieldTask } from "./utils";

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "small",
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
