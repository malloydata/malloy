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

import { Explore, ExploreField, Field } from "@malloy-lang/malloy";
import { DataStyles, StyleDefaults } from "../data_styles";
import { ChildRenderers, RenderTree } from "../renderer";
import { makeRenderer } from "./html_view";

export abstract class ContainerRenderer extends RenderTree {
  childRenderers: ChildRenderers = {};
  protected abstract childrenStyleDefaults: StyleDefaults;

  makeChildRenderers(explore: Explore, dataStyles: DataStyles): void {
    const result: ChildRenderers = {};
    explore.getFields().forEach((field: Field) => {
      result[field.getName()] = makeRenderer(
        field,
        dataStyles,
        this.childrenStyleDefaults
      );
    });
    this.childRenderers = result;
  }

  // We can't use a normal constructor here because we need
  //  we need to be fully constructed before we construct
  //  our children.
  static make<Type extends ContainerRenderer>(
    c: new () => Type,
    exploreField: Explore,
    dataStyles: DataStyles
  ): Type {
    const n = new c();
    n.makeChildRenderers(exploreField, dataStyles);
    return n;
  }
}
