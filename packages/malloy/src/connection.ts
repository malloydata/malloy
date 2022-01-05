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
  SchemaReader,
  LookupSchemaReader,
  SQLRunner,
  LookupSQLRunner,
} from "./runtime_types";
import {
  MalloyQueryData,
  NamedStructDefs,
  QueryData,
} from "./model/malloy_types";

export abstract class Connection
  implements LookupSchemaReader, SchemaReader, LookupSQLRunner, SQLRunner
{
  _name: string;

  get name(): string {
    return this._name;
  }

  constructor(name: string) {
    this._name = name;
  }

  // returns instance of Dialect class that works for this connection
  abstract get dialectName(): string;

  abstract executeSQLRaw(sqlCommand: string): Promise<QueryData>;

  abstract runSQL(sqlCommand: string): Promise<MalloyQueryData>;

  public abstract fetchSchemaForTables(
    missing: string[]
  ): Promise<NamedStructDefs>;

  /*
   * Implement `LookupSQLRunner` and `LookupSchemaReader` so these can be
   * passed directly into `Compiler` and `Runner`
   */

  private getConnection(connectionName?: string): Promise<Connection> {
    if (connectionName !== undefined && connectionName !== this.name) {
      throw new Error(`Unknown Connection: ${connectionName}`);
    }
    return Promise.resolve(this);
  }

  public lookupSQLRunner(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }

  public lookupSchemaReader(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }
}
