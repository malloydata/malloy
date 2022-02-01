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

import { DataColumn } from "@malloydata/malloy";
import { Renderer } from "../renderer";
import { createErrorElement } from "./utils";

export class HTMLJSONRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(table: DataColumn): Promise<Element> {
    if (!table.isArray() && !table.isRecord()) {
      createErrorElement(this.document, "Invalid data for chart renderer.");
    }

    const element = this.document.createElement("pre");
    element.appendChild(
      this.document.createTextNode(JSON.stringify(table.value, undefined, 2))
    );
    return element;
  }
}
