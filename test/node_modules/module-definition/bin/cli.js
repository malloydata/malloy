#!/usr/bin/env node

'use strict';

const getModuleType = require('../index.js');
const filename = process.argv[2];

console.log(getModuleType.sync(filename)); // eslint-disable-line no-console
