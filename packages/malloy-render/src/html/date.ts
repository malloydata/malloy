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

import {
  DataColumn,
  DateTimeframe,
  TimestampTimeframe,
} from "@malloydata/malloy";
import { Renderer } from "../renderer";
import { createErrorElement, createNullElement, timeToString } from "./utils";

export class HTMLDateRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(data: DataColumn): Promise<HTMLElement> {
    if (data.isNull()) {
      return createNullElement(this.document);
    }

    if (!data.isDate() && !data.isTimestamp()) {
      return createErrorElement(
        this.document,
        "Invalid field for date renderer"
      );
    }

    const timeframe =
      data.field.timeframe ||
      (data.isTimestamp() ? TimestampTimeframe.Second : DateTimeframe.Day);

    const timestring = timeToString(data.value, timeframe);

    const element = this.document.createElement("span");
    element.appendChild(this.document.createTextNode(timestring));
    return element;
  }
}
