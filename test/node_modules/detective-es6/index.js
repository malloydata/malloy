'use strict';

const Walker = require('node-source-walk');

/**
 * Extracts the dependencies of the supplied es6 module
 *
 * @param  {String|Object} src - File's content or AST
 * @param  {Object} options - optional extra settings
 * @return {String[]}
 */
module.exports = function(src, options) {
  const dependencies = [];

  if (typeof src === 'undefined') throw new Error('src not given');
  if (src === '') return dependencies;

  const walker = new Walker();

  walker.walk(src, (node) => {
    switch (node.type) {
      case 'ImportDeclaration':
        if (options && options.skipTypeImports && node.importKind === 'type') {
          break;
        }

        if (node.source && node.source.value) {
          dependencies.push(node.source.value);
        }

        break;
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
        if (node.source && node.source.value) {
          dependencies.push(node.source.value);
        }

        break;
      case 'CallExpression':
        if (options && options.skipAsyncImports) {
          break;
        }

        if (node.callee.type === 'Import' && node.arguments.length > 0 &&
            node.arguments[0].value) {
          dependencies.push(node.arguments[0].value);
        }

        break;
      default:
        // nothing
    }
  });

  return dependencies;
};
