### node-source-walk [![CI](https://img.shields.io/github/workflow/status/dependents/node-source-walk/CI/main?label=CI&logo=github)](https://github.com/dependents/node-source-walk/actions/workflows/ci.yml?query=branch%3Amain) [![npm](https://img.shields.io/npm/v/node-source-walk)](https://www.npmjs.com/package/node-source-walk) [![npm](https://img.shields.io/npm/dm/node-source-walk)](https://www.npmjs.com/package/node-source-walk)

> Synchronously execute a callback on every node of a file's AST and stop walking whenever you see fit.

```sh
npm install node-source-walk
```

### Usage

```js
const Walker = require('node-source-walk');

const walker = new Walker();

// Assume src is the string contents of myfile.js
// or the AST of an outside parse of myfile.js
walker.walk(src, (node) => {
  if (node.type === whateverImLookingFor) {
    // No need to keep traversing since we found what we wanted
    walker.stopWalking();
  }
});
```

By default, Walker will use `@babel/parser` (supporting ES6, JSX, Flow, and all other available @babel/parser plugins) and the `sourceType: module`, but you can change any of the defaults as follows:

```js
const walker = new Walker({
  sourceType: 'script',
  // If you don't like experimental plugins
  plugins: [
    'jsx',
    'flow'
  ]
});
```

* The supplied options are passed through to the parser, so you can configure it according to @babel/parser's [documentation](https://babeljs.io/docs/en/babel-parser.html).

### Swap out the parser

If you want to supply your own parser, you can do:

```js
const walker = new Walker({
  parser: mySweetParser
});
```

* The custom parser must have a `.parse` method that takes in a string and returns an object/AST.
* All of the other options supplied to the Walker constructor will be passed along as parser options to your chosen parser.

### Public Members

#### `walk(src, cb)`

* Recursively walks the given `src` from top to bottom
* `src`: the contents of a file **OR** its (already parsed) AST
* `cb`: a function that is called for every visited node
  * The argument passed to `cb` will be the currently visited node.

#### `moonwalk(node, cb)`

* Recursively walks up an AST starting from the given node. This is a traversal that's in the opposite direction of `walk` and `traverse`
* `node`: a valid AST node
* `cb`: a function that is called for every node (specifically via visiting the parent(s) of every node recursively)
  * The argument passed to `cb` will be the currently visited node.

#### `stopWalking()`

* Halts further walking of the AST until another manual call of `walk` or `moonwalk`
* This is super-beneficial when dealing with large source files (or ASTs)

#### `traverse(node, cb)`

* Allows you to traverse an AST node and execute a callback on it
* Callback should expect the first argument to be an AST node, similar to `walk`'s callback

#### `parse(src)`

* Uses the options supplied to Walker to parse the given source code string and return its AST using the configured parser (or @babel/parser by default).

## License

MIT
