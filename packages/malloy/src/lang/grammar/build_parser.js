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
/* eslint-disable no-process-exit */

const fs = require('fs');
const https = require('https');
const {v5: uuidv5} = require('uuid');
const path = require('path');
const {execSync} = require('child_process');

const langSrc = path.dirname(__dirname);
const libDir = path.join(langSrc, 'lib');

let ANTLR_VERSION="update-from-package.json";
let antlrDist = '';
let antlrJar = '';
const antlr = '-Xexact-output-dir -o ../lib/Malloy';

const destDir = path.join(libDir, 'Malloy');
const digestFile = path.join(destDir, '_BUILD_DIGEST_');

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

async function ensureAntlrJarExists() {
  const packageJsonFile = path.join(langSrc, '../../package.json');
  const packageJsonSrc = fs.readFileSync(packageJsonFile);
  const package = JSON.parse(packageJsonSrc);
  ANTLR_VERSION = package.dependencies.antlr4;
  if (!ANTLR_VERSION.match(/^\d/)) {
    // Recommended in the antlr documentation because the version numbering in
    // antlr does not follow semantic versioning rules, so a human should decide
    // when it is OK to move the version forwards.
    console.log(`Antlr dependency must locked to a particular version, not ${ANTLR_VERSION}`)
    process.exit(3);
  }
  antlrDist = `https://www.antlr.org/download/antlr-${ANTLR_VERSION}-complete.jar`;
  antlrJar = path.join(libDir, `antlr-${ANTLR_VERSION}-complete.jar`);
  if (fs.existsSync(antlrJar)) {
    return;
  }
  console.log(`-- Download ${antlrDist}`);
  if (!fs.existsSync(libDir)) {
    console.log(`>> mkdir ${libDir}`);
    fs.mkdirSync(libDir);
  }
  const outFile = fs.openSync(antlrJar, 'w');
  await new Promise((resolve, _reject) => {
    https.get(antlrDist, (response) => {
      response.on('data', (chunk) => {
        fs.writeFileSync(outFile, chunk);
      });

      // note to future me, i tried testing this by putting a bad url in the request
      // it did not generate this response, so this code never runs, sorry future me
      // you have to learn what i didn't bother to learn
      response.on('error', () => {
        console.log(`Failed to download ${antlrDist}. Error response received`);
        fs.closeSync(outFile);
        fs.rmSync(antlrJar);
        process.exit(2);
      });

      response.on('end', () => {
        console.log(`>> written to ${antlrJar}\n`);
        fs.closeSync(outFile);
        resolve();
      });
    });
  });
}

function oldDigest() {
  try {
    if (fs.existsSync(digestFile)) {
      return JSON.parse(fs.readFileSync(digestFile, 'utf-8'));
    }
  } catch (e) {
    // nothing to do
  }
  return {};
}

function run(cmd) {
  javaCmd = `java -jar ${antlrJar} -Dlanguage=TypeScript ${cmd}`
  try {
    console.log(`>> antlr4 ${cmd}`);
    console.log(javaCmd);
    console.log(execSync(javaCmd).toString());
  } catch (runError) {
    console.log(runError);
    return false;
  }
  return true;
}


function version(fn) {
  return uuidv5(fs.readFileSync(fn, 'utf-8'), MALLOY_UUID);
}

async function MAIN() {
  let gotJar = false;
  process.chdir(path.join(langSrc, 'grammar'));
  const prevDigest = oldDigest();
  const buildDigest = {[__filename]: version(__filename)};
  let newDigest = false;
  for (const target of build) {
    buildDigest[target.src] = version(target.src);
    if (
      prevDigest[__filename] === buildDigest[__filename] &&
      fs.existsSync(path.join(destDir, target.makes)) &&
      prevDigest[target.src] === buildDigest[target.src]
    ) {
      console.log(`-- ${target.makes} up to date`);
      continue;
    }
    if (!gotJar) {
      await ensureAntlrJarExists();
      gotJar = true;
    }
    console.log(`-- Create ${target.makes} from ${target.src}`);
    if (!run(`${target.run} ${target.src}`)) {
      fs.rmSync(digestFile);
      process.exit(1);
    }
    newDigest = true;
  }
  if (newDigest) {
    fs.writeFileSync(digestFile, JSON.stringify(buildDigest));
  }
}
MAIN();
