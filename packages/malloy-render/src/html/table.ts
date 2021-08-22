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

import { DataPointer, DataValue, isDataTree } from "../data_table";
// import { getDrillPath, getDrillQuery } from "../drill";
import { RenderTree } from "../renderer";
import { HtmlNumberRenderer } from "./number";

export class HtmlTableRenderer extends RenderTree {
  async render(table: DataValue, _ref: DataPointer): Promise<string> {
    if (!isDataTree(table)) {
      throw new Error("Invalid type for Table Renderer");
    }
    const header = table
      .getFieldNames()
      .map((name) => {
        const childRenderer = this.childRenderers[name];
        const isNumeric = childRenderer instanceof HtmlNumberRenderer;
        return `<th style="padding: 8px; color: #505050; border-bottom: 1px solid #eaeaea; text-align: ${
          isNumeric ? "right" : "left"
        };">${name}</th>`;
      })
      .join("\n");
    let renderedBody = "";
    for (let rowNum = 0; rowNum < table.rows.length; rowNum++) {
      let renderedRow = "";
      for (const fieldName of table.getFieldNames()) {
        const childRenderer = this.childRenderers[fieldName];
        const isNumeric = childRenderer instanceof HtmlNumberRenderer;
        const rendered = await childRenderer.render(
          table.getValue(rowNum, fieldName),
          new DataPointer(table, rowNum, fieldName)
        );
        renderedRow += `<td style="padding: ${
          childRenderer instanceof HtmlTableRenderer ? "0" : "8px"
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
