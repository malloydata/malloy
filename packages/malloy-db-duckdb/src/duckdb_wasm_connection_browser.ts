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

import * as duckdb from '@duckdb/duckdb-wasm';
import {
  DuckDBWASMConnection as DuckDBWASMConnectionBase,
  unwrapArrow,
} from './duckdb_wasm_connection';
import {MDConnection} from '@motherduck/wasm-client';
import {QueryDataRow} from '@malloydata/malloy';

export class DuckDBWASMConnection extends DuckDBWASMConnectionBase {
  protected _mdConnection: MDConnection | null = null;

  getBundles(): duckdb.DuckDBBundles {
    return duckdb.getJsDelivrBundles();
  }

  override async init(): Promise<void> {
    if (this.isMotherDuck) {
      if (!this.motherDuckToken) {
        throw new Error('Please set your MotherDuck token');
      }
      const mdConnection = MDConnection.create({
        mdToken: this.motherDuckToken,
      });
      await mdConnection.isInitialized();
      this._mdConnection = mdConnection;
      console.info('MotherDuck initialized');
    } else {
      await super.init();
    }
  }

  override async setup(): Promise<void> {
    if (this.isMotherDuck) {
      const doSetup = async () => {
        const setupCmds = ["SET TimeZone='UTC'"];
        for (const cmd of setupCmds) {
          try {
            await this.runDuckDBQuery(cmd);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`duckdb setup ${cmd} => ${error}`);
          }
        }
      };
      await this.connecting;
      if (!this.isSetup) {
        this.isSetup = doSetup();
      }
      await this.isSetup;
    } else {
      await super.setup();
    }
  }

  protected override async runDuckDBQuery(
    sql: string,
    abortSignal?: AbortSignal
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    if (this.isMotherDuck) {
      if (this._mdConnection) {
        const connection = this._mdConnection;
        let queryId: string | undefined = undefined;
        const cancel = () => {
          if (queryId) {
            connection.cancelQuery(queryId, 'Cancelled');
          }
        };
        abortSignal?.addEventListener('abort', cancel);
        queryId = connection.enqueueQuery(sql);
        if (queryId) {
          const result = await connection.evaluateQueuedQuery(queryId);
          if (result?.data) {
            const rows = unwrapArrow(result.data.toRows());
            const totalRows = result.data.rowCount;
            return {
              rows,
              totalRows,
            };
          }
          throw new Error('No data');
        }
        throw new Error('Failed to enqueue query');
      }
      throw new Error('MotherDuck not initialized');
    } else {
      return super.runDuckDBQuery(sql, abortSignal);
    }
  }

  async createHash(sqlCommand: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(sqlCommand);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }
}
