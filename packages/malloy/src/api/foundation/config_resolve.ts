/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang/parse-log';
import {
  getConnectionProperties,
  getRegisteredConnectionTypes,
} from '../../connection/registry';
import type {
  ConnectionConfigEntry,
  ConnectionPropertyDefinition,
} from '../../connection/registry';
import type {ConfigDict, ConfigNode, ConfigReference} from './config_compile';
import type {ConfigOverlays} from './config_overlays';

/**
 * The shape the class body consumes: a plain POJO with the same top-level
 * sections as the input, but with all references resolved and defaults
 * applied. This is fed into the connection registry to build connections.
 *
 * `connections` uses the registry's `ConnectionConfigEntry` shape directly —
 * a resolved entry is precisely what the registry consumes, so there's no
 * reason to invent a local alias and cast across the boundary.
 *
 * Note: `includeDefaultConnections` is an input directive, not a resolved
 * value — by the time `resolveConfig` returns, fabrication has already
 * happened. It intentionally does not appear on this interface.
 */
export interface ResolvedConfig {
  connections: Record<string, ConnectionConfigEntry>;
  manifestPath?: string;
  virtualMap?: unknown;
}

/**
 * Walk a compiled tree against the overlay dict and produce a plain
 * resolved POJO.
 *
 * Two distinct "defaults" mechanisms, deliberately separated:
 *
 *   1. **Property defaults** (`applyPropertyDefaults`) — fill in missing
 *      properties on *every* connection entry, user-listed or fabricated.
 *      This is a uniform per-property rule; there is no asymmetry between
 *      explicit and auto-generated entries.
 *
 *   2. **`includeDefaultConnections`** (`fabricateMissingConnections`) —
 *      fabricate a bare `{is: typeName}` entry for each registered backend
 *      not already represented. Property defaults then fill in their
 *      properties via (1).
 *
 *   Order matters: fabrication runs before property defaults so that
 *   fabricated entries pick up defaults in the same pass as user-listed
 *   ones.
 *
 * Three unresolved-reference cases, each with different handling:
 *   1. Unknown overlay source    → warning, drop property
 *   2. Known overlay → undefined → silent drop
 *   3. Property default → unresolved (either of the above inside a default)
 *                                → silent drop (a default is a hint, not a requirement)
 */
export function resolveConfig(
  compiled: ConfigDict,
  overlays: ConfigOverlays,
  log: LogMessage[]
): ResolvedConfig {
  const resolved: ResolvedConfig = {connections: {}};
  let includeDefaultConnections = false;

  for (const [key, node] of Object.entries(compiled.entries)) {
    switch (key) {
      case 'connections': {
        if (node.kind !== 'dict') break;
        resolved.connections = resolveConnections(node, overlays, log);
        break;
      }
      case 'manifestPath': {
        const v = resolveNode(node, overlays, log);
        if (typeof v === 'string') resolved.manifestPath = v;
        break;
      }
      case 'virtualMap': {
        // virtualMap is literal data — the class body converts it to the
        // runtime Map-of-Maps representation.
        resolved.virtualMap = resolveNode(node, overlays, log);
        break;
      }
      case 'includeDefaultConnections': {
        const v = resolveNode(node, overlays, log);
        if (typeof v === 'boolean') includeDefaultConnections = v;
        break;
      }
    }
  }

  if (includeDefaultConnections) {
    fabricateMissingConnections(resolved.connections);
  }

  // Property defaults apply to every entry — user-listed and fabricated
  // alike. This is the fix for the earlier bug where defaults only fired
  // during fabrication, leaving explicit entries silently underconfigured.
  applyPropertyDefaults(resolved.connections, overlays);

  return resolved;
}

// =============================================================================
// Generic walk
// =============================================================================

/**
 * Walk a single node and produce its resolved value. References that fail
 * to resolve return `undefined`; the parent dict walker then drops the
 * corresponding property.
 */
function resolveNode(
  node: ConfigNode,
  overlays: ConfigOverlays,
  log: LogMessage[]
): unknown {
  switch (node.kind) {
    case 'value':
      return node.value;
    case 'reference':
      return resolveReference(node, overlays, log);
    case 'dict': {
      const out: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(node.entries)) {
        const r = resolveNode(child, overlays, log);
        if (r !== undefined) out[k] = r;
      }
      return out;
    }
  }
}

function resolveReference(
  ref: ConfigReference,
  overlays: ConfigOverlays,
  log: LogMessage[]
): unknown {
  const overlay = overlays[ref.source];
  if (!overlay) {
    // Case 1: unknown overlay source — warn and drop.
    log.push({
      message: `unknown overlay source "${ref.source}" for reference path ${JSON.stringify(ref.path)}`,
      severity: 'warn',
      code: 'config-overlay',
    });
    return undefined;
  }
  // Case 2: overlay returns undefined — silent drop (no log push).
  return overlay(ref.path);
}

// =============================================================================
// Connections
// =============================================================================

function resolveConnections(
  node: ConfigDict,
  overlays: ConfigOverlays,
  log: LogMessage[]
): Record<string, ConnectionConfigEntry> {
  const result: Record<string, ConnectionConfigEntry> = {};
  for (const [name, connNode] of Object.entries(node.entries)) {
    if (connNode.kind !== 'dict') continue;
    const resolved = resolveNode(connNode, overlays, log) as Record<
      string,
      unknown
    >;
    // compileConnectionEntry guarantees `is` is a string value node, and
    // resolveNode preserves it. Any connection without `is` is a bug in the
    // compiler; skip it defensively.
    if (typeof resolved['is'] !== 'string') continue;
    result[name] = resolved as ConnectionConfigEntry;
  }
  return result;
}

// =============================================================================
// Fabrication and property defaults
// =============================================================================

/**
 * Fabricate a bare `{is: typeName}` entry for each registered connection
 * type not already represented in `connections`. Only runs when the
 * `includeDefaultConnections` flag is set on the config. Property values
 * are *not* filled in here — that is the job of `applyPropertyDefaults`,
 * which runs unconditionally on every entry in a later pass.
 *
 * A user-named connection that happens to share the type name but points
 * at a different backend is left alone.
 *
 * Mutates `connections` in place. Called only by `resolveConfig` on its
 * own freshly-built object.
 */
function fabricateMissingConnections(
  connections: Record<string, ConnectionConfigEntry>
): void {
  const presentTypes = new Set<string>();
  for (const entry of Object.values(connections)) {
    if (typeof entry.is === 'string') presentTypes.add(entry.is);
  }
  for (const typeName of getRegisteredConnectionTypes()) {
    // `presentTypes` catches {mydb: {is: 'duckdb'}}; the name check catches
    // {duckdb: {is: 'jsondb'}}. Both cases leave the registered `duckdb`
    // type alone — the first because it's already represented, the second
    // because we can't use the obvious name without clobbering.
    if (presentTypes.has(typeName)) continue;
    if (connections[typeName]) continue;
    connections[typeName] = {is: typeName};
  }
}

/**
 * For every connection entry, fill in any property that the user didn't
 * specify and whose `ConnectionPropertyDefinition` declares a `default`.
 * Runs uniformly on both user-listed and fabricated entries — the earlier
 * behavior of only firing during fabrication was a bug that left explicit
 * entries silently underconfigured (e.g. a user-listed `duckdb` never
 * picked up `workingDirectory: {config: 'rootDirectory'}`).
 *
 * Defaults that are reference-shaped resolve through the overlays via
 * `resolveDefault`. Unresolved defaults are silently dropped (case 3).
 * User-specified values are never overwritten.
 *
 * Interaction with inline references: if the user specified a property
 * as a reference-shaped value that failed to resolve (e.g. `{env: 'UNSET'}`),
 * `resolveConnections` already dropped it before we see the entry. From
 * our perspective the property is simply absent, so the default applies —
 * effectively turning inline references into "try this first, else fall
 * back to the default." This is almost always what users want.
 *
 * Mutates `connections` in place. Called only by `resolveConfig` on its
 * own freshly-built object.
 */
function applyPropertyDefaults(
  connections: Record<string, ConnectionConfigEntry>,
  overlays: ConfigOverlays
): void {
  for (const entry of Object.values(connections)) {
    const typeName = entry.is;
    if (typeof typeName !== 'string') continue;
    const props = getConnectionProperties(typeName) ?? [];
    for (const prop of props) {
      if (prop.default === undefined) continue;
      if (entry[prop.name] !== undefined) continue;
      const v = resolveDefault(prop.default, overlays);
      if (v !== undefined) entry[prop.name] = v;
    }
  }
}

/**
 * Resolve a property `default` field. Literals pass through; single-key
 * reference-shaped objects are resolved through the overlays. Case 3:
 * an unresolved default is a hint, not a requirement — always silent drop.
 */
function resolveDefault(
  def: NonNullable<ConnectionPropertyDefinition['default']>,
  overlays: ConfigOverlays
): unknown {
  if (typeof def !== 'object') return def;
  const keys = Object.keys(def);
  if (keys.length !== 1) return undefined;
  const source = keys[0];
  const raw = (def as Record<string, unknown>)[source];
  const path = typeof raw === 'string' ? [raw] : raw;
  // The type says `raw` is `string | string[]`, but `default` comes from
  // registered backend definitions which are runtime-dynamic — a
  // malformed registration would blow up inside the overlay otherwise.
  if (!Array.isArray(path)) return undefined;
  const overlay = overlays[source];
  if (!overlay) return undefined;
  return overlay(path);
}
