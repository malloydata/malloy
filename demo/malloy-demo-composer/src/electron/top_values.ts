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

import { Runtime, SearchValueMapResult, StructDef } from "@malloydata/malloy";
import { CONNECTION_MANAGER } from "./connections";
import { URL_READER } from "./urls";

export async function topValues(
  source: StructDef,
  analysisPath: string
): Promise<SearchValueMapResult[] | undefined> {
  const sourceName = source.as || source.name;
  const connections = CONNECTION_MANAGER.getConnectionLookup(
    new URL("file://" + analysisPath)
  );
  const runtime = new Runtime(URL_READER, connections);
  return runtime
    ._loadModelFromModelDef({
      name: "_generated",
      contents: { [sourceName]: source },
      exports: [],
    })
    .searchValueMap(sourceName);
}
