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
import { createNullElement } from "./utils";

export class HTMLTextRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  getText(data: DataColumn): string | null {
    return `${data.value}`;
  }

  async render(data: DataColumn): Promise<HTMLElement> {
    const text = this.getText(data);
    if (text === null) {
      return createNullElement(this.document);
    }

    const element = this.document.createElement("span");
    element.appendChild(this.document.createTextNode(text));
    return element;
  }
}
