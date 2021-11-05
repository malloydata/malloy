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

import { isDimensional, isMeasureLike } from "@malloy-lang/malloy";
import { StyleDefaults } from "../data_styles";
import { DataPointer, DataValue, isDataTree } from "../data_table";
import { ContainerRenderer } from "./container";
import { HtmlTextRenderer } from "./text";

export class HtmlDashboardRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "medium",
  };

  async render(table: DataValue, _ref: DataPointer): Promise<string> {
    if (!isDataTree(table)) {
      return "Invalid data for chart renderer.";
    }
    const metadata = table.structDef;

    const dimensions = metadata.fields.filter(isDimensional);
    const measures = metadata.fields.filter(isMeasureLike);

    let renderedBody = "";
    for (let rowNum = 0; rowNum < table.rows.length; rowNum++) {
      let renderedDimensions = "";
      for (const field of dimensions) {
        const renderer = this.childRenderers[field.name];
        const rendered = await renderer.render(
          table.getValue(rowNum, field.name),
          new DataPointer(table, rowNum, field.name)
        );
        renderedDimensions += `<div style="${DIMENSION_BOX}"><div style="${DIMENSION_TITLE}">${field.name}</div><div style="${VERTICAL_CENTER}">${rendered}</div></div>\n`;
      }
      let renderedMeasures = "";
      for (const field of measures) {
        const childRenderer = this.childRenderers[field.name];
        const rendered = await childRenderer.render(
          table.getValue(rowNum, field.name),
          new DataPointer(table, rowNum, field.name)
        );
        if (childRenderer instanceof HtmlDashboardRenderer) {
          renderedMeasures += rendered;
        } else if (childRenderer instanceof HtmlTextRenderer) {
          renderedMeasures += `
            <div style="${MEASURE_BOX}">
              <div style="${TITLE}">${field.name}</div>
              <div style="${VERTICAL_CENTER}">
                <div style="${SINGLE_VALUE}">
                  ${rendered}
                </div>
              </div>
            </div>`;
        } else {
          renderedMeasures += `
            <div style="${MEASURE_BOX}">
              <div style="${TITLE}">${field.name}</div>
              <div style="${VERTICAL_CENTER}">
                <div style="${HORIZONTAL_CENTER}">
                  ${rendered}
                </div>
              </div>
            </div>`;
        }
      }
      renderedBody += `
          <div>
            <div class="dimensions" style="display: flex; flex-wrap: wrap;">
              ${renderedDimensions}
              ${
                dimensions.length > 0
                  ? `<div class="row-separator-outer" style="${ROW_SEPARATOR_OUTER}"><div style="${ROW_SEPARATOR}"></div></div>`
                  : ""
              }
            </div>
            <div class="dashboard-outer" style="${DASHBOARD_OUTER}">
              ${
                dimensions.length > 0
                  ? `<div class="nest-indicator" style="${NEST_INDICATOR}"></div>`
                  : ""
              }
              <div style="${MEASURE_BOXES}">
                ${renderedMeasures}
              </div>
            </div>
          </div>
      `;
    }
    return `<div>${renderedBody}</div>`;
  }
}

const ROW_SEPARATOR_OUTER = `
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  flex: 1 0 auto;
`;

const DASHBOARD_OUTER = `
  display: flex;
  flex-direction: row;
  font-size: 11px;
`;

const NESTING_DIV = `
  background-color: #f7f7f7;
  border: 1px solid #e9e9e9;
`;

const NEST_INDICATOR = `
  ${NESTING_DIV}
  min-height: 100%;
  min-width: 11px;
  margin: 6px;
  border-radius: 4px;
`;

const ROW_SEPARATOR = `
  ${NESTING_DIV}
  min-height: 11px;
  max-height: 11px;
  margin: 6px;
  flex: 1 0 auto;
  border-radius: 4px;
`;

const MEASURE_BOXES = `
  display: flex;
  flex-wrap: wrap;
`;

const DIMENSION_BOX = `
  background-color: #f7f7f7;
  border: 1px solid #e9e9e9;
  margin: 6px;
  border-radius: 5px;
  padding: 10px;
  box-shadow: 0 1px 5px 0 #f3f3f3;
`;

const MEASURE_BOX = `
  margin: 6px;
  border-radius: 5px;
  border: 1px solid #f0f0f0;
  padding: 10px;
  flex: 1 0 auto;
  box-shadow: 0 1px 5px 0 #f3f3f3;
  max-width: calc(100% - 11px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DIMENSION_TITLE = `
  font-size: 12px;
  font-weight: 500;
  color: #505050;
  margin-bottom: 5px;
  font-family: Roboto;
`;

const TITLE = `
  font-size: 11px;
  font-family: Roboto;
  font-weight: 500;
  color: #505050;
`;

const SINGLE_VALUE = `
  font-size: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 5px;
`;

const VERTICAL_CENTER = `
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1 0 auto;
`;

const HORIZONTAL_CENTER = `
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;
