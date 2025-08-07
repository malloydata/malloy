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

  const response = compileQueryStable(fileContent);

  if (response.time) {
    console.log(`TOOK: ${response.time}ms`);
  }

  console.log(`RESPONSE ${response.response.substring(0, 100)}`);
}

main();
