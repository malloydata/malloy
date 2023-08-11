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

// Runs antlr to generate the compiler from the compiler spec.
// It also notices (using a checksum) if the compiler spec
// has changed, to avoid re-running antlr when there are no changes.

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
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
  {
    src: 'MalloyTag.g4',
    makes: 'MalloyTagParser.ts',
    run: `${antlr} -visitor -no-listener`,
  },
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
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
  newDigest = true;
}
if (newDigest) {
  writeFileSync(digestFile, JSON.stringify(buildDigest));
}
