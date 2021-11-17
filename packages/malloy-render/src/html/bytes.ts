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

import { DataValue } from "../data_table";
import { HTMLTextRenderer } from "./text";

export class HTMLBytesRenderer extends HTMLTextRenderer {
  getText(data: DataValue): string | null {
    if (data === null) {
      return null;
    }

    // TODO when the `malloy-server` sends this down, it was converted from a Buffer to a
    //      { type: "Buffer", data: number[] }, but here it's just a Buffer. A mapper should
    //      map the data returned from BigQuery to be fully JSON-serializable, instead of including
    //      the buffer as-is.
    const typedData = data as unknown as number[];
    return Buffer.from(new Uint8Array(typedData)).toString("base64");
  }
}
