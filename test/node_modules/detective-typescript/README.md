### detective-typescript [![CI](https://img.shields.io/github/workflow/status/dependents/detective-typescript/CI/main?label=CI&logo=github)](https://github.com/dependents/detective-typescript/actions/workflows/ci.yml?query=branch%3Amain) [![npm](https://img.shields.io/npm/v/detective-typescript)](https://www.npmjs.com/package/detective-typescript) [![npm](https://img.shields.io/npm/dm/detective-typescript)](https://www.npmjs.com/package/detective-typescript)

> Get the dependencies of TypeScript module

```sh
npm install detective-typescript
```

### Usage

```js
const fs = require('fs');
const detective = require('detective-typescript');

const mySourceCode = fs.readFileSync('myfile.ts', 'utf8');

// Pass in a file's content or an AST
const dependencies = detective(mySourceCode);
```

### Options

- `skipTypeImports` (default: `false`) Skips imports that only imports types
- `mixedImports`: (default: `false`) Include CJS imports in dependency list
- `skipAsyncImports`: (default: `false`) Whether or not to omit async imports (import('foo'))
- `jsx`: (default: `false`) Enable parsing of JSX

#### License

MIT
