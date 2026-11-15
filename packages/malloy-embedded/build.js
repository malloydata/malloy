/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Bundles src/index.ts and everything it reaches into one classic script,
// dist/malloy-embedded.js, for engines that evaluate plain ECMAScript with no
// module loader and no Node or browser APIs. See CONTEXT.md.

const esbuild = require('esbuild');
const path = require('path');

const {execSync} = require('child_process');

const malloyVersion = require('@malloydata/malloy/package.json').version;

// The commit the bundle was built from, with "-dirty" when the checkout had
// uncommitted changes; "unknown" outside a git checkout.
function sourceCommit() {
  try {
    const git = cmd =>
      execSync(`git ${cmd}`, {cwd: __dirname}).toString().trim();
    return (
      git('rev-parse --short HEAD') +
      (git('status --porcelain') ? '-dirty' : '')
    );
  } catch {
    return 'unknown';
  }
}

esbuild
  .build({
    entryPoints: [path.join(__dirname, 'src/index.ts')],
    outfile: path.join(__dirname, 'dist/malloy-embedded.js'),
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
    define: {
      __MALLOY_VERSION__: JSON.stringify(malloyVersion),
      __MALLOY_COMMIT__: JSON.stringify(sourceCommit()),
    },
    logLevel: 'warning',
  })
  .catch(() => process.exit(1));
