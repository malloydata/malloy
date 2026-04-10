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
 */
export interface ResolvedConfig {
  connections: Record<string, ConnectionConfigEntry>;
  manifestPath?: string;
  virtualMap?: unknown;
  includeDefaults?: boolean;
}

/**
 * Walk a compiled tree against the overlay dict and produce a plain
 * resolved POJO. Applies `includeDefaults` if set in the compiled tree.
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
      case 'includeDefaults': {
        const v = resolveNode(node, overlays, log);
        if (typeof v === 'boolean') resolved.includeDefaults = v;
        break;
      }
    }
  }

  if (resolved.includeDefaults) {
    applyIncludeDefaults(resolved.connections, overlays);
  }

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
// includeDefaults
// =============================================================================

/**
 * For each registered connection type not already represented in
 * `connections`, add a default entry. Property defaults are either literals
 * (pass through) or reference-shaped (resolve through the overlays, silent
 * drop if unresolved).
 */
function applyIncludeDefaults(
  connections: Record<string, ConnectionConfigEntry>,
  overlays: ConfigOverlays
): void {
  const presentTypes = new Set<string>();
  for (const entry of Object.values(connections)) {
    if (typeof entry.is === 'string') presentTypes.add(entry.is);
  }
  for (const typeName of getRegisteredConnectionTypes()) {
    if (presentTypes.has(typeName)) continue;
    // Don't clobber a user-named connection that happens to share the
    // type name but points at a different backend.
    if (connections[typeName]) continue;
    const props = getConnectionProperties(typeName) ?? [];
    const entry: ConnectionConfigEntry = {is: typeName};
    for (const prop of props) {
      if (prop.default === undefined) continue;
      const v = resolveDefault(prop.default, overlays);
      if (v !== undefined) entry[prop.name] = v;
    }
    connections[typeName] = entry;
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
  const raw = (def as Record<string, string | string[]>)[source];
  const path = typeof raw === 'string' ? [raw] : raw;
  const overlay = overlays[source];
  if (!overlay) return undefined;
  return overlay(path);
}
