### detective-scss [![CI](https://img.shields.io/github/workflow/status/dependents/node-detective-scss/CI/main?label=CI&logo=github)](https://github.com/dependents/node-detective-scss/actions/workflows/ci.yml?query=branch%3Amain) [![npm](https://img.shields.io/npm/v/detective-scss)](https://www.npmjs.com/package/detective-scss) [![npm](https://img.shields.io/npm/dm/detective-scss)](https://www.npmjs.com/package/detective-scss)

> Find the dependencies of an scss file

```sh
npm install detective-scss
```

It's the SCSS counterpart to [detective](https://github.com/substack/node-detective), [detective-amd](https://github.com/dependents/node-detective-amd), [detective-es6](https://github.com/dependents/node-detective-es6), [detective-sass](https://github.com/dependents/node-detective-sass).

* The AST is generated using the [gonzales-pe](https://github.com/tonyganch/gonzales-pe) parser.

### Usage

```js
const fs = require('fs');
const detective = require('detective-scss');

const content = fs.readFileSync('styles.scss', 'utf8');

// list of imported file names (ex: '_foo.scss', '_foo', etc)
const dependencies = detective(content);
```

### Related

Check out [node-sass-lookup](https://github.com/dependents/node-sass-lookup) if you want to map a sass/scss dependency to a file on your filesystem.

### License

MIT
