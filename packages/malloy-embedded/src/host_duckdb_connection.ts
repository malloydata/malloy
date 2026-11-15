/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {DuckDBCommon} from '@malloydata/db-duckdb/common';

/**
 * What a host that *is* DuckDB gives the connection: a way to run SQL in
 * the database the extension is loaded into. Synchronous, because the
 * host's own call is; the connection wraps it in a Promise.
 */
export interface DuckDBHost {
  query(sql: string): QueryRecord[];
}

/**
 * A Malloy DuckDB connection whose database is the host's. Everything
 * Malloy does with a DuckDB connection (DESCRIBE for schemas, the type
 * mapping, the schema cache) is DuckDBCommon's, shared with the Node and
 * WASM connections; only "run this SQL" comes from the host.
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

  /**
   * Drops cached schemas, so the next compile describes every table again
   * in the host's current context. A host whose tables can change between
   * calls caches compiled models itself and checks the schemas they used.
   */
  forgetSchemas(): void {
    this.schemaCache = {};
  }

  getDigest(): string {
    return `host-duckdb:${this.name}`;
  }

  protected async setup(): Promise<void> {}

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}> {
    const rows = this.host.query(sql);
    return {rows, totalRows: rows.length};
  }

  async *runSQLStream(sql: string): AsyncIterableIterator<QueryRecord> {
    for (const row of this.host.query(sql)) {
      yield row;
    }
  }

  async close(): Promise<void> {}
}
