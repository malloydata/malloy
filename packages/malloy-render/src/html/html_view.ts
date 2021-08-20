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

import { FieldDef, StructDef } from "malloy";
import { TopLevelSpec } from "vega-lite";
import { DataStyles } from "../data_styles";
import { ChildRenderers, Renderer } from "../renderer";
import { HtmlBarChartRenderer } from "./bar_chart";
import { HtmlBooleanRenderer } from "./boolean";
import { HtmlJSONRenderer } from "./json";
import { HtmlBytesRenderer } from "./bytes";
import { HtmlCurrencyRenderer } from "./currency";
import { HtmlDashboardRenderer } from "./dashboard";
import { HtmlDateRenderer } from "./date";
import { HtmlLineChartRenderer } from "./line_chart";
import { HtmlLinkRenderer } from "./link";
import { HtmlListRenderer } from "./list";
import { HtmlListDetailRenderer } from "./list_detail";
import { HtmlNumberRenderer } from "./number";
import { HtmlPointMapRenderer } from "./point_map";
import { HtmlScatterChartRenderer } from "./scatter_chart";
import { HtmlSegmentMapRenderer } from "./segment_map";
import { HtmlShapeMapRenderer } from "./shape_map";
import { HtmlTableRenderer } from "./table";
import { HtmlTextRenderer } from "./text";
import { HtmlVegaSpecRenderer } from "./vega_spec";
import { DataTreeRoot } from "../data_table";

export class HtmlView {
  async render(table: DataTreeRoot, dataStyles: DataStyles): Promise<string> {
    const renderer = getRenderer(table.structDef, dataStyles);
    try {
      // TODO Implement row streaming capability for some renderers: some renderers should be usable
      //      as a builder with `begin(field: StructDef)`, `row(field: StructDef, row: QueryDataRow)`,
      //      and `end(field: StructDef)` methods.
      //      Primarily, this should be possible for the `table` and `dashboard` renderers.
      //      This would only be used at this top level (and HTML view should support `begin`,
      //      `row`, and `end` as well).
      return await renderer.render(table, undefined);
    } catch (error) {
      return error.toString();
    }
  }
}

function getRenderers(metadata: StructDef, dataStyles: DataStyles) {
  const result: ChildRenderers = {};
  metadata.fields.forEach((field: FieldDef) => {
    result[field.name] = getRenderer(field, dataStyles);
  });
  return result;
}

function getRendererOptions(field: FieldDef, dataStyles: DataStyles) {
  let renderer = dataStyles[field.name];
  if (!renderer && "resultMetadata" in field && field.resultMetadata) {
    for (const sourceClass of field.resultMetadata.sourceClasses) {
      if (!renderer) {
        renderer = dataStyles[sourceClass];
      }
    }
  }
  return renderer;
}

function getRenderer(field: FieldDef, dataStyles: DataStyles): Renderer {
  const children =
    field.type === "struct" ? getRenderers(field, dataStyles) : {};
  const renderDef = getRendererOptions(field, dataStyles) || {};
  if (renderDef.renderer === "shape_map" || field.name.endsWith("_shape_map")) {
    return new HtmlShapeMapRenderer();
  } else if (
    renderDef.renderer === "point_map" ||
    field.name.endsWith("_point_map")
  ) {
    return new HtmlPointMapRenderer();
  } else if (
    renderDef.renderer === "segment_map" ||
    field.name.endsWith("_segment_map")
  ) {
    return new HtmlSegmentMapRenderer();
  } else if (
    renderDef.renderer === "dashboard" ||
    field.name.endsWith("_dashboard")
  ) {
    return new HtmlDashboardRenderer(children);
  } else if (renderDef.renderer === "json" || field.name.endsWith("_json")) {
    return new HtmlJSONRenderer();
  } else if (
    renderDef.renderer === "line_chart" ||
    field.name.endsWith("_line_chart")
  ) {
    return new HtmlLineChartRenderer();
  } else if (
    renderDef.renderer === "scatter_chart" ||
    field.name.endsWith("_scatter_chart")
  ) {
    return new HtmlScatterChartRenderer();
  } else if (
    renderDef.renderer === "bar_chart" ||
    field.name.endsWith("_bar_chart")
  ) {
    return new HtmlBarChartRenderer();
  } else if (renderDef.renderer === "vega") {
    const spec = renderDef.spec;
    if (spec) {
      return new HtmlVegaSpecRenderer(spec as TopLevelSpec);
    } else if (renderDef.spec_name) {
      const vegaRenderer = dataStyles[renderDef.spec_name];
      if (vegaRenderer !== undefined && vegaRenderer.renderer === "vega") {
        if (vegaRenderer.spec) {
          return new HtmlVegaSpecRenderer(vegaRenderer.spec as TopLevelSpec);
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
      field.type === "date" ||
      field.type === "timestamp"
    ) {
      return new HtmlDateRenderer();
    } else if (renderDef.renderer === "currency") {
      return new HtmlCurrencyRenderer();
    } else if (renderDef.renderer === "number" || field.type === "number") {
      return new HtmlNumberRenderer();
    } else if (renderDef.renderer === "bytes") {
      return new HtmlBytesRenderer();
    } else if (renderDef.renderer === "boolean" || field.type === "boolean") {
      return new HtmlBooleanRenderer();
    } else if (renderDef.renderer === "link") {
      return new HtmlLinkRenderer();
    } else if (renderDef.renderer === "list") {
      return new HtmlListRenderer(children);
    } else if (renderDef.renderer === "list_detail") {
      return new HtmlListDetailRenderer(children);
    } else if (renderDef.renderer === "table" || field.type === "struct") {
      return new HtmlTableRenderer(children);
    } else {
      return new HtmlTextRenderer();
    }
  }
}
