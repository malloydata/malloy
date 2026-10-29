/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DuckDBBundles} from '@duckdb/duckdb-wasm';
import {DuckDBWASMConnection as DuckDBWASMConnectionBase} from './duckdb_wasm_connection';

export class DuckDBWASMConnection extends DuckDBWASMConnectionBase {
  getBundles(): DuckDBBundles {
    const resolvePath = require.resolve('@duckdb/duckdb-wasm');
    if (!resolvePath) {
      throw new Error('Unable to resolve @duckdb/duckdb-wasm path');
    }
    const distMatch = resolvePath.match(/^.*\/dist\//);
    if (!distMatch) {
      throw new Error('Unable to resolve @duckdb/duckdb-wasm dist path');
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
}
