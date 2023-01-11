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

// Runs antlr to generate the compiler from the compiler spec.
// It also notices (using an md5 checksum) if the compiler spec
// has changed, to avoid re-running antlr when there are no changes.

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { readFileSync, writeFileSync, existsSync, rmSync } = require("fs");
const crypto = require('crypto');
const path = require("path");
const { execSync } = require("child_process");

const langSrc = path.dirname(__dirname);
const libDir = path.join(langSrc, "lib", "Malloy");
const digestFile = path.join(libDir, "Malloy.md5");
const digestSrcFiles = [__filename, "MalloyLexer.g4", "MalloyParser.g4"];
const compilerSrcs = ["MalloyLexer.ts", "MalloyParser.ts"];

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

process.chdir(path.join(langSrc, "grammar"));
const versionDigest = crypto
  .createHash('md5')
  .update(digestSrcFiles.map((fn) => readFileSync(fn, "utf-8")).join(""))
  .digest('hex');
let rebuild = versionDigest != oldDigest();

for (const fn of compilerSrcs) {
  rebuild ||= !existsSync(path.join(libDir, fn));
}

if (rebuild) {
  console.log(`-- Constructing Malloy parser from antlr specification ...`);
  const antlr = `antlr4ts -Xexact-output-dir -o ../lib/Malloy`;
  if (
    run(`${antlr} MalloyLexer.g4`) &&
    run(`${antlr} -visitor MalloyParser.g4`)
  ) {
    writeFileSync(digestFile, versionDigest);
  } else {
    rmSync(digestFile);
  }
} else {
  console.log(`-- Using existing Malloy parser`);
}
