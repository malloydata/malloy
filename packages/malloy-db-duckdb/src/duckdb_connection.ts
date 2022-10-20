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

import * as crypto from "crypto";
import { DuckDBCommon } from "./duckdb_common";
import { Database, OPEN_READWRITE, Row } from "duckdb";
import { QueryDataRow, RunSQLOptions } from "@malloydata/malloy";

export class DuckDBConnection extends DuckDBCommon {
  protected connection;
  protected database;
  protected isSetup = false;

  constructor(
    public readonly name: string,
    databasePath = "test/data/duckdb/duckdb_test.db",
    private workingDirectory = "/"
  ) {
    super();

    this.database = new Database(
      databasePath,
      OPEN_READWRITE, // databasePath === ":memory:" ? OPEN_READWRITE : OPEN_READONLY,
      (err) => {
        if (err) {
          return console.error(err);
        }
      }
    );
    this.connection = this.database.connect();
  }

  protected async setup(): Promise<void> {
    if (!this.isSetup) {
      if (this.workingDirectory) {
        this.runDuckDBQuery(`SET FILE_SEARCH_PATH='${this.workingDirectory}'`);
      }
      // TODO: This is where we will load extensions once we figure
      // out how to better support them.
      // await this.runDuckDBQuery("INSTALL 'json'");
      // await this.runDuckDBQuery("LOAD 'json'");
      // await this.runDuckDBQuery("INSTALL 'httpfs'");
      // await this.runDuckDBQuery("LOAD 'httpfs'");
      //   await this.runDuckDBQuery("DROP MACRO sum_distinct");
      //   try {
      //     await this.runDuckDBQuery(
      //       `
      //       create macro sum_distinct(l) as  (
      //         select sum(x.val) as value FROM (select unnest(l)) x
      //       )
      //       `
      //     );
      //   } catch (e) {}
    }
    this.isSetup = true;
  }

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{ rows: Row[]; totalRows: number }> {
    return new Promise((resolve, reject) => {
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
    });
  }

  public async *runSQLStream(
    sql: string,
    _options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    await this.setup();
    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    for await (const row of this.connection.stream(statements[0])) {
      yield row;
    }
  }

  createHash(sqlCommand: string): Promise<string> {
    return Promise.resolve(
      crypto.createHash("md5").update(sqlCommand).digest("hex")
    );
  }
}
