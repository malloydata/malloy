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
} from "@malloy-lang/malloy";
import { Renderer } from "../renderer";
import { timeToString } from "./utils";

export class HTMLDateRenderer implements Renderer {
  async render(data: DataColumn): Promise<string> {
    if (!data.isDate() && !data.isTimestamp()) {
      return "Invalid field for date renderer";
    }

    if (data.isNull()) {
      return "∅";
    }

    const timeframe =
      data.field.timeframe ||
      (data.isTimestamp() ? TimestampTimeframe.Second : DateTimeframe.Date);

    return timeToString(data.value, timeframe);
  }
}
