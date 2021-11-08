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
import * as readline from "readline";
import { Malloy, MalloyTranslator } from "@malloy-lang/malloy";
import { pretty } from "@malloy-lang/malloy/src/lang/jest-factories";
import { readFileSync } from "fs";

/*

CLI TRANSLATION UTILITY

Can be run with "ts-node packages/malloy/src/lang/test malloy-to-json.ts"
or "yarn malloyc" if you are in packages/malloy

CURRENTLY HAS TWO MODES

1) yarn malloyc ( no arguments )
    Prompts for one line of input, parses that one
    line and dumps the translator output.

    The two things you want, multi line input, or being
    able to type two commands that operator on the same model,
    are not yet implemented.

2) yarn malloyc file1 file2 ...
    For each file parse and dump translator output

*/

async function translateMalloy(fileSrc: string, url = "malloy://cli/stdin") {
  const mt = new MalloyTranslator(url);
  mt.update({ URLs: { [url]: fileSrc } });
  let translating = true;
  let mr = mt.translate();
  while (translating) {
    if (mr.tables) {
      const tables = await Malloy.db.fetchSchemaForTables(mr.tables);
      mt.update({ tables });
    }
    if (mr.final) {
      translating = false;
    } else {
      mr = mt.translate();
    }
  }
  if (mr.translated) {
    console.log(pretty(mr));
  } else if (mr.errors) {
    console.log(mt.prettyErrors());
  } else {
    console.log("Translation Response:", pretty(mr));
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
  return `${process.env.INIT_CWD}/${fn}`;
}

async function main() {
  if (process.argv.length > 2) {
    for (const fileArg of process.argv.slice(2)) {
      const filePath = fullPath(fileArg);
      const src = readFileSync(filePath, "utf-8");
      const url = `file:/${filePath}`;
      await translateMalloy(src, url);
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
        await translateMalloy(src);
      } else {
        translating = false;
      }
    }
    rl.close();
  }
}

main();
