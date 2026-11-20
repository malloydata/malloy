/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  QueryOptionsReader,
  QueryRecord,
  RunSQLOptions,
} from '@malloydata/malloy';
import {makeDigest} from '@malloydata/malloy';
import {DuckDBCommon} from './duckdb_common';

/**
 * A host that is itself a DuckDB database, such as a DuckDB extension
 * running Malloy in an embedded JavaScript engine.
 */
export interface DuckDBHost {
  /**
   * Runs one DuckDB statement in the host's database and returns its rows.
   * Throw to report a failure; the message reaches the user.
   *
   * - **Rows** are one object per row keyed by column name, with values as
   *   DuckDB converts them to JSON (the Node connection reads
   *   `getRowObjectsJson()`): BIGINT, HUGEINT and DECIMAL as strings, dates and
   *   timestamps as strings, LISTs as arrays, STRUCTs as objects.
   * - **Statements** can be any DuckDB SQL. A query may begin with a
   *   metadata comment. Reading a table's or a SQL source's schema sends
   *   `DESCRIBE SELECT * FROM <table>` or `DESCRIBE SELECT * FROM (<sql>)`
   *   and reads each row's `column_name` and `column_type`; `test()` sends `SELECT 1`; persisting
   *   a result sends `CREATE TEMPORARY TABLE`.
   * - **Session settings** are the host's. Malloy's generated SQL expects
   *   what the Node connection sets up: `SET TimeZone='UTC'` and the `json`
   *   and `icu` extensions loaded. A host that differs gets different
   *   answers for time and JSON functions.
   */
  query(sql: string): QueryRecord[] | Promise<QueryRecord[]>;
  /**
   * Any stable string identifying the host's database, as a database path
   * does for the Node connection. The connection's digest is made from it,
   * so two connections with the same `databaseId` are taken to read the
   * same tables.
   */
  databaseId: string;
}

/**
 * A DuckDB connection whose database belongs to the host: the host runs the
 * SQL. A streamed query is read whole from the host and then yielded.
 */
export class DuckDBHostConnection extends DuckDBCommon {
  public readonly name: string;

  constructor(
    name: string,
    private readonly host: DuckDBHost,
    queryOptions?: QueryOptionsReader
  ) {
    super(queryOptions);
    this.name = name;
  }

  getDigest(): string {
    return makeDigest('duckdb-host', this.host.databaseId);
  }

  protected async setup(): Promise<void> {}

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}> {
    const rows = await this.host.query(sql);
    return {rows, totalRows: rows.length};
  }

  async *runSQLStream(
    sql: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const {rows} = await this.runSQL(sql, options);
    for (const row of rows) {
      if (options.abortSignal?.aborted) return;
      yield row;
    }
  }

  async close(): Promise<void> {}
}
