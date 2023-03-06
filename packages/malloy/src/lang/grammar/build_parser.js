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
// It also notices (using an md5 checksum) if the compiler spec
// has changed, to avoid re-running antlr when there are no changes.

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const {readFileSync, writeFileSync, existsSync, rmSync} = require('fs');
const md5 = require('md5');
const path = require('path');
const {execSync} = require('child_process');

const langSrc = path.dirname(__dirname);
const libDir = path.join(langSrc, 'lib', 'Malloy');
const digestFile = path.join(libDir, 'Malloy.md5');
const digestSrcFiles = [__filename, 'MalloyLexer.g4', 'MalloyParser.g4'];
const compilerSrcs = ['MalloyLexer.ts', 'MalloyParser.ts'];

function oldDigest() {
  return existsSync(digestFile)
    ? readFileSync(digestFile, 'utf-8')
    : '__DIGEST_FILE_NOT_FOUND__';
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
const versionDigest = md5(
  digestSrcFiles.map(fn => readFileSync(fn, 'utf-8')).join('')
);
let rebuild = versionDigest !== oldDigest();

for (const fn of compilerSrcs) {
  rebuild = rebuild || !existsSync(path.join(libDir, fn));
}

if (rebuild) {
  console.log('-- Constructing Malloy parser from antlr specification ...');
  const antlr = 'antlr4ts -Xexact-output-dir -o ../lib/Malloy';
  if (
    run(`${antlr} MalloyLexer.g4`) &&
    run(`${antlr} -visitor MalloyParser.g4`)
  ) {
    writeFileSync(digestFile, versionDigest);
  } else {
    rmSync(digestFile);
  }
} else {
  console.log('-- Using existing Malloy parser');
}
