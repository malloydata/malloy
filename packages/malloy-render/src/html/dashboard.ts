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

import { DataArrayOrRecord } from "@malloydata/malloy";
import { StyleDefaults } from "../data_styles";
import { getDrillQuery } from "../drill";
import { ContainerRenderer } from "./container";
import { HTMLTextRenderer } from "./text";
import { createDrillIcon, createErrorElement, yieldTask } from "./utils";

export class HTMLDashboardRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "medium",
  };

  async render(table: DataArrayOrRecord): Promise<HTMLElement> {
    if (!table.isArrayOrRecord()) {
      return createErrorElement(
        this.document,
        "Invalid data for dashboard renderer."
      );
    }

    const fields = table.field.intrinsicFields;
    const dimensions = fields.filter(
      (field) => field.isAtomicField() && field.sourceWasDimension()
    );
    const measures = fields.filter(
      (field) => !field.isAtomicField() || field.sourceWasMeasureLike()
    );

    const body = this.document.createElement("div");
    for (const row of table) {
      const dimensionsContainer = this.document.createElement("div");
      dimensionsContainer.classList.add("dimensions");
      dimensionsContainer.style.display = "flex";
      dimensionsContainer.style.flexWrap = "wrap";
      const rowElement = this.document.createElement("div");
      rowElement.style.position = "relative";
      for (const field of dimensions) {
        const renderer = this.childRenderers[field.name];
        const rendered = await renderer.render(row.cell(field));
        const renderedDimension = this.document.createElement("div");
        renderedDimension.style.cssText = DIMENSION_BOX;
        const dimensionTitle = this.document.createElement("div");
        dimensionTitle.style.cssText = DIMENSION_TITLE;
        dimensionTitle.appendChild(this.document.createTextNode(field.name));
        const dimensionInner = this.document.createElement("div");
        dimensionInner.style.cssText = VERTICAL_CENTER;
        dimensionInner.appendChild(rendered);
        renderedDimension.appendChild(dimensionTitle);
        renderedDimension.appendChild(dimensionInner);
        dimensionsContainer.appendChild(renderedDimension);
      }
      if (dimensions.length > 0) {
        const rowSeparatorOuter = this.document.createElement("div");
        rowSeparatorOuter.classList.add("row-separator-outer");
        rowSeparatorOuter.style.cssText = ROW_SEPARATOR_OUTER;
        const rowSeparator = this.document.createElement("div");
        rowSeparator.style.cssText = ROW_SEPARATOR;
        rowSeparatorOuter.appendChild(rowSeparator);
        dimensionsContainer.appendChild(rowSeparatorOuter);
      }
      const measuresContainer = this.document.createElement("div");
      measuresContainer.style.cssText = MEASURE_BOXES;
      for (const field of measures) {
        const childRenderer = this.childRenderers[field.name];
        await yieldTask();
        const rendered = await childRenderer.render(row.cell(field));
        if (childRenderer instanceof HTMLDashboardRenderer) {
          measuresContainer.appendChild(rendered);
        } else if (childRenderer instanceof HTMLTextRenderer) {
          const measureBox = this.document.createElement("div");
          measureBox.style.cssText = MEASURE_BOX;
          const measureTitle = this.document.createElement("div");
          measureTitle.style.cssText = TITLE;
          measureTitle.appendChild(this.document.createTextNode(field.name));
          const measureInner = this.document.createElement("div");
          measureInner.style.cssText = VERTICAL_CENTER;
          const innerInner = this.document.createElement("div");
          innerInner.style.cssText = SINGLE_VALUE;
          innerInner.appendChild(rendered);
          measureInner.appendChild(innerInner);
          measureBox.appendChild(measureTitle);
          measureBox.appendChild(measureInner);
          measuresContainer.appendChild(measureBox);
        } else {
          const measureBox = this.document.createElement("div");
          measureBox.style.cssText = MEASURE_BOX;
          const measureTitle = this.document.createElement("div");
          measureTitle.style.cssText = TITLE;
          measureTitle.appendChild(this.document.createTextNode(field.name));
          const measureInner = this.document.createElement("div");
          measureInner.style.cssText = VERTICAL_CENTER;
          const innerInner = this.document.createElement("div");
          innerInner.style.cssText = HORIZONTAL_CENTER;
          innerInner.appendChild(rendered);
          measureInner.appendChild(innerInner);
          measureBox.appendChild(measureTitle);
          measureBox.appendChild(measureInner);
          measuresContainer.appendChild(measureBox);
        }
      }
      rowElement.appendChild(dimensionsContainer);
      if (dimensions.length > 0 && this.options.isDrillingEnabled) {
        const drillElement = this.document.createElement("span");
        const drillIcon = createDrillIcon(this.document);
        drillElement.appendChild(drillIcon);
        drillElement.style.cssText = `padding: 8px; vertical-align: top; width: 25px; cursor: pointer; position: absolute; top: 5px; right: 5px;`;
        drillElement.onclick = () => {
          if (this.options.onDrill) {
            const { drillQuery, drillFilters } = getDrillQuery(row);
            this.options.onDrill(drillQuery, drillIcon, drillFilters);
          }
        };
        rowElement.appendChild(drillElement);
      }
      const dashboardOuter = this.document.createElement("div");
      dashboardOuter.classList.add("dashboard-outer");
      dashboardOuter.style.cssText = DASHBOARD_OUTER;
      if (dimensions.length > 0) {
        const nestIndicator = this.document.createElement("div");
        nestIndicator.style.cssText = NEST_INDICATOR;
        dashboardOuter.appendChild(nestIndicator);
      }
      dashboardOuter.appendChild(measuresContainer);
      rowElement.appendChild(dashboardOuter);
      body.appendChild(rowElement);
    }
    return body;
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
  background-color: var(--malloy-tile-background-color, #f7f7f7);
  border: 1px solid var(--malloy-border-color, #e9e9e9);
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
  background-color: var(--malloy-tile-background-color, #f7f7f7);
  border: 1px solid var(--malloy-border-color, #e9e9e9);
  margin: 6px;
  border-radius: 5px;
  padding: 10px;
  box-shadow: 0 1px 5px 0 var(--malloy-border-color, #f3f3f3);
`;

const MEASURE_BOX = `
  margin: 6px;
  border-radius: 5px;
  border: 1px solid var(--malloy-border-color, #e9e9e9);
  padding: 10px;
  flex: 1 0 auto;
  box-shadow: 0 1px 5px 0 var(--malloy-tile-background-color, #f3f3f3);
  max-width: calc(100% - 11px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DIMENSION_TITLE = `
  font-size: 12px;
  font-weight: 500;
  color: var(--malloy-title-color, #505050);
  margin-bottom: 5px;
  font-family: var(--malloy-font-family, "Roboto");
`;

const TITLE = `
  font-size: 11px;
  font-family: var(--malloy-font-family, "Roboto");
  font-weight: 500;
  color: #var(--malloy-title-color, #505050);
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
