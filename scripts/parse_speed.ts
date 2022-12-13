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
import { DuckDBConnection } from "@malloydata/db-duckdb";
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
  const compiled = await Malloy.compile({
    urlReader: { readURL },
    connections: { lookupConnection },
    parse,
  });
  compiled._modelDef;
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
      const lines = src.split("\n").length;
      console.log(
        `Begin benchmark parse for ${fileArg}. ${lines} lines, ${src.length} characters`
      );
      let firstRun = 0;
      let total = 0;
      const runCount = 100;
      for (let i = 0; i < runCount; i++) {
        const fromTime = performance.now();
        await translate(src, url);
        const elapsed = performance.now() - fromTime;
        if (i % 5 == 0) {
          console.log(`#${i} ${elapsed}`);
        }
        if (i == 0) {
          firstRun = elapsed;
        } else if (i >= 5) {
          total += elapsed;
        }
      }
      console.log("First run: ", firstRun);
      console.log("Warm Average: ", total / (runCount - 5));
    }
  }
}

main();
