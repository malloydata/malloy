/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * An overlay is a lambda that takes a compiled reference path and returns
 * a value (or undefined if the path is not present in the overlay source).
 *
 * The path is an array because references can address nested data:
 *   {env: "HOME"}             -> path = ["HOME"]
 *   {user: ["address", "zip"]} -> path = ["address", "zip"]
 *
 * Overlay values should resolve to ordinary JSON-compatible values.
 */
export type Overlay = (path: string[]) => unknown;

/**
 * The stack is a dict keyed by overlay name. A config reference like
 * `{env: "PG_PASSWORD"}` is resolved by looking up `stack["env"]` and
 * calling it with `["PG_PASSWORD"]`.
 *
 * Hosts provide additional overlays by passing a partial stack to the
 * `MalloyConfig` constructor. The constructor merges it onto the default
 * stack by plain object spread, giving three behaviors:
 *
 *   - Add:     {session: sessionFn}       — env and config stay, session added
 *   - Replace: {config: myConfigFn}       — host replaces the default config
 *   - Disable: {config: () => undefined}  — refs to {config: ...} drop
 */
export type OverlayStack = Record<string, Overlay>;

/**
 * Built-in `env` overlay: reads `process.env[path[0]]`.
 *
 * Hardened against missing `process` so `defaultOverlayStack()` is safe to
 * call from any runtime. In the browser or a worker with no process.env,
 * `{env: "X"}` references resolve to "not present" (property dropped),
 * symmetric with the no-op default `config` overlay. Browser hosts can
 * still swap in their own `env` overlay if they want a different source.
 */
export function envOverlay(): Overlay {
  if (typeof process === 'undefined' || !process.env) {
    return () => undefined;
  }
  return path => process.env[path[0]];
}

/**
 * Helper that turns a plain dict into an overlay lambda. Used by hosts
 * (and discovery wiring) to build a populated `config` overlay.
 *
 *   const stack = {
 *     config: contextOverlay({
 *       rootDirectory: ceilingURL,
 *       configFile: configURL,
 *     }),
 *   };
 */
export function contextOverlay(dict: Record<string, unknown>): Overlay {
  return path => dict[path[0]];
}

/**
 * The default overlay stack: `env` wired to process.env, and a no-op
 * `config` overlay. Hosts that want discovery-populated context replace
 * the `config` entry; soloists leave it alone and `{config: ...}` refs
 * resolve to "not present".
 */
export function defaultOverlayStack(): OverlayStack {
  return {
    env: envOverlay(),
    config: () => undefined,
  };
}
