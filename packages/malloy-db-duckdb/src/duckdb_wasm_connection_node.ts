/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import crypto from "crypto";
import { DuckDBBundles } from "@duckdb/duckdb-wasm";
import { DuckDBWASMConnection as DuckDBWASMConnectionBase } from "./duckdb_wasm_connection";

export class DuckDBWASMConnection extends DuckDBWASMConnectionBase {
  getBundles(): DuckDBBundles {
    const resolvePath = require.resolve("@duckdb/duckdb-wasm");
    if (!resolvePath) {
      throw new Error("Unable to resolve @duckdb/duckdb-wasm path");
    }
    const distMatch = resolvePath.match(/^.*\/dist\//);
    if (!distMatch) {
      throw new Error("Unable to resolve @duckdb/duckdb-wasm dist path");
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
    return crypto.createHash("md5").update(sqlCommand).digest("hex");
  }
}
