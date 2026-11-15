/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {DuckDBCommon} from './duckdb_common';

/**
 * A host that is itself a DuckDB database, such as a DuckDB extension
 * running Malloy in an embedded JavaScript engine. `query` runs SQL in that
 * database and returns its rows; it may answer synchronously.
 */
export interface DuckDBHost {
  query(sql: string): QueryRecord[] | Promise<QueryRecord[]>;
}

/**
 * A DuckDB connection whose database belongs to the host. Schemas, the type
 * mapping and the schema cache are DuckDBCommon's, as for the Node and WASM
 * connections; the host only runs SQL.
 */
export class HostDuckDBConnection extends DuckDBCommon {
  public readonly name: string;

  constructor(
    name: string,
    private readonly host: DuckDBHost
  ) {
    super();
    this.name = name;
  }

  getDigest(): string {
    return `host:${this.name}`;
  }

  protected async setup(): Promise<void> {}

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}> {
    const rows = await this.host.query(sql);
    return {rows, totalRows: rows.length};
  }

  async *runSQLStream(sql: string): AsyncIterableIterator<QueryRecord> {
    yield* await this.host.query(sql);
  }

  async close(): Promise<void> {}
}
