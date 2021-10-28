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

import { MalloyQueryData, StructDef } from "./model";

// TODO URI fetcher sounds like it is fetching uris
export interface UriFetcher {
  fetchUriContents: (uri: string) => Promise<string>;
}

export interface SchemaReader {
  // TODO should we really be exposing StructDef like this?
  // TODO should this be a Map instead of a Record in the public interface?
  fetchSchemaForTables(tables: string[]): Promise<Record<string, StructDef>>;
}

export interface LookupSchemaReader {
  lookupSchemaReader(connectionName?: string): Promise<SchemaReader>;
}

export interface QueryExecutor {
  runSqlQuery(sql: string): Promise<MalloyQueryData>;
}

export interface LookupQueryExecutor {
  lookupQueryExecutor(connectionName?: string): Promise<QueryExecutor>;
}
