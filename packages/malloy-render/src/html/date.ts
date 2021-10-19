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
import { timeToString } from "./utils";

export class HtmlDateRenderer implements Renderer {
  async render(
    dom: Document,
    data: DataValue,
    ref: DataPointer
  ): Promise<Element> {
    const metadata = ref.getFieldDef();
    const element = document.createElement("span");
    if (metadata.type !== "date" && metadata.type !== "timestamp") {
      element.innerText = "Invalid field for date renderer";
      return element;
    }

    if (data === null) {
      element.innerText = "∅";
      return element;
    }

    if (!(data instanceof Object && "value" in data)) {
      element.innerText = "Invalid data for date/timestamp field.";
      return element;
    }

    const typedData = data as { value: string };

    const timeframe =
      metadata.timeframe || (metadata.type === "timestamp" ? "second" : "date");

    element.innerText = timeToString(new Date(typedData.value), timeframe);
    return element;
  }
}
