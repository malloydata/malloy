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

import { DataPointer, DataValue } from "../data_table";
import { Renderer } from "../renderer";

export class HtmlLinkRenderer implements Renderer {
  async render(
    dom: Document,
    data: DataValue,
    _ref: DataPointer
  ): Promise<Element> {
    if (data === null) {
      const element = dom.createElement("span");
      element.innerText = `⌀`;
      return element;
    }
    const element = dom.createElement("a");
    const stringData = `${data}`;
    element.href = stringData;
    element.innerText = stringData;
    return element;
  }
}
