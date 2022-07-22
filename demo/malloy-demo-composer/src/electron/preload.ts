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

import { FieldDef, StructDef } from "@malloydata/malloy";
import { contextBridge, ipcRenderer } from "electron";
import { Analysis } from "../types";

contextBridge.exposeInMainWorld("malloy", {
  analyses: (path: string | undefined) =>
    ipcRenderer.invoke("get:analyses", path),
  analysis: (path: string) => ipcRenderer.invoke("get:analysis", path),
  models: () => ipcRenderer.invoke("get:models"),
  schema: (analysis: Analysis) => ipcRenderer.invoke("get:schema", analysis),
  runQuery: (query: string, queryName: string, analysis: Analysis) =>
    ipcRenderer.invoke("post:run_query", query, queryName, analysis),
  saveField: (
    type: "query" | "dimension" | "measure",
    field: FieldDef,
    name: string,
    analysis: Analysis
  ) => ipcRenderer.invoke("post:save_field", type, field, name, analysis),
  search: (
    source: StructDef,
    analysisPath: string,
    searchTerm: string,
    fieldPath?: string
  ) =>
    ipcRenderer.invoke(
      "post:search",
      source,
      analysisPath,
      searchTerm,
      fieldPath
    ),
  topValues: (source: StructDef, analysisPath: string) =>
    ipcRenderer.invoke("post:top_values", source, analysisPath),
  openDirectory: () => ipcRenderer.invoke("post:open_directory"),
});
