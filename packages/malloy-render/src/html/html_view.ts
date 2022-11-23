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

import { AtomicFieldType, DataArray, Field, Explore } from "@malloydata/malloy";
import { TopLevelSpec } from "vega-lite";
import { DataStyles, StyleDefaults } from "../data_styles";
import { Renderer } from "../renderer";
import { HTMLBarChartRenderer } from "./bar_chart";
import { HTMLBooleanRenderer } from "./boolean";
import { HTMLJSONRenderer } from "./json";
import { HTMLBytesRenderer } from "./bytes";
import { HTMLCurrencyRenderer } from "./currency";
import { HTMLPercentRenderer } from "./percent";
import { HTMLDashboardRenderer } from "./dashboard";
import { HTMLImageRenderer } from "./image";
import { HTMLDateRenderer } from "./date";
import { HTMLLineChartRenderer } from "./line_chart";
import { HTMLLinkRenderer } from "./link";
import { HTMLListRenderer } from "./list";
import { HTMLListDetailRenderer } from "./list_detail";
import { HTMLNumberRenderer } from "./number";
import { HTMLPointMapRenderer } from "./point_map";
import { HTMLScatterChartRenderer } from "./scatter_chart";
import { HTMLSegmentMapRenderer } from "./segment_map";
import { HTMLShapeMapRenderer } from "./shape_map";
import { HTMLTableRenderer } from "./table";
import { HTMLTextRenderer } from "./text";
import { HTMLVegaSpecRenderer } from "./vega_spec";
import { ContainerRenderer } from "./container";
import { createErrorElement } from "./utils";
import { DrillFunction } from "../drill";

export class HTMLView {
  private readonly document: Document;

  constructor(document: Document) {
    this.document = document;
  }

  async render(
    table: DataArray,
    options: {
      dataStyles: DataStyles;
      isDrillingEnabled?: boolean;
      onDrill?: DrillFunction;
    }
  ): Promise<HTMLElement> {
    const renderer = makeRenderer(table.field, this.document, options, {
      size: "large",
    });
    try {
      // TODO Implement row streaming capability for some renderers: some renderers should be usable
      //      as a builder with `begin(field: StructDef)`, `row(field: StructDef, row: QueryDataRow)`,
      //      and `end(field: StructDef)` methods.
      //      Primarily, this should be possible for the `table` and `dashboard` renderers.
      //      This would only be used at this top level (and HTML view should support `begin`,
      //      `row`, and `end` as well).
      return await renderer.render(table);
    } catch (error) {
      if (error instanceof Error) {
        return createErrorElement(this.document, error);
      } else {
        return createErrorElement(
          this.document,
          "Internal error - Exception not an Error object."
        );
      }
    }
  }
}

export class JSONView {
  private readonly document: Document;

  constructor(document: Document) {
    this.document = document;
  }

  async render(table: DataArray): Promise<HTMLElement> {
    const renderer = new HTMLJSONRenderer(this.document);
    try {
      return await renderer.render(table);
    } catch (error) {
      if (error instanceof Error) {
        return createErrorElement(this.document, error);
      } else {
        return createErrorElement(
          this.document,
          "Internal error - Exception not an Error object."
        );
      }
    }
  }
}

function getRendererOptions(field: Field | Explore, dataStyles: DataStyles) {
  let renderer = dataStyles[field.name];
  if (!renderer) {
    for (const sourceClass of field.sourceClasses) {
      if (!renderer) {
        renderer = dataStyles[sourceClass];
      }
    }
  }
  return renderer;
}

function isContainer(field: Field | Explore): Explore {
  if (field.isExplore()) {
    return field;
  } else {
    throw new Error(
      `${field.name} does not contain fields and cannot be rendered this way`
    );
  }
}

export function makeRenderer(
  field: Explore | Field,
  document: Document,
  options: {
    dataStyles: DataStyles;
    isDrillingEnabled?: boolean;
    onDrill?: DrillFunction;
  },
  styleDefaults: StyleDefaults
): Renderer {
  const renderDef = getRendererOptions(field, options.dataStyles) || {};

  if (renderDef.renderer === "shape_map" || field.name.endsWith("_shape_map")) {
    return new HTMLShapeMapRenderer(document, styleDefaults, renderDef);
  } else if (
    renderDef.renderer === "point_map" ||
    field.name.endsWith("_point_map")
  ) {
    return new HTMLPointMapRenderer(document, styleDefaults);
  } else if (renderDef.renderer === "image" || field.name.endsWith("_image")) {
    return new HTMLImageRenderer(document);
  } else if (
    renderDef.renderer === "segment_map" ||
    field.name.endsWith("_segment_map")
  ) {
    return new HTMLSegmentMapRenderer(document, styleDefaults, renderDef);
  } else if (
    renderDef.renderer === "dashboard" ||
    field.name.endsWith("_dashboard")
  ) {
    return ContainerRenderer.make(
      HTMLDashboardRenderer,
      document,
      isContainer(field),
      options
    );
  } else if (renderDef.renderer === "json" || field.name.endsWith("_json")) {
    return new HTMLJSONRenderer(document);
  } else if (
    renderDef.renderer === "line_chart" ||
    field.name.endsWith("_line_chart")
  ) {
    return new HTMLLineChartRenderer(document, styleDefaults, renderDef);
  } else if (
    renderDef.renderer === "scatter_chart" ||
    field.name.endsWith("_scatter_chart")
  ) {
    return new HTMLScatterChartRenderer(document, styleDefaults);
  } else if (renderDef.renderer === "bar_chart") {
    return new HTMLBarChartRenderer(document, styleDefaults, renderDef);
  } else if (field.name.endsWith("_bar_chart")) {
    return new HTMLBarChartRenderer(document, styleDefaults, {});
  } else if (renderDef.renderer === "vega") {
    const spec = renderDef.spec;
    if (spec) {
      return new HTMLVegaSpecRenderer(
        document,
        styleDefaults,
        spec as TopLevelSpec
      );
    } else if (renderDef.spec_name) {
      const vegaRenderer = options.dataStyles[renderDef.spec_name];
      if (vegaRenderer !== undefined && vegaRenderer.renderer === "vega") {
        if (vegaRenderer.spec) {
          return new HTMLVegaSpecRenderer(
            document,
            styleDefaults,
            vegaRenderer.spec as TopLevelSpec
          );
        } else {
          throw new Error(`No spec defined on ${renderDef.spec_name}`);
        }
      } else {
        throw new Error(`No Vega renderer named ${renderDef.spec_name}`);
      }
    } else {
      throw new Error(`No top level vega spec defined for ${field.name}`);
    }
  } else {
    if (
      renderDef.renderer === "time" ||
      (field.hasParentExplore() &&
        field.isAtomicField() &&
        (field.type === AtomicFieldType.Date ||
          field.type === AtomicFieldType.Timestamp))
    ) {
      return new HTMLDateRenderer(document);
    } else if (renderDef.renderer === "currency") {
      return new HTMLCurrencyRenderer(document);
    } else if (renderDef.renderer === "percent") {
      return new HTMLPercentRenderer(document);
    } else if (
      renderDef.renderer === "number" ||
      (field.hasParentExplore() &&
        field.isAtomicField() &&
        field.type === AtomicFieldType.Number)
    ) {
      return new HTMLNumberRenderer(document);
    } else if (renderDef.renderer === "bytes") {
      return new HTMLBytesRenderer(document);
    } else if (
      renderDef.renderer === "boolean" ||
      (field.hasParentExplore() &&
        field.isAtomicField() &&
        field.type === AtomicFieldType.Boolean)
    ) {
      return new HTMLBooleanRenderer(document);
    } else if (renderDef.renderer === "link" || field.name.endsWith("_url")) {
      return new HTMLLinkRenderer(document);
    } else if (renderDef.renderer === "list" || field.name.endsWith("_list")) {
      return ContainerRenderer.make(
        HTMLListRenderer,
        document,
        isContainer(field),
        options
      );
    } else if (
      renderDef.renderer === "list_detail" ||
      field.name.endsWith("_list_detail")
    ) {
      return ContainerRenderer.make(
        HTMLListDetailRenderer,
        document,
        isContainer(field),
        options
      );
    } else if (
      renderDef.renderer === "table" ||
      !field.hasParentExplore() ||
      field.isExploreField()
    ) {
      return ContainerRenderer.make(
        HTMLTableRenderer,
        document,
        isContainer(field),
        options
      );
    } else {
      return new HTMLTextRenderer(document);
    }
  }
}
