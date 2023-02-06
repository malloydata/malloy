/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/* eslint-disable no-console */
import { Malloy, Connection } from "@malloydata/malloy";
import { DuckDBConnection } from "@malloydata/db-duckdb";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { performance } from "perf_hooks";

async function translate(fileSrc: string, fileURL: string) {
  const url = new URL(fileURL);
  const parse = Malloy.parse({ "source": fileSrc, url });
  const connection = new DuckDBConnection("duckdb");
  const lookupConnection = async function (name: string): Promise<Connection> {
    if (name == "duckdb" || name === undefined) {
      return connection;
    }
    throw new Error(`No connection ${name}`);
  };
  const readURL = async function (url: URL): Promise<string> {
    const filePath = url.pathname;
    const src = await readFile(filePath, { "encoding": "utf-8" });
    return src;
  };
  const compiled = await Malloy.compile({
    "urlReader": { readURL },
    "connections": { lookupConnection },
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
