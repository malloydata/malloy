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
import { readFileSync, writeFileSync, existsSync } from "fs";
import md5 from "md5";
import * as path from "path";
import * as child_process from "child_process";

const parserSrcFiles = ["MalloyLexer.g4", "MalloyParser.g4"];
const parserDstFiles = ["MalloyLexer.ts", "MalloyParser.ts"];
const libDir = path.join(path.basename(__dirname), "lib");
const digestFile = path.join(libDir, "Malloy.md5");

function newDigest() {
  const parserSrc = parserSrcFiles
    .map((fn) => {
      readFileSync(fn, "utf-8");
    })
    .join("");
  return md5(parserSrc);
}

function oldDigest() {
  if (existsSync(digestFile)) {
    return readFileSync(digestFile, "utf-8");
  }
  return "__DIGEST_FILE_NOT_FOUND__";
}

function run(cmd) {
  let cleanRun = true;
  child_process.exec(cmd, (error, stdout, stderr) => {
    console.log(`Running ${cmd}`);
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }
    if (error) {
      console.error("ERROR:", error.message);
      cleanRun = false;
    }
  });
  return cleanRun;
}

let rebuild = false;

for (const fn of parserDstFiles) {
  if (!existsSync(path.join(libDir, fn))) {
    rebuild = true;
  }
}

const parserDigest = newDigest();
if (parserDigest != oldDigest()) {
  rebuild = true;
}

let parserOK = true;
if (rebuild) {
  parserOK = false;
  if (
    run(`antlr4ts -o ${libDir} MalloyLexer.g4`) &&
    run(`antlr4ts -visitor -listener -o ${libDir} MalloyParser.g4`)
  ) {
    writeFileSync(digestFile, parserDigest);
    parserOK = true;
  }
}
if (parserOK) {
  console.log(`Antlr generated Malloy parser in ${libDir} is up to date`);
}
