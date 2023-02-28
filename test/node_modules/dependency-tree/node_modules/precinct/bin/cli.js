#!/usr/bin/env node

'use strict';

const fs = require('fs');
const program = require('commander');
const precinct = require('../index.js');
const { version } = require('../package.json');

program
  .arguments('<filename>')
  .version(version)
  .option('--es6-mixed-imports', 'Fetch all dependendies from a file that contains both CJS and ES6 imports')
  .option('-t, --type <type>', 'The type of content being passed in. Useful if you want to use a non-JS detective')
  .parse();

const cliOptions = program.opts();
const options = {
  es6: {
    mixedImports: Boolean(cliOptions.es6MixedImports)
  },
  type: cliOptions.type
};

const content = fs.readFileSync(program.args[0], 'utf8');

console.log(precinct(content, options).join('\n'));
