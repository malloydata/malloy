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

import { LookupConnection, Connection } from "@malloydata/malloy";
import { DuckDBWASMConnection } from "@malloydata/db-duckdb-wasm";

export class DuckDBWasmLookup implements LookupConnection<Connection> {
  connection: DuckDBWASMConnection;

  constructor() {
    this.connection = new DuckDBWASMConnection("duckdb");
  }

  async lookupConnection(_name: string): Promise<Connection> {
    await this.connection.connecting;
    return this.connection;
  }
}
