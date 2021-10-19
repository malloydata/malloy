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

import { DataPointer, DataTree, isDataTree } from "../data_table";
import { Renderer } from "../renderer";

export class HtmlJSONRenderer implements Renderer {
  async render(
    dom: Document,
    table: DataTree,
    _ref: DataPointer
  ): Promise<Element> {
    if (!isDataTree(table)) {
      const element = dom.createElement("span");
      element.innerText = "Invalid data for chart renderer.";
      return element;
    }
    const element = dom.createElement("pre");
    element.innerText = JSON.stringify(table.rows, undefined, 2);
    return element;
  }
}
