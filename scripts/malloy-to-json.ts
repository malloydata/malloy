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
import * as readline from "readline";
import { inspect } from "util";
import { Malloy, Connection } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function pretty(thing: any): string {
  return inspect(thing, { breakLength: 72, depth: Infinity });
}

/*

CLI TRANSLATION UTILITY

Can be run with "npm run malloyc"

CURRENTLY HAS TWO MODES

1) npm run malloyc ( no arguments )
    Prompts for one line of input, parses that one
    line and dumps the translator output.

    The two things you want, multi line input, or being
    able to type two commands that operator on the same model,
    are not yet implemented.

2) npm run malloyc file1 file2 ...
    For each file parse and dump translator output

*/

async function printTranlsatedMalloy(fileSrc: string, fileURL: string) {
  const url = new URL(fileURL);
  const parse = Malloy.parse({ source: fileSrc, url });
  const connection = new BigQueryConnection("bigquery");
  const lookupConnection = async function (name: string): Promise<Connection> {
    if (name == "bigquery" || name === undefined) {
      return connection;
    }
    throw new Error(`No connection ${name}`);
  };
  const readURL = async function (url: URL): Promise<string> {
    const filePath = url.pathname;
    const src = await readFile(filePath, { encoding: "utf-8" });
    return src;
  };
  try {
    const model = await Malloy.compile({
      urlReader: { readURL },
      connections: { lookupConnection },
      parse,
    });
    console.log(pretty(model._modelDef));
  } catch (e) {
    console.log(e.message);
  }
}

function ask(rlObj: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rlObj.question(prompt, resolve);
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
      await printTranlsatedMalloy(src, url);
    }
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    let translating = true;
    while (translating) {
      const src = await ask(rl, "malloy> ");
      if (src) {
        await printTranlsatedMalloy(src, "malloy://cli/stdin");
      } else {
        translating = false;
      }
    }
    rl.close();
  }
}

main();
