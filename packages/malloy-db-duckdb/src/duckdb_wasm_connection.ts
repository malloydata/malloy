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
import * as duckdb from "@duckdb/duckdb-wasm";
import Worker from "web-worker";
import { QueryDataRow, RunSQLOptions } from "@malloydata/malloy";
import { StructRow, Table, Vector } from "apache-arrow";
import { DuckDBCommon, QueryOptionsReader } from "./duckdb_common";

/**
 * Arrow's toJSON() doesn't really do what I'd expect, since
 * it still includes Arrow objects like DecimalBigNums and Vectors,
 * so we need this fairly gross function to unwrap those.
 *
 * @param value Element from an Arrow StructRow.
 * @returns Vanilla Javascript value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrapArrow = (value: unknown): any => {
  if (value === null) {
    return value;
  } else if (value instanceof Vector) {
    return [...value].map(unwrapArrow);
  } else if (value instanceof Date) {
    return value;
  } else if (typeof value === "bigint") {
    return Number(value);
  } else if (typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as Record<string | symbol, any>;
    // DecimalBigNums appear as Uint32Arrays, but can be identified
    // because they have a Symbol.toPrimitive method
    if (obj[Symbol.toPrimitive]) {
      // There seems to be a bug in [Symbol.toPrimitive]("number") so
      // convert to string first and then to number.
      return Number(obj[Symbol.toPrimitive]());
    } else if (Array.isArray(value)) {
      return value.map(unwrapArrow);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string | symbol, any> = {};
      for (const key in obj) {
        result[key] = unwrapArrow(obj[key]);
      }
      return result;
    }
  }
  return value;
};

/**
 * Process a single Arrow result row into a Malloy QueryDataRow
 * Unfortunately simply calling JSONParse(JSON.stringify(row)) even
 * winds up converting DecimalBigNums to strings instead of numbers.
 * For some reason a custom replacer only sees DecimalBigNums as
 * strings, as well.
 */
const unwrapRow = (row: StructRow): QueryDataRow => {
  return unwrapArrow(row.toJSON());
};

/**
 * Process a duckedb Table into an array of Malloy QueryDataRows
 */
const unwrapTable = (table: Table): QueryDataRow[] => {
  return table.toArray().map(unwrapRow);
};

const isNode = () => typeof navigator === "undefined";
const DIST = "./node_modules/@duckdb/duckdb-wasm/dist/";

export class DuckDBWASMConnection extends DuckDBCommon {
  connecting: Promise<void>;
  protected _connection: duckdb.AsyncDuckDBConnection | null = null;
  protected _database: duckdb.AsyncDuckDB | null = null;
  protected isSetup = false;
  private worker: Worker | null = null;

  constructor(
    public readonly name: string,
    private databasePath = "test/data/duckdb/duckdb_test.db",
    private workingDirectory = "/",
    queryOptions?: QueryOptionsReader
  ) {
    super(queryOptions);
    this.connecting = this.init();
  }

  private async init(): Promise<void> {
    const BUNDLES = isNode()
      ? {
          mvp: {
            mainModule: `${DIST}/duckdb-mvp.wasm`,
            mainWorker: `${DIST}/duckdb-node-mvp.worker.cjs`,
          },
          eh: {
            mainModule: `${DIST}/duckdb-eh.wasm`,
            mainWorker: `${DIST}/duckdb-node-eh.worker.cjs`,
          },
        }
      : duckdb.getJsDelivrBundles();

    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(BUNDLES);

    if (bundle.mainWorker) {
      const workerUrl = isNode()
        ? bundle.mainWorker
        : URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], {
              type: "text/javascript",
            })
          );

      // Instantiate the asynchronous version of DuckDB-wasm
      this.worker = new Worker(workerUrl);
      const logger = new duckdb.VoidLogger();
      this._database = new duckdb.AsyncDuckDB(logger, this.worker);
      await this._database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      if (this.databasePath) {
        await this._database.open({
          path: this.databasePath,
        });
      }
      URL.revokeObjectURL(workerUrl);
      this._connection = await this._database.connect();
    } else {
      throw new Error("Unable to instantiate duckdb-wasm");
    }
  }

  get connection(): duckdb.AsyncDuckDBConnection | null {
    return this._connection;
  }

  get database(): duckdb.AsyncDuckDB | null {
    return this._database;
  }

  protected async setup(): Promise<void> {
    await this.connecting;
  }

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{ rows: QueryDataRow[]; totalRows: number }> {
    const table = await this.connection?.query(sql);
    if (table?.numRows != null) {
      const rows = unwrapTable(table);
      // console.log(rows);
      return {
        // Normalize the data from its default proxied form
        rows,
        totalRows: table.numRows,
      };
    } else {
      throw new Error("Boom");
    }
  }

  public async *runSQLStream(
    sql: string,
    _options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    if (!this.connection) {
      throw new Error("duckdb-wasm not connected");
    }
    await this.setup();
    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    for await (const chunk of await this.connection.send(statements[0])) {
      for (const row of chunk.toArray()) {
        yield unwrapRow(row);
      }
    }
  }

  async close(): Promise<void> {
    if (this._connection) {
      await this._connection.close();
      this._connection = null;
    }
    if (this._database) {
      await this._database.terminate();
      this._database = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
