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

// Runs antlr to generate the compiler from the compiler description,
// it also notices (using an md5 checksum) if the compiler description
// has changed, so it can skip running antlr when there are no changes.

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

function oldDigest() {
  return existsSync(digestFile)
    ? readFileSync(digestFile, "utf-8")
    : "__DIGEST_FILE_NOT_FOUND__";
}

function run(cmd) {
  try {
    console.log(`>> ${cmd}`);
    console.log(execSync(cmd).toString());
  } catch (runError) {
    return false;
  }
  return true;
}

let rebuild = false;

for (const fn of parserDstFiles) {
  rebuild ||= !existsSync(path.join(libDir, fn));
}

const parserDigest = md5(
  digestSrcFiles.map((fn) => readFileSync(fn, "utf-8")).join("")
);
rebuild ||= parserDigest != oldDigest();

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
