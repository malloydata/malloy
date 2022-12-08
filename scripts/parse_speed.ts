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
/* eslint-disable no-console */
import { Malloy, Connection } from "@malloydata/malloy";
import { DuckDBConnection  } from "@malloydata/db-duckdb";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { performance } from "perf_hooks";

async function translate(fileSrc: string, fileURL: string) {
  const url = new URL(fileURL);
  const parse = Malloy.parse({ source: fileSrc, url });
  const connection = new DuckDBConnection("duckdb");
  const lookupConnection = async function (name: string): Promise<Connection> {
    if (name == "duckdb" || name === undefined) {
      return connection;
    }
    throw new Error(`No connection ${name}`);
  };
  const readURL = async function (url: URL): Promise<string> {
    const filePath = url.pathname;
    const src = await readFile(filePath, { encoding: "utf-8" });
    return src;
  };
  await Malloy.compile({
    urlReader: { readURL },
    connections: { lookupConnection },
    parse,
  });
}

function fullPath(fn: string): string {
  if (fn[0] === "/") {
    return fn;
  }
  return `${process.cwd()}/${fn}`;
}

async function main() {
  if (process.argv.length > 2) {
    for (const fileArg of process.argv.slice(2)) {
      const filePath = fullPath(fileArg);
      const src = readFileSync(filePath, "utf-8");
      const url = `file:/${filePath}`;
      console.log(`Begin benchmark marse for ${fileArg}`);
      for (let i = 0; i < 100; i++) {
        console.log("RUN");
        const fromTime = performance.now();
        await translate(src, url);
        const elapsed = performance.now() - fromTime;
        console.log(`#${i} ${elapsed}`);
      }
    }
  }
}

main();
