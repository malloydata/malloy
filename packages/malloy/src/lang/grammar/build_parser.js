/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Runs antlr to generate the compiler from the compiler spec.
// It also notices (using a checksum) if the compiler spec
// has changed, to avoid re-running antlr when there are no changes.

/* eslint-disable no-console */

const {readFileSync, writeFileSync, existsSync, rmSync} = require('fs');
const {v5: uuidv5} = require('uuid');
const path = require('path');
const {execSync} = require('child_process');

const langSrc = path.dirname(__dirname);
const libDir = path.join(langSrc, 'lib', 'Malloy');
const antlr = 'antlr4ts -Xexact-output-dir -o ../lib/Malloy';
const digestFile = path.join(libDir, '_BUILD_DIGEST_');
const build = [
  {src: 'MalloyLexer.g4', makes: 'MalloyLexer.ts', run: antlr},
  {src: 'MalloyParser.g4', makes: 'MalloyParser.ts', run: `${antlr} -visitor`},
];
const MALLOY_UUID = '76c17e9d-f3ce-5f2d-bfde-98ad3d2a37f6';

function oldDigest() {
  try {
    if (existsSync(digestFile)) {
      return JSON.parse(readFileSync(digestFile, 'utf-8'));
    }
  } catch (e) {
    // nothing to do
  }
  return {};
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

process.chdir(path.join(langSrc, 'grammar'));

function version(fn) {
  return uuidv5(readFileSync(fn, 'utf-8'), MALLOY_UUID);
}

const prevDigest = oldDigest();
const buildDigest = {[__filename]: version(__filename)};
let newDigest = false;
for (const target of build) {
  buildDigest[target.src] = version(target.src);
  if (
    prevDigest[__filename] === buildDigest[__filename] &&
    existsSync(path.join(libDir, target.makes)) &&
    prevDigest[target.src] === buildDigest[target.src]
  ) {
    console.log(`-- ${target.makes} up to date`);
    continue;
  }
  console.log(`-- Create ${target.makes} from ${target.src}`);
  if (!run(`${target.run} ${target.src}`)) {
    rmSync(digestFile);
    process.exit(1);
  }
  newDigest = true;
}
if (newDigest) {
  writeFileSync(digestFile, JSON.stringify(buildDigest));
}
