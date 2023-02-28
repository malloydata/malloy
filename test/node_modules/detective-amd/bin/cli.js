#!/usr/bin/env node

/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const getDependencies = require('../index.js');

const filename = process.argv[2];

if (!filename) {
  console.log('Filename not supplied');
  console.log('Usage: detective-amd <filename>');
} else {
  const deps = getDependencies(fs.readFileSync(filename));
  deps.forEach((dep) => {
    console.log(dep);
  });
}
