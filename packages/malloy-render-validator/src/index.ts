/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Fake DOM must be installed before the renderer UMD loads,
// because Solid.js (bundled inside) touches DOM globals at init time.
// We use explicit require() so we can install, load, then remove
// the fake DOM — preventing other libraries (e.g. axios) from
// mistakenly thinking they're in a browser.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {installFakeDom, removeFakeDom} = require('./fake-dom');
installFakeDom();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {MalloyRenderer} = require('@malloydata/render');
removeFakeDom();

import type * as Malloy from '@malloydata/malloy-interfaces';

/**
 * Validate renderer tags on a Malloy result without executing the query
 * or requiring a browser DOM. Intended for headless / MCP use.
 *
 * @param result A `Malloy.Result` (typically from `PreparedResult.toStableResult()`)
 * @returns Array of log messages (errors, warnings) from tag validation
 */
export function validateRenderTags(result: Malloy.Result): Malloy.LogMessage[] {
  const renderer = new MalloyRenderer();
  const viz = renderer.createViz();
  viz.setResult(result);
  return viz.getLogs();
}
