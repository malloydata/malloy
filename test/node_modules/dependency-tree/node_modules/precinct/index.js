'use strict';

const fs = require('fs');
const path = require('path');
const { debuglog } = require('util');

const getModuleType = require('module-definition');
const Walker = require('node-source-walk');

const detectiveAmd = require('detective-amd');
const detectiveCjs = require('detective-cjs');
const detectiveEs6 = require('detective-es6');
const detectiveLess = require('detective-less');
const detectivePostcss = require('detective-postcss');
const detectiveSass = require('detective-sass');
const detectiveScss = require('detective-scss');
const detectiveStylus = require('detective-stylus');
const detectiveTypeScript = require('detective-typescript');

const debug = debuglog('precinct');
const natives = process.binding('natives');

/**
 * Finds the list of dependencies for the given file
 *
 * @param {String|Object} content - File's content or AST
 * @param {Object} [options]
 * @param {String} [options.type] - The type of content being passed in. Useful if you want to use a non-js detective
 * @return {String[]}
 */
function precinct(content, options = {}) {
  debug('options given: %o', options);

  let dependencies = [];
  let ast;
  let type = options.type;

  // We assume we're dealing with a JS file
  if (!type && typeof content !== 'object') {
    debug('we assume this is JS');
    const walker = new Walker();

    try {
      // Parse once and distribute the AST to all detectives
      ast = walker.parse(content);
      debug('parsed the file content into an ast');
      precinct.ast = ast;
    } catch (error) {
      // In case a previous call had it populated
      precinct.ast = null;
      debug('could not parse content: %s', error.message);
      return dependencies;
    }
  // SASS files shouldn't be parsed by Acorn
  } else {
    ast = content;

    if (typeof content === 'object') {
      precinct.ast = content;
    }
  }

  type = type || getModuleType.fromSource(ast);
  debug('module type: %s', type);

  let theDetective;
  const mixedMode = options.es6 && options.es6.mixedImports;

  switch (type) {
    case 'cjs':
    case 'commonjs':
      theDetective = mixedMode ? detectiveEs6Cjs : detectiveCjs;
      break;
    case 'css':
      theDetective = detectivePostcss;
      break;
    case 'amd':
      theDetective = detectiveAmd;
      break;
    case 'mjs':
    case 'esm':
    case 'es6':
      theDetective = mixedMode ? detectiveEs6Cjs : detectiveEs6;
      break;
    case 'sass':
      theDetective = detectiveSass;
      break;
    case 'less':
      theDetective = detectiveLess;
      break;
    case 'scss':
      theDetective = detectiveScss;
      break;
    case 'stylus':
      theDetective = detectiveStylus;
      break;
    case 'ts':
      theDetective = detectiveTypeScript;
      break;
    case 'tsx':
      theDetective = detectiveTypeScript.tsx;
      break;
    default:
      // nothing
  }

  if (theDetective) {
    dependencies = theDetective(ast, options[type]);
  } else {
    debug('no detective found for: %s', type);
  }

  // For non-JS files that we don't parse
  if (theDetective && theDetective.ast) {
    precinct.ast = theDetective.ast;
  }

  return dependencies;
}

function detectiveEs6Cjs(ast, detectiveOptions) {
  return detectiveEs6(ast, detectiveOptions).concat(detectiveCjs(ast, detectiveOptions));
}

/**
 * Returns the dependencies for the given file path
 *
 * @param {String} filename
 * @param {Object} [options]
 * @param {Boolean} [options.includeCore=true] - Whether or not to include core modules in the dependency list
 * @param {Object} [options.fileSystem=undefined] - An alternative fs implementation to use for reading the file path.
 * @return {String[]}
 */
precinct.paperwork = (filename, options = {}) => {
  options = { includeCore: true, ...options };

  const fileSystem = options.fileSystem || fs;
  const content = fileSystem.readFileSync(filename, 'utf8');
  const ext = path.extname(filename);
  let type;

  if (ext === '.styl') {
    debug('paperwork: converting .styl into the stylus type');
    type = 'stylus';
  } else if (ext === '.cjs') {
    debug('paperwork: converting .cjs into the commonjs type');
    type = 'commonjs';
  // We need to sniff the JS module to find its type, not by extension
  // Other possible types pass through normally
  } else if (ext !== '.js' && ext !== '.jsx') {
    debug('paperwork: stripping the dot from the extension to serve as the type');
    type = ext.replace('.', '');
  }

  if (type) {
    debug('paperwork: setting the module type');
    options.type = type;
  }

  debug('paperwork: invoking precinct');
  const deps = precinct(content, options);

  if (!options.includeCore) {
    return deps.filter((dep) => {
      if (dep.startsWith('node:')) {
        return false
      }

      // In nodejs 18, node:test is a builtin but shows up under natives["test"], but
      // can only be imported by "node:test." We're correcting this so "test" isn't 
      // unnecessarily stripped from the imports
      if ("test" == dep) { 
        debug('paperwork: allowing test import to avoid builtin/natives consideration\n');
        return true
      }

      const isInNatives = Boolean(natives[dep]);
      return !isInNatives;
    });
  }

  debug('paperwork: got these results\n', deps);
  return deps;
};

module.exports = precinct;
