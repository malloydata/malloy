/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { RunSQLOptions } from "./run_sql_options";
import {
  MalloyQueryData,
  QueryDataRow,
  SQLBlock,
  StructDef
} from "./model/malloy_types";

/**
 * The contents of a Malloy query document.
 */
export type QueryString = string;

/**
 * The contents of a Malloy model document.
 */
export type ModelString = string;

/**
 * A URL whose contents is a Malloy model.
 */
export type ModelURL = URL;

/**
 * A URL whose contents is a Malloy query.
 */
export type QueryURL = URL;

/**
 * An object capable of reading the contents of a URL in some context.
 */
export interface URLReader {
  /**
   * Read the contents of the given URL.
   *
   * @param url The URL to read.
   * @return A promise to the contents of the URL.
   */
  readURL: (url: URL) => Promise<string>;
}

/**
 * An object capable of reading schemas for given table names.
 */
export interface InfoConnection {
  // TODO should we really be exposing StructDef like this?
  // TODO should this be a Map instead of a Record in the public interface?
  /**
   * Fetch schemas for multiple tables.
   *
   * @param tables The names of tables to fetch schemas for.
   * @return A mapping of table names to schemas.
   */
  fetchSchemaForTables(tables: string[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }>;

  /**
   * Fetch schemas an SQL blocks
   *
   * @param block The SQL blocks to fetch schemas for.
   * @return A mapping of SQL block names to schemas.
   */

  fetchSchemaForSQLBlock(
    block: SQLBlock
  ): Promise<
    | { structDef: StructDef; error?: undefined }
    | { error: string; structDef?: undefined }
  >;

  /**
   * The name of the connection.
   */
  get name(): string;
}

/**
 * An object capable of running SQL.
 */
export interface Connection extends InfoConnection {
  /**
   * Run some SQL and yield results.
   *
   * @param sql The SQL to run.
   * @param options.pageSize Maximum number of results to return at once.
   * @return The rows of data resulting from running the given SQL query
   * and the total number of rows available.
   */
  runSQL(sql: string, options?: RunSQLOptions): Promise<MalloyQueryData>;

  // TODO feature-sql-block Comment
  isPool(): this is PooledConnection;

  canPersist(): this is PersistSQLResults;

  canStream(): this is StreamingConnection;

  close(): Promise<void>;
}

// TODO feature-sql-block Comment
export interface TestableConnection extends Connection {
  // TODO feature-sql-block Comment
  test(): Promise<void>;
}

export interface PooledConnection extends Connection {
  // Most pool implementations require a specific call to release connection handles. If a Connection is a
  // PooledConnection, drain() should be called when connection usage is over
  drain(): Promise<void>;
  isPool(): true;
}

export interface PersistSQLResults extends Connection {
  manifestTemporaryTable(sqlCommand: string): Promise<string>;
}

export interface StreamingConnection extends Connection {
  runSQLStream(
    sqlCommand: string,
    options?: { rowLimit?: number }
  ): AsyncIterableIterator<QueryDataRow>;
}

/**
 * A mapping of connection names to connections.
 */
export interface LookupConnection<T extends InfoConnection> {
  /**
   * @param connectionName The name of the connection for which a `Connection` is required.
   * @return A promise to a `Connection` for the connection named `connectionName`.
   */
  lookupConnection(connectionName?: string): Promise<T>;
}
