/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Fake DOM must be installed before the renderer UMD loads,
// because Solid.js (bundled inside) touches DOM globals at init time.
// CJS require() is synchronous, so this is guaranteed to run first.
import './fake-dom';

import type * as Malloy from '@malloydata/malloy-interfaces';
import {MalloyRenderer} from '@malloydata/render';

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
