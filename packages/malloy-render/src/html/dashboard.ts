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

import { FieldDef } from "malloy";
import { StyleDefaults } from "../data_styles";
import { DataPointer, DataValue, isDataTree } from "../data_table";
import { ContainerRenderer } from "./container";
import { HtmlTextRenderer } from "./text";

export function isMeasureLike(field: FieldDef): boolean {
  if ("resultMetadata" in field) {
    return (
      field.resultMetadata?.fieldKind === "measure" ||
      field.resultMetadata?.fieldKind === "struct"
    );
  }
  return false;
}

export function isDimensional(field: FieldDef): boolean {
  if ("resultMetadata" in field) {
    return field.resultMetadata?.fieldKind === "dimension";
  }
  return false;
}

export class HtmlDashboardRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: "medium",
  };

  async render(
    dom: Document,
    table: DataValue,
    _ref: DataPointer,
    onDrill: (drillQuery: string) => void
  ): Promise<Element> {
    if (!isDataTree(table)) {
      const element = dom.createElement("div");
      element.innerText = "Invalid data for chart renderer.";
      return element;
    }
    const metadata = table.structDef;

    const dimensions = metadata.fields.filter(isDimensional);
    const measures = metadata.fields.filter(isMeasureLike);

    const body = dom.createElement("div");
    for (let rowNum = 0; rowNum < table.rows.length; rowNum++) {
      const dimensionsContainer = dom.createElement("div");
      dimensionsContainer.classList.add("dimensions");
      dimensionsContainer.style.display = "flex";
      dimensionsContainer.style.flexWrap = "wrap";
      const rowElement = dom.createElement("div");
      for (const field of dimensions) {
        const renderer = this.childRenderers[field.name];
        const rendered = await renderer.render(
          dom,
          table.getValue(rowNum, field.name),
          new DataPointer(table, rowNum, field.name),
          onDrill
        );
        const renderedDimension = dom.createElement("div");
        renderedDimension.style.cssText = DIMENSION_BOX;
        const dimensionTitle = dom.createElement("div");
        dimensionTitle.style.cssText = DIMENSION_TITLE;
        dimensionTitle.innerText = field.name;
        const dimensionInner = dom.createElement("div");
        dimensionInner.style.cssText = VERTICAL_CENTER;
        dimensionInner.appendChild(rendered);
        renderedDimension.appendChild(dimensionTitle);
        renderedDimension.appendChild(dimensionInner);
        dimensionsContainer.appendChild(renderedDimension);
      }
      if (dimensions.length > 0) {
        const rowSeparatorOuter = dom.createElement("div");
        rowSeparatorOuter.classList.add("row-separator-outer");
        rowSeparatorOuter.style.cssText = ROW_SEPARATOR_OUTER;
        const rowSeparator = dom.createElement("div");
        rowSeparator.style.cssText = ROW_SEPARATOR;
        rowSeparatorOuter.appendChild(rowSeparator);
        dimensionsContainer.appendChild(rowSeparatorOuter);
      }
      const measuresContainer = dom.createElement("div");
      measuresContainer.style.cssText = MEASURE_BOXES;

      for (const field of measures) {
        const childRenderer = this.childRenderers[field.name];
        const rendered = await childRenderer.render(
          dom,
          table.getValue(rowNum, field.name),
          new DataPointer(table, rowNum, field.name),
          onDrill
        );
        if (childRenderer instanceof HtmlDashboardRenderer) {
          measuresContainer.appendChild(rendered);
        } else if (childRenderer instanceof HtmlTextRenderer) {
          const measureBox = dom.createElement("div");
          measureBox.style.cssText = MEASURE_BOX;
          const measureTitle = dom.createElement("div");
          measureTitle.style.cssText = TITLE;
          measureTitle.innerText = field.name;
          const measureInner = dom.createElement("div");
          measureInner.style.cssText = VERTICAL_CENTER;
          const innerInner = dom.createElement("div");
          innerInner.style.cssText = SINGLE_VALUE;
          innerInner.appendChild(rendered);
          measureInner.appendChild(innerInner);
          measureBox.appendChild(measureTitle);
          measureBox.appendChild(measureInner);
          measuresContainer.appendChild(measureBox);
        } else {
          const measureBox = dom.createElement("div");
          measureBox.style.cssText = MEASURE_BOX;
          const measureTitle = dom.createElement("div");
          measureTitle.style.cssText = TITLE;
          measureTitle.innerText = field.name;
          const measureInner = dom.createElement("div");
          measureInner.style.cssText = VERTICAL_CENTER;
          const innerInner = dom.createElement("div");
          innerInner.style.cssText = HORIZONTAL_CENTER;
          innerInner.appendChild(rendered);
          measureInner.appendChild(innerInner);
          measureBox.appendChild(measureTitle);
          measureBox.appendChild(measureInner);
          measuresContainer.appendChild(measureBox);
        }
      }
      rowElement.appendChild(dimensionsContainer);
      const dashboardOuter = dom.createElement("div");
      dashboardOuter.classList.add("dashboard-outer");
      dashboardOuter.style.cssText = DASHBOARD_OUTER;
      if (dimensions.length > 0) {
        const nestIndicator = dom.createElement("div");
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
