/*
 * Copyright 2025 Google LLC
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

import crypto from 'crypto';
import type {
  ConnectionConfig,
  QueryDataRow,
  QueryOptionsReader,
  RunSQLOptions,
} from '@malloydata/malloy';
import {DuckDBCommon} from './duckdb_common';
import {PythonBridgeClient} from './python_bridge_client';
import type {Table} from 'apache-arrow';

export interface GizmoSQLConnectionOptions extends ConnectionConfig {
  gizmosqlUri: string;
  gizmosqlUsername: string;
  gizmosqlPassword: string;
  gizmosqlCatalog?: string;
  pythonPath?: string;
}

export class GizmoSQLConnection extends DuckDBCommon {
  public readonly name: string;
  private client: PythonBridgeClient | null = null;
  private uri: string;
  private username: string;
  private password: string;
  private catalog: string;
  private pythonPath?: string;
  private isSetup: Promise<void> | undefined;
  private setupError: Error | undefined;

  constructor(
    options: GizmoSQLConnectionOptions,
    queryOptions?: QueryOptionsReader
  ) {
    super(queryOptions);
    this.name = options.name;
    this.uri = options.gizmosqlUri;
    this.username = options.gizmosqlUsername;
    this.password = options.gizmosqlPassword;
    this.catalog = options.gizmosqlCatalog || 'main';
    this.pythonPath = options.pythonPath;
  }

  private async getClient(): Promise<PythonBridgeClient> {
    if (!this.client) {
      this.client = new PythonBridgeClient({
        uri: this.uri,
        username: this.username,
        password: this.password,
        catalog: this.catalog,
        pythonPath: this.pythonPath,
      });

      await this.client.connect();
    }
    return this.client;
  }

  protected async setup(): Promise<void> {
    if (this.setupError) {
      throw this.setupError;
    }

    const doSetup = async () => {
      try {
        await this.getClient();
      } catch (error) {
        this.setupError = error as Error;
        throw error;
      }
    };

    if (!this.isSetup) {
      this.isSetup = doSetup();
    }
    await this.isSetup;
  }

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    const client = await this.getClient();

    try {
      const table: Table = await client.query(sql);

      // Convert Arrow Table to QueryDataRow[]
      const rows: QueryDataRow[] = [];
      for (let i = 0; i < table.numRows; i++) {
        const row: QueryDataRow = {};
        for (const field of table.schema.fields) {
          const column = table.getChild(field.name);
          if (column) {
            row[field.name] = column.get(i);
          }
        }
        rows.push(row);
      }

      return {rows, totalRows: rows.length};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GizmoSQL query failed: ${message}`);
    }
  }

  public async *runSQLStream(
    sql: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const defaultOptions = this.readQueryOptions();
    rowLimit ??= defaultOptions.rowLimit;
    await this.setup();

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    const result = await this.runDuckDBQuery(statements[0]);
    let index = 0;

    for (const row of result.rows) {
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        break;
      }
      index++;
      yield row;
    }
  }

  async createHash(sqlCommand: string): Promise<string> {
    return crypto.createHash('md5').update(sqlCommand).digest('hex');
  }

  public async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}
