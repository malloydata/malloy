#!/usr/bin/env node

'use strict';

const dependencyTree = require('../');
const program = require('commander');

program
  .version(require('../package.json').version)
  .usage('[options] <filename>')
  .option('-d, --directory <path>', 'location of files of supported filetypes')
  .option('-c, --require-config <path>', 'path to a requirejs config')
  .option('-w, --webpack-config <path>', 'path to a webpack config')
  .option('-t, --ts-config <path>', 'path to a typescript config')
  .option('--list-form', 'output the list form of the tree (one element per line)')
  .parse(process.argv);

let tree;

const options = {
  filename: program.args[0],
  root: program.directory,
  config: program.requireConfig,
  webpackConfig: program.webpackConfig,
  tsConfig: program.tsConfig
};

if (program.listForm) {
  tree = dependencyTree.toList(options);

  tree.forEach(function(node) {
    console.log(node);
  });

} else {
  tree = dependencyTree(options);

  console.log(JSON.stringify(tree));
}
