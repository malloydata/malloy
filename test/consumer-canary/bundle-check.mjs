/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Bundles the consumer for node with esbuild — the way the VS Code extension and
 * malloy-cli bundle. It does not run anything; bundling alone surfaces a published
 * runtime dep that a downstream esbuild consumer cannot bundle: a new native that
 * is not externalized, or a bare `require` of an optional native (e.g. pg < 8.8's
 * `require('pg-native')`). A clean producer build can still ship this — it only
 * bites at the consumer's bundle step.
 */

import {build} from 'esbuild';
import {fileURLToPath} from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));

// The externals a real downstream node bundle marks for the connector natives
// (mirrors the VS Code extension and malloy-cli esbuild configs). esbuild leaves
// these unresolved for runtime; anything ELSE it cannot resolve is a regression.
const external = ['@duckdb/*', 'lz4', 'pg-native'];

try {
  const result = await build({
    entryPoints: [path.join(dir, 'consumer.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external,
    write: false,
    logLevel: 'silent',
  });
  for (const w of result.warnings) {
    console.error('[canary] esbuild warning (non-fatal): ' + w.text);
  }
  console.log(
    '[canary] bundle-check PASSED — consumer bundles for node (externals: ' +
      external.join(', ') +
      ').'
  );
} catch (err) {
  console.error(
    '[canary] bundle-check FAILED — a published @malloydata runtime dep is not'
  );
  console.error(
    'bundle-safe for a downstream esbuild consumer: a new un-externalized native,'
  );
  console.error(
    'or a bare require of an optional native. See test/consumer-canary/CONTEXT.md'
  );
  console.error('and DEPENDENCY-MANAGEMENT.md.\n');
  for (const e of err.errors ?? []) {
    console.error(
      '  ' +
        (e.text ?? '') +
        (e.location ? ` (${e.location.file}:${e.location.line})` : '')
    );
  }
  if (!err.errors) console.error(String(err.message ?? err));
  process.exit(1);
}
