# node-detective-postcss

[![build](https://github.com/dependents/node-detective-postcss/actions/workflows/node.js.yml/badge.svg)](https://github.com/dependents/node-detective-postcss/actions/workflows/node.js.yml)
[![npm](https://img.shields.io/npm/v/detective-postcss.svg)](https://www.npmjs.com/package/detective-postcss)

> Find the dependencies of a CSS file (postCSS dialects)

Supports `@import` and [`@value ... from`](https://github.com/css-modules/postcss-icss-values).

`npm install --save detective-postcss`

It's the CSS (PostCSS dialect) counterpart to [detective](https://github.com/browserify/detective), [detective-amd](https://github.com/dependents/node-detective-amd), [detective-es6](https://github.com/dependents/node-detective-es6), [detective-sass](https://github.com/dependents/node-detective-sass), [detective-scss](https://github.com/dependents/node-detective-scss).

- The AST is generated using [postcss](https://github.com/postcss/postcss) and [postcss-values-parser](https://github.com/shellscape/postcss-values-parser).

### Usage

```js
const fs = require('fs');
const detective = require('detective-postcss');

const content = fs.readFileSync('styles.css', 'utf8');

// list of imported file names (ex: 'bla.css', 'foo.css', etc.)
const dependencies = detective(content);

// or to also detect any url() references to images, fonts, etc.
const allDependencies = detective(content, { url: true });
```

### License

MIT

## Releasing

- Bump the version of `package.json` to a meaningful version for the changes since the last release (we follow semver).
- To do a dry-run of the release and what would go out in the package you can manually execute the [npm-publish](https://github.com/dependents/node-detective-postcss/actions/workflows/npm-publish.yml) workflow on the `main` branch. It will do a dry-run publish (not actually publish the new version).
- Draft a new release in the github project - please use a tag named `vX.X.X` (where `X.X.X` is the new to-be-releases semver of the package - please add as many detail as possible to the release description.
- Once you're ready, `Publish` the release. Publishing will trigger the [npm-publish](https://github.com/dependents/node-detective-postcss/actions/workflows/npm-publish.yml) workflow on the tag and do the actual publish to npm.
