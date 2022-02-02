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

import { Explore, Field } from "@malloydata/malloy";
import { DataStyles, StyleDefaults } from "../data_styles";
import { ChildRenderers, RenderTree } from "../renderer";
import { makeRenderer } from "./html_view";

export abstract class ContainerRenderer extends RenderTree {
  childRenderers: ChildRenderers = {};
  protected abstract childrenStyleDefaults: StyleDefaults;

  makeChildRenderers(
    explore: Explore,
    document: Document,
    options: {
      dataStyles: DataStyles;
      isDrillingEnabled?: boolean;
      onDrill?: (drillQuery: string) => void;
    }
  ): void {
    const result: ChildRenderers = {};
    explore.intrinsicFields.forEach((field: Field) => {
      result[field.name] = makeRenderer(
        field,
        document,
        options,
        this.childrenStyleDefaults
      );
    });
    this.childRenderers = result;
  }

  // We can't use a normal constructor here because we need
  //  we need to be fully constructed before we construct
  //  our children.
  static make<Type extends ContainerRenderer>(
    c: new (
      document: Document,
      options: {
        isDrillingEnabled?: boolean;
        onDrill?: (drillQuery: string) => void;
      }
    ) => Type,
    document: Document,
    exploreField: Explore,
    options: {
      dataStyles: DataStyles;
      isDrillingEnabled?: boolean;
      onDrill?: (drillQuery: string) => void;
    }
  ): Type {
    const n = new c(document, {
      isDrillingEnabled: options.isDrillingEnabled,
      onDrill: options.onDrill,
    });
    n.makeChildRenderers(exploreField, document, options);
    return n;
  }
}
