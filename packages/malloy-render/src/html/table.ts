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

import { StyleDefaults } from "../data_styles";
import { DataPointer, DataValue, isDataTree } from "../data_table";
import { getDrillPath, getDrillQuery } from "../drill";
// import { getDrillPath, getDrillQuery } from "../drill";
import { ContainerRenderer } from "./container";
import { HtmlNumberRenderer } from "./number";

export class HtmlTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "small",
  };

  async render(
    dom: Document,
    table: DataValue,
    ref: DataPointer,
    onDrill: (drillQuery: string) => void
  ): Promise<Element> {
    if (!isDataTree(table)) {
      throw new Error("Invalid type for Table Renderer");
    }
    const header = dom.createElement("tr");
    table.getFieldNames().forEach((name) => {
      const childRenderer = this.childRenderers[name];
      const isNumeric = childRenderer instanceof HtmlNumberRenderer;
      const headerRow = dom.createElement("th");
      headerRow.style.cssText = `padding: 8px; color: #505050; border-bottom: 1px solid #eaeaea; text-align: ${
        isNumeric ? "right" : "left"
      };`;
      headerRow.innerHTML = name.replace(/_/g, "_&#8203;");
      header.appendChild(headerRow);
    });
    header.appendChild(dom.createElement("th"));

    const tableBody = dom.createElement("tbody");
    for (let rowNum = 0; rowNum < table.rows.length; rowNum++) {
      const rowElement = dom.createElement("tr");
      for (const fieldName of table.getFieldNames()) {
        const childRenderer = this.childRenderers[fieldName];
        const isNumeric = childRenderer instanceof HtmlNumberRenderer;
        const rendered = await childRenderer.render(
          dom,
          table.getValue(rowNum, fieldName),
          new DataPointer(table, rowNum, fieldName),
          onDrill
        );
        const cellElement = dom.createElement("td");
        cellElement.style.cssText = `padding: ${
          childRenderer instanceof HtmlTableRenderer ? "0" : "8px"
        }; vertical-align: top; border-bottom: 1px solid #eaeaea; ${
          isNumeric ? "text-align: right;" : ""
        }`;
        cellElement.appendChild(rendered);
        rowElement.appendChild(cellElement);
      }
      const drillPath = getDrillPath(ref, rowNum);
      const drillQuery = getDrillQuery(table.root(), drillPath);
      const drillCell = dom.createElement("td");
      drillCell.innerText = "drill";
      drillCell.onclick = () => onDrill(drillQuery);
      rowElement.appendChild(drillCell);
      tableBody.appendChild(rowElement);
    }
    const tableElement = dom.createElement("table");
    tableElement.style.cssText = `border: 1px solid #eaeaea; vertical-align: top; border-bottom: 1px solid #eaeaea; border-collapse: collapse; width: 100%;`;
    const tableHead = dom.createElement("thead");
    tableHead.appendChild(header);
    tableElement.appendChild(tableHead);
    tableElement.appendChild(tableBody);
    return tableElement;
  }
}
