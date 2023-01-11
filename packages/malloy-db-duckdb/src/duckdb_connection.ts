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
import { DuckDBCommon, QueryOptionsReader } from "./duckdb_common";
import { Connection, Database, OPEN_READWRITE, Row } from "duckdb";
import { QueryDataRow, RunSQLOptions } from "@malloydata/malloy";

export class DuckDBConnection extends DuckDBCommon {
  connecting: Promise<void>;
  protected connection: Connection | null = null;
  protected database: Database | null = null;
  protected isSetup: Promise<void> | undefined;

  constructor(
    public readonly name: string,
    private databasePath = ":memory:",
    private workingDirectory = ".",
    queryOptions?: QueryOptionsReader
  ) {
    super(queryOptions);
    this.connecting = this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.database = new Database(
        this.databasePath,
        OPEN_READWRITE, // databasePath === ":memory:" ? OPEN_READWRITE : OPEN_READONLY,
        (err) => {
          if (err) {
            reject(err);
          }
        }
      );
      this.connection = this.database.connect();
      resolve();
    });
  }

  protected async setup(): Promise<void> {
    const doSetup = async () => {
      if (this.workingDirectory) {
        await this.runDuckDBQuery(
          `SET FILE_SEARCH_PATH='${this.workingDirectory}'`
        );
      }
      try {
        await this.runDuckDBQuery("INSTALL 'json'");
        await this.runDuckDBQuery("LOAD 'json'");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Unable to load json extension", error);
      }
      try {
        await this.runDuckDBQuery("INSTALL 'httpfs'");
        await this.runDuckDBQuery("LOAD 'httpfs'");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Unable to load httpfs extension", error);
      }
    };
    await this.connecting;
    if (!this.isSetup) {
      this.isSetup = doSetup();
    }
    await this.isSetup;
  }

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{ rows: Row[]; totalRows: number }> {
    return new Promise((resolve, reject) => {
      if (this.connection) {
        this.connection.all(sql, (err: Error, rows: Row[]) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              rows,
              totalRows: rows.length,
            });
          }
        });
      } else {
        reject(new Error("Connection not open"));
      }
    });
  }

  public async *runSQLStream(
    sql: string,
    _options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    await this.setup();
    if (!this.connection) {
      throw new Error("Connection not open");
    }

    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    for await (const row of this.connection.stream(statements[0])) {
      yield row;
    }
  }

  async createHash(sqlCommand: string): Promise<string> {
    return crypto.createHash("md5").update(sqlCommand).digest("hex");
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection = null;
    }
    if (this.database) {
      this.database.close();
      this.database = null;
    }
  }
}
