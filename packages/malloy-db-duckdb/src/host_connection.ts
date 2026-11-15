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
   * Runs SQL in the host's database and returns its rows, now or as a
   * promise. Compiling sends `DESCRIBE SELECT * FROM <table>` and
   * `DESCRIBE SELECT * FROM (<sql>)`, and reads each row's `column_name`
   * and `column_type`. Running a query sends the query; `test()` sends
   * `SELECT 1`; persisting a result sends `CREATE TEMPORARY TABLE`. Throw
   * to report a failure; the message reaches the user.
   */
  query(sql: string): QueryRecord[] | Promise<QueryRecord[]>;
  /**
   * Identifies the host's database, for persist manifests: two connections
   * with the same digest are taken to read the same tables.
   */
  digest: string;
}

/**
 * A DuckDB connection whose database belongs to the host. Schemas, the type
 * mapping and the schema cache are DuckDBCommon's, as for the Node and WASM
 * connections; the host only runs SQL. A streamed query is read whole from
 * the host and then yielded.
 */
export class HostDuckDBConnection extends DuckDBCommon {
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
    return makeDigest('duckdb-host', this.host.digest);
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
