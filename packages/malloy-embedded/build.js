/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Bundles src/index.ts and everything it reaches into one classic script,
// dist/malloy-embedded.js, for engines that evaluate plain ECMAScript with no
// module loader and no Node or browser APIs. See CONTEXT.md.

const esbuild = require('esbuild');
const path = require('path');

const malloyVersion = require('@malloydata/malloy/package.json').version;

const builds = [
  ['src/index.ts', 'dist/malloy-embedded.js'],
  // SPIKE: the Foundation API.
  ['src/runtime.ts', 'dist/malloy-runtime.js'],
];

for (const [entry, out] of builds)
  esbuild
    .build({
      entryPoints: [path.join(__dirname, entry)],
      outfile: path.join(__dirname, out),
      bundle: true,
      format: 'iife',
      // Neutral, not browser: nothing may assume `window` or `document`.
      platform: 'neutral',
      mainFields: ['main', 'module'],
      target: 'es2020',
      minify: true,
      sourcemap: 'external',
      legalComments: 'eof',
      inject: [path.join(__dirname, 'src/process-shim.ts')],
      define: {__MALLOY_VERSION__: JSON.stringify(malloyVersion)},
      logLevel: 'warning',
    })
    .catch(() => process.exit(1));
