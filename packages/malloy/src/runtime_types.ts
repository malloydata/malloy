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

export class URL {
  private _url: string;

  constructor(stringURL: string) {
    this._url = stringURL;
  }

  public toString(): string {
    return this._url;
  }

  public static fromString(stringURL: string): URL {
    return new URL(stringURL);
  }
}

export type QueryString = string;
export type ModelString = string;
export type ModelURL = URL;
export type QueryURL = URL;

export interface URLReader {
  readURL: (url: URL) => Promise<string>;
}

export interface SchemaReader {
  // TODO should we really be exposing StructDef like this?
  // TODO should this be a Map instead of a Record in the public interface?
  fetchSchemaForTables(tables: string[]): Promise<Record<string, StructDef>>;
}

export interface LookupSchemaReader {
  lookupSchemaReader(connectionName?: string): Promise<SchemaReader>;
}

export interface SQLRunner {
  runSQL(sql: string): Promise<MalloyQueryData>;
}

export interface LookupSqlRunner {
  lookupSQLRunner(connectionName?: string): Promise<SQLRunner>;
}
