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

import { SearchIndexResult, StructDef } from "@malloydata/malloy";
import { RUNTIME } from "./runtime";

export async function searchIndex(
  source: StructDef,
  searchTerm: string,
  fieldPath?: string
): Promise<SearchIndexResult[] | undefined> {
  const sourceName = source.as || source.name;
  return RUNTIME._loadModelFromModelDef({
    name: "_generated",
    contents: { [sourceName]: source },
    exports: [],
  }).search(sourceName, searchTerm, undefined, fieldPath);
}
