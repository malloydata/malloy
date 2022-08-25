"use strict";
/*
 * Copyright 2021 Google LLC
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeList = exports.rows = exports.DuckDBTestConnection = exports.PostgresTestConnection = exports.BigQueryTestConnection = exports.duckdbBug3721 = void 0;
const malloy_1 = require("@malloydata/malloy");
const db_bigquery_1 = require("@malloydata/db-bigquery");
const db_postgres_1 = require("@malloydata/db-postgres");
const db_duckdb_1 = require("@malloydata/db-duckdb");
// https://github.com/duckdb/duckdb/issues/3721
//  computes symmetric aggregates incorrectly.  When we have a fix,
//  set this to false to test and then remove.
exports.duckdbBug3721 = true;
class BigQueryTestConnection extends db_bigquery_1.BigQueryConnection {
    // we probably need a better way to do this.
    async runSQL(sqlCommand, options) {
        try {
            return await super.runSQL(sqlCommand, options);
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.log(`Error in SQL:\n ${sqlCommand}`);
            throw e;
        }
    }
}
exports.BigQueryTestConnection = BigQueryTestConnection;
class PostgresTestConnection extends db_postgres_1.PooledPostgresConnection {
    // we probably need a better way to do this.
    async runSQL(sqlCommand, options) {
        try {
            return await super.runSQL(sqlCommand, options);
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.log(`Error in SQL:\n ${sqlCommand}`);
            throw e;
        }
    }
}
exports.PostgresTestConnection = PostgresTestConnection;
class DuckDBTestConnection extends db_duckdb_1.DuckDBConnection {
    // we probably need a better way to do this.
    constructor(name) {
        super(name);
    }
    async runSQL(sqlCommand, options) {
        try {
            return await super.runSQL(sqlCommand, options);
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.log(`Error in SQL:\n ${sqlCommand}`);
            throw e;
        }
    }
}
exports.DuckDBTestConnection = DuckDBTestConnection;
const files = new malloy_1.EmptyURLReader();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rows(qr) {
    return qr.data.value;
}
exports.rows = rows;
const allDatabases = ["postgres", "bigquery", "duckdb"];
class RuntimeList {
    constructor(databaseList = undefined) {
        this.bqConnection = new BigQueryTestConnection("bigquery", {}, { defaultProject: "malloy-data" });
        this.runtimeMap = new Map();
        for (const dbName of databaseList || allDatabases) {
            switch (dbName) {
                case "bigquery":
                    this.runtimeMap.set("bigquery", new malloy_1.SingleConnectionRuntime(files, new BigQueryTestConnection("bigquery", {}, { defaultProject: "malloy-data" })));
                    break;
                case "postgres":
                    {
                        const pg = new PostgresTestConnection("postgres");
                        this.runtimeMap.set("postgres", new malloy_1.SingleConnectionRuntime(files, pg));
                    }
                    break;
                case "duckdb": {
                    const duckdb = new DuckDBTestConnection("duckdb");
                    this.runtimeMap.set("duckdb", new malloy_1.SingleConnectionRuntime(files, duckdb));
                }
            }
        }
    }
    async closeAll() {
        for (const [_key, runtime] of this.runtimeMap) {
            if (runtime.connection.isPool())
                runtime.connection.drain();
        }
    }
}
exports.RuntimeList = RuntimeList;
//# sourceMappingURL=runtimes.js.map