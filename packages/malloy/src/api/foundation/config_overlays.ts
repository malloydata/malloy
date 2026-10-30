/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ConnectionPropertyType} from '../../connection/registry';

/**
 * An overlay is a lambda that takes a compiled reference path and returns
 * a value (or undefined if the path is not present in the overlay source).
 *
 * Overlays may return synchronously or asynchronously — the return type is
 * `unknown | Promise<unknown>`. The reference resolver awaits every overlay
 * result, so a sync overlay and an async overlay are interchangeable from
 * the caller's perspective. Use sync for purely in-memory values (env vars,
 * host context dicts) and async for anything that touches IO (secret stores,
 * session fetches, enterprise-managed injected values).
 *
 * The path is an array because references can address nested data:
 *   {env: "HOME"}             -> path = ["HOME"]
 *   {user: ["address", "zip"]} -> path = ["address", "zip"]
 *
 * Overlay values should resolve to ordinary JSON-compatible values.
 *
 * `request.type` is the type of the property being filled, and the overlay
 * should return a value of that type. An overlay over a source that only
 * holds text, like `env`, should be built with `textOverlay`, which does the
 * conversion. An overlay may ignore `request`; what it returns is
 * type-checked either way. `MalloyConfig.readOverlay` passes no `request`.
 */
export type Overlay = (
  path: string[],
  request?: OverlayRequest
) => unknown | Promise<unknown>;

export interface OverlayRequest {
  type: ConnectionPropertyType;
}

/**
 * A dict keyed by overlay name. A config reference like
 * `{env: "PG_PASSWORD"}` is resolved by looking up `overlays["env"]` and
 * calling it with `["PG_PASSWORD"]`.
 *
 * Hosts provide additional overlays by passing a partial dict to the
 * `MalloyConfig` constructor. The constructor merges it onto the default
 * overlays by plain object spread, giving three behaviors:
 *
 *   - Add:     {session: sessionFn}       — env and config stay, session added
 *   - Replace: {config: myConfigFn}       — host replaces the default config
 *   - Disable: {config: () => undefined}  — refs to {config: ...} drop
 */
export type ConfigOverlays = Record<string, Overlay>;

/**
 * Built-in `env` overlay: reads `process.env[path[0]]`.
 *
 * Hardened against missing `process` so `defaultConfigOverlays()` is safe
 * to call from any runtime. In the browser or a worker with no process.env,
 * `{env: "X"}` references resolve to "not present" (property dropped),
 * symmetric with the no-op default `config` overlay. Browser hosts can
 * still swap in their own `env` overlay if they want a different source.
 */
export function envOverlay(): Overlay {
  if (typeof process === 'undefined' || !process.env) {
    return () => undefined;
  }
  return textOverlay(path => process.env[path[0]]);
}

/**
 * Make an overlay from a function that looks up text, for a source that only
 * holds strings: environment variables, a secret store, a table of strings.
 * `read` returns the text at a path, or undefined if there is none, and may
 * be async.
 *
 * For a boolean property, "true" and "false" become booleans. For a number
 * property, numeric text becomes a number. Case and surrounding spaces are
 * ignored. Any other text is returned unchanged, so the type check reports
 * it as a bad value; returning undefined would mean "not set", and the
 * property would silently disappear.
 */
export function textOverlay(
  read: (path: string[]) => string | undefined | Promise<string | undefined>
): Overlay {
  // Not async: `manifestPath: {env: ...}` is read synchronously, while the
  // MalloyConfig is being constructed.
  return (path, request) => {
    const text = read(path);
    if (typeof text === 'object') {
      return text.then(t => readTextAs(t, request));
    }
    return readTextAs(text, request);
  };
}

function readTextAs(
  text: string | undefined,
  request: OverlayRequest | undefined
): unknown {
  if (text === undefined || request === undefined) return text;
  const trimmed = text.trim();
  switch (request.type) {
    case 'boolean': {
      const lower = trimmed.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      return text;
    }
    case 'number': {
      const n = Number(trimmed);
      return trimmed !== '' && Number.isFinite(n) ? n : text;
    }
    default:
      return text;
  }
}

/**
 * Helper that turns a plain dict into an overlay lambda. Used by hosts
 * (and discovery wiring) to build a populated `config` overlay.
 *
 *   const overlays = {
 *     config: contextOverlay({
 *       rootDirectory: ceilingURL,
 *       configURL: configURL,
 *     }),
 *   };
 */
export function contextOverlay(dict: Record<string, unknown>): Overlay {
  return path => dict[path[0]];
}

/**
 * The default config overlays: `env` wired to process.env, and a no-op
 * `config` overlay. Hosts that want discovery-populated context replace
 * the `config` entry; soloists leave it alone and `{config: ...}` refs
 * resolve to "not present".
 */
export function defaultConfigOverlays(): ConfigOverlays {
  return {
    env: envOverlay(),
    config: () => undefined,
  };
}

/**
 * Type guard for "looks like a Promise." Used by sync-peek call sites
 * (`computeManifestURL`, `resolveSyncStringSetting`) to detect when a host
 * mistakenly wired an async overlay into a slot that's read synchronously.
 */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}
