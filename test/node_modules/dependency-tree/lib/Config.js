'use strict';

const path = require('path');
const debug = require('debug')('tree');

class Config {
  constructor(options) {
    this.filename = options.filename;
    this.directory = options.directory || options.root;
    this.visited = options.visited || {};
    this.nonExistent = options.nonExistent || [];
    this.isListForm = options.isListForm;
    this.requireConfig = options.config || options.requireConfig;
    this.webpackConfig = options.webpackConfig;
    this.nodeModulesConfig = options.nodeModulesConfig;
    this.detectiveConfig = options.detective || options.detectiveConfig || {};
    this.tsConfig = options.tsConfig;
    this.noTypeDefinitions = options.noTypeDefinitions;

    this.filter = options.filter;

    if (!this.filename) { throw new Error('filename not given'); }
    if (!this.directory) { throw new Error('directory not given'); }
    if (this.filter && typeof this.filter !== 'function') { throw new Error('filter must be a function'); }

    if ('string' === typeof this.tsConfig) {
      debug('preparsing the ts config into an object for performance');
      const ts = require('typescript');
      const tsParsedConfig = ts.readJsonConfigFile(this.tsConfig, ts.sys.readFile);
      const obj = ts.parseJsonSourceFileConfigFileContent(tsParsedConfig, ts.sys, path.dirname(this.tsConfig));
      this.tsConfig = obj.raw;
    }

    debug('given filename: ' + this.filename);

    this.filename = path.resolve(process.cwd(), this.filename);

    debug('resolved filename: ' + this.filename);
    debug('visited: ', this.visited);
  }

  clone () {
    return new Config(this);
  }
}

module.exports = Config;
