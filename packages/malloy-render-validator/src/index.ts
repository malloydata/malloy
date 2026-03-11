/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// WHY THIS FILE USES require() AND A FAKE DOM
//
// The renderer validates tags by instantiating (but not mounting) a
// Solid.js component tree. Solid's delegateEvents() runs during the
// renderer UMD's IIFE and references `window.document` as a default
// parameter, so merely loading the module in Node.js crashes with
// "window is not defined".
//
// We install fake DOM globals (window, document, navigator) just long
// enough for the renderer to load, then immediately remove them. If
// we left them in place, any library that checks
// `typeof window !== 'undefined'` (e.g. axios, used by trino-client)
// would think it's in a browser and break in different ways.
//
// We use explicit require() instead of import because TypeScript
// hoists all import statements to the top of the compiled output,
// making it impossible to run code between two imports. With require()
// the calls stay in source order: install shim, load renderer, remove shim.

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
