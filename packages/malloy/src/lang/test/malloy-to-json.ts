/* eslint-disable no-console */
import * as readline from "readline";
import { MalloyTranslator } from "..";
import { Malloy } from "../..";
import { pretty } from "../jest-factories";
import { readFileSync } from "fs";

async function translateMalloy(fileSrc: string, url = "malloy://cli/stdin") {
  const mt = new MalloyTranslator(url);
  mt.update({ URLs: { [url]: fileSrc } });
  let translating = true;
  let mr = mt.translate();
  while (translating) {
    if (mr.tables) {
      const tables = await Malloy.db.getSchemaForMissingTables(mr.tables);
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
  return fn[0] === "/" ? fn : `${process.cwd()}/${fn}`;
}

async function main() {
  if (process.argv.length > 2) {
    for (const fileArg of process.argv.slice(2)) {
      const src = readFileSync(fileArg, "utf-8");
      const url = `file:/${fullPath(fileArg)}`;
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
