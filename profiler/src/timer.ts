/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */
import {compileQueryStable} from './profiler';

async function main() {
  const fs = require('fs');
  const filePath = process.argv[2];
  if (filePath === undefined) {
    console.log('Missing file path');
    return;
  }
  const fileContent = fs.readFileSync(filePath, 'utf8');
  console.log(`REQUEST ${fileContent.substring(0, 100)}`);
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const response = compileQueryStable(fileContent);
    if (i === 0) {
      console.log(`RESPONSE ${response.response.substring(0, 100)}`);
    }
    if (response.time !== undefined) {
      times.push(response.time);
    } else {
      return;
    }
  }
  const avg = times.reduce((a, b) => a + b) / times.length;
  console.log('AVERAGE TIME = ' + avg + 'ms');
}

main();
