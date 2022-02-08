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
import { SQLReferenceData } from "./lang/parse-malloy";

export interface PooledConnection {
  // Most pool implementations require a specific call to release connection handles. If a Connection is a
  // PooledConnection, drain() should be called when connection usage is over
  drain(): Promise<void>;
  isPool(): true;
}

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

  // if this connection is mananged by a connection pool and requires draining when
  // usage is complete, return true here
  abstract isPool(): this is PooledConnection;

  abstract executeSQLRaw(sqlCommand: string): Promise<QueryData>;

  abstract runSQL(
    sqlCommand: string,
    options?: { rowLimit?: number }
  ): Promise<MalloyQueryData>;

  abstract test(): Promise<void>;

  public abstract fetchSchemaForTables(
    missing: string[]
  ): Promise<NamedStructDefs>;

  public abstract fetchSchemaForSQLBlocks(
    sqlRefs: SQLReferenceData[]
  ): Promise<NamedStructDefs>;

  /*
   * Implement `LookupSQLRunner` and `LookupSchemaReader` so that a Connection can be
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
