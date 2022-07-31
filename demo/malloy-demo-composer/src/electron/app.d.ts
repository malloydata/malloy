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

import { ResultJSON } from "@malloydata/malloy";
import { Analysis, SearchIndexResult, SearchValueMapResult } from "../types";

export interface MalloyElectronAPI {
  analyses: (thePath?: string) => Promise<explore.Directory | Error>;
  analysis: (path: string) => Promise<explore.Directory | Error>;
  models: () => Promise<explore.Model[] | Error>;
  schema: (analysis: Analysis) => Promise<
    | {
        schema: Schema;
        modelDef: ModelDef;
        malloy: string;
      }
    | Error
  >;
  runQuery: (
    query: string,
    queryName: string,
    analysis: Analysis
  ) => Promise<ResultJSON | Error>;
  saveField: (
    type: "query" | "dimension" | "measure",
    field: FieldDef,
    name: string,
    analysis: Analysis
  ) => Promise<Analysis | Error>;
  search: (
    source: StructDef,
    analysisPath: string,
    searchTerm: string,
    fieldPath?: string
  ) => Promise<SearchIndexResult[] | undefined | Error>;
  topValues: (
    source: StructDef,
    analysisPath: string
  ) => Promise<SearchValueMapResult[] | undefined | Error>;
  openDirectory: () => Promise<string | undefined | Error>;
}

declare global {
  interface Window {
    malloy: MalloyElectronAPI;
  }
}
