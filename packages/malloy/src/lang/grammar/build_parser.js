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
/* eslint-disable @typescript-eslint/no-var-requires */
const { readFileSync, writeFileSync, existsSync, rmSync } = require("fs");
const md5 = require("md5");
const path = require("path");
const { execSync } = require("child_process");

const langSrc = path.dirname(__dirname);
process.chdir(path.join(langSrc, "grammar"));
const libDir = path.join(langSrc, "lib", "Malloy");

const digestSrcFiles = [__filename, "MalloyLexer.g4", "MalloyParser.g4"];
const parserDstFiles = ["MalloyLexer.ts", "MalloyParser.ts"];
const digestFile = path.join(libDir, "Malloy.md5");

function newDigest() {
  const parserSrc = digestSrcFiles
    .map((fn) => readFileSync(fn, "utf-8"))
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
  try {
    console.log(`>> ${cmd}`);
    console.log(execSync(cmd).toString());
  } catch (runError) {
    cleanRun = false;
  }
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

if (rebuild) {
  const antlr = `antlr4ts -Xexact-output-dir -o ../lib/Malloy`;
  if (
    run(`${antlr} MalloyLexer.g4`) &&
    run(`${antlr} -visitor MalloyParser.g4`)
  ) {
    writeFileSync(digestFile, parserDigest);
    console.log(`Antlr generated Malloy parser -- Created`);
  } else {
    rmSync(digestFile);
  }
} else {
  console.log(`Antlr generated Malloy parser -- Already exists`);
}
