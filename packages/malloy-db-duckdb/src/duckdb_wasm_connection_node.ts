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

import crypto from 'crypto';
import {DuckDBBundles} from '@malloydata/duckdb-wasm';
import {DuckDBWASMConnection as DuckDBWASMConnectionBase} from './duckdb_wasm_connection';

export class DuckDBWASMConnection extends DuckDBWASMConnectionBase {
  getBundles(): DuckDBBundles {
    const resolvePath = require.resolve('@malloydata/duckdb-wasm');
    if (!resolvePath) {
      throw new Error('Unable to resolve @malloydata/duckdb-wasm path');
    }
    const distMatch = resolvePath.match(/^.*\/dist\//);
    if (!distMatch) {
      throw new Error('Unable to resolve @malloydata/duckdb-wasm dist path');
    }
    const dist = distMatch[0];

    return {
      mvp: {
        mainModule: `${dist}/duckdb-mvp.wasm`,
        mainWorker: `${dist}/duckdb-node-mvp.worker.cjs`,
      },
      eh: {
        mainModule: `${dist}/duckdb-eh.wasm`,
        mainWorker: `${dist}/duckdb-node-eh.worker.cjs`,
      },
    };
  }

  async createHash(sqlCommand: string): Promise<string> {
    return crypto.createHash('md5').update(sqlCommand).digest('hex');
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1');
  }
}
