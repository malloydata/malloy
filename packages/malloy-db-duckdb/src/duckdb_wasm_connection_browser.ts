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
import {DuckDBWASMConnection as DuckDBWASMConnectionBase} from './duckdb_wasm_connection';
import type {
  // DuckDBMap,
  DuckDBRow,
  DuckDBValue,
} from '@motherduck/wasm-client';
import {
  // DuckDBBlob,
  DuckDBDate,
  DuckDBDecimal,
  // DuckDBInterval,
  DuckDBList,
  DuckDBStruct,
  DuckDBTime,
  DuckDBTimestampMicroseconds,
  DuckDBTimestampMilliseconds,
  DuckDBTimestampNanoseconds,
  DuckDBTimestampSeconds,
  MDConnection,
} from '@motherduck/wasm-client';
import type {QueryDataRow, QueryValue} from '@malloydata/malloy';

function unwrapMotherDuck(value: DuckDBValue) {
  let result: QueryValue = null;
  if (value !== null && typeof value === 'object') {
    if (value instanceof DuckDBDate) {
      result = new Date(value.days * 8.64e7);
    } else if (value instanceof DuckDBDecimal) {
      result = Number(value.scaledValue) / Math.pow(10, value.scale);
    } else if (value instanceof DuckDBTime) {
      result = new Date(Number(value.microseconds) / 1000);
    } else if (value instanceof DuckDBTimestampMicroseconds) {
      result = new Date(Number(value.microseconds) / 1000);
    } else if (value instanceof DuckDBTimestampMilliseconds) {
      result = new Date(Number(value.milliseconds));
    } else if (value instanceof DuckDBTimestampNanoseconds) {
      result = new Date(Number(value.nanoseconds) / 1000 / 1000);
    } else if (value instanceof DuckDBTimestampSeconds) {
      result = new Date(Number(value.seconds) * 1000);
    } else if (value instanceof DuckDBStruct) {
      const struct: QueryValue = {};
      for (const structEntry of value.entries) {
        struct[structEntry.key] = unwrapMotherDuck(structEntry.value);
      }
      result = struct;
    } else if (value instanceof DuckDBList) {
      result = value.values.map(unwrapMotherDuck);
    } else {
      result = value.toString();
    }
  } else if (typeof value === 'bigint') {
    // Preserve precision by converting to string
    result = value.toString();
  } else {
    result = value;
  }
  return result;
}

function unwrapMotherDuckRow(row: DuckDBRow) {
  const result: QueryDataRow = {};
  for (const entry of Object.entries(row)) {
    const [key, value] = entry;
    result[key] = unwrapMotherDuck(value);
  }
  return result;
}

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
      // eslint-disable-next-line no-console
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
            const rows = result.data
              .toRows()
              .map(row => unwrapMotherDuckRow(row));
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
}
