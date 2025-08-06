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
