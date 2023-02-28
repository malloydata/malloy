### detective-stylus [![CI](https://img.shields.io/github/workflow/status/dependents/node-detective-stylus/CI/main?label=CI&logo=github)](https://github.com/dependents/node-detective-stylus/actions/workflows/ci.yml?query=branch%3Amain) [![npm](https://img.shields.io/npm/v/detective-stylus)](https://www.npmjs.com/package/detective-stylus) [![npm](https://img.shields.io/npm/dm/detective-stylus)](https://www.npmjs.com/package/detective-stylus)

> Find the dependencies of a Stylus file

```sh
npm install detective-stylus
```

It's the Stylus counterpart to
[detective](https://github.com/substack/node-detective),
[detective-amd](https://github.com/dependents/node-detective-amd),
[detective-es6](https://github.com/dependents/node-detective-es6),
and [detective-sass](https://github.com/dependents/node-detective-sass).

Note: this detective uses a regex to find the `@import` or `@require` statements.

### Usage

```js
const fs = require('fs');
const detective = require('detective-stylus');

const content = fs.readFileSync('styles.styl', 'utf8');

// list of imported file names (ex: '_foo.styl', '_foo', etc)
const dependencies = detective(content);
```

### License

MIT
