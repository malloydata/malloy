/*
 * Copyright 2022 Google LLC
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
import { HTMLTextRenderer } from "./text";

export class HTMLBytesRenderer extends HTMLTextRenderer {
  getText(data: DataColumn): string | null {
    if (data.isNull()) {
      return null;
    }

    return data.bytes.value.toString("base64");
  }
}
