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

import { DataColumn } from "@malloy-lang/malloy";
import { StyleDefaults } from "../data_styles";
// import { getDrillPath, getDrillQuery } from "../drill";
import { ContainerRenderer } from "./container";
import { HTMLNumberRenderer } from "./number";

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "small",
  };

  async render(table: DataColumn): Promise<string> {
    if (!table.isArray() && !table.isRecord()) {
      throw new Error("Invalid type for Table Renderer");
    }
    const header = table.field.intrinsicFields
      .map((field) => {
        const name = field.name;
        const childRenderer = this.childRenderers[name];
        const isNumeric = childRenderer instanceof HTMLNumberRenderer;
        return `<th style="padding: 8px; color: #505050; border-bottom: 1px solid #eaeaea; text-align: ${
          isNumeric ? "right" : "left"
        };">${name.replace(/_/g, "_&#8203;")}</th>`;
      })
      .join("\n");
    let renderedBody = "";
    for (const row of table) {
      let renderedRow = "";
      for (const field of table.field.intrinsicFields) {
        const childRenderer = this.childRenderers[field.name];
        const isNumeric = childRenderer instanceof HTMLNumberRenderer;
        const rendered = await childRenderer.render(row.cell(field));
        renderedRow += `<td style="padding: ${
          childRenderer instanceof HTMLTableRenderer ? "0" : "8px"
        }; vertical-align: top; border-bottom: 1px solid #eaeaea; ${
          isNumeric ? "text-align: right;" : ""
        }">${rendered}</td>\n`;
      }
      // const drillPath = getDrillPath(ref, rowNum);
      // const drillQuery = getDrillQuery(table.root(), drillPath);
      // const debugDrill = `<td><pre>${drillQuery}</pre></td>`;
      const debugDrill = "";
      renderedBody += `<tr>${renderedRow}${debugDrill}</tr>\n`;
    }
    return `<table style="border: 1px solid #eaeaea; vertical-align: top; border-bottom: 1px solid #eaeaea; border-collapse: collapse; width: 100%;">
		<thead>
			<tr>
				${header}
      </tr>
		</thead>
		<tbody>
			${renderedBody}
		</tbody>
	</table>`;
  }
}
