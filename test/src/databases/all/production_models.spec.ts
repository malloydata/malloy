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

import fs from "fs";
import path from "path";
import { Connection, FixedConnectionMap, Runtime } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { describeIfDatabaseAvailable } from "../../util";
import { DuckDBConnection } from "@malloydata/db-duckdb";

const SAMPLE_PROJECT_ROOT = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "samples"
);

const [describe] = describeIfDatabaseAvailable(["bigquery", "duckdb"]);

describe(`compiling sample models`, () => {
  let modelsFound = false;
  const dirsToSearch = [SAMPLE_PROJECT_ROOT];
  while (dirsToSearch.length > 0) {
    const dir = dirsToSearch.pop();
    if (dir === undefined) {
      break;
    }
    for (const child of fs.readdirSync(dir)) {
      const childPath = path.join(dir, child);
      if (fs.statSync(childPath).isDirectory()) {
        dirsToSearch.push(childPath);
      } else if (child.endsWith(".malloy")) {
        modelsFound = true;
        const srcURL = new URL(`model://${childPath}`);
        const fileReader = {
          readURL: (url: URL) => {
            return Promise.resolve(
              fs.readFileSync(url.toString().replace("model://", ""), "utf-8")
            );
          },
        };
        const connections = new FixedConnectionMap(
          new Map<string, Connection>([
            ["bigquery", new BigQueryConnection("bigquery") as Connection],
            [
              "duckdb",
              new DuckDBConnection("duckdb", undefined, dir) as Connection,
            ],
          ]),
          "bigquery"
        );
        const runtime = new Runtime(fileReader, connections);
        test(`checking ${dir}/${child}`, async () => {
          await runtime.getModel(srcURL);
        });
      }
    }
  }
  expect(modelsFound).toBeTruthy();
});
