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
  async render(data: DataValue, ref: DataPointer): Promise<string> {
    const metadata = ref.getFieldDef();
    if (metadata.type !== "date" && metadata.type !== "timestamp") {
      return "Invalid field for date renderer";
    }

    if (data === null) {
      return "∅";
    }

    if (!(data instanceof Object && "value" in data)) {
      return "Invalid data for date/timestamp field.";
    }

    const typedData = data as { value: string };

    const timeframe =
      metadata.timeframe || (metadata.type === "timestamp" ? "second" : "date");

    return timeToString(new Date(typedData.value), timeframe);
  }
}
