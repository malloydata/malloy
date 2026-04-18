/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang/parse-log';
import {
  getConnectionProperties,
  getConnectionTypeDef,
  validateConnectionConfigProperties,
} from '../../connection/registry';
import type {
  ConnectionConfigEntry,
  ConnectionPropertyDefinition,
  ManagedConnectionLookup,
} from '../../connection/registry';
import type {Connection, ConnectionConfig} from '../../connection/types';
import type {ConfigDict, ConfigNode, ConfigReference} from './config_compile';
import type {ConfigOverlays} from './config_overlays';

/**
 * Build the `ManagedConnectionLookup` a `MalloyConfig` hands to Runtime.
 *
 * Reference resolution and property-default application run *per lookup*,
 * asynchronously. This is the point where overlays are actually called —
 * which means secret stores, session readers, and any other IO-backed
 * overlay has a natural async seam to live in. Construction of the
 * `MalloyConfig` stays synchronous and zero-IO.
 *
 * Lookup flow for a connection name:
 *   1. Find its compiled entry. Throw if the name is unknown.
 *   2. Walk the entry tree, `await`-ing each overlay reference.
 *   3. Fill in any property whose definition carries a `default` and that
 *      the user didn't specify (including post-step-2 drops from unresolved
 *      inline references).
 *   4. Hand the resolved POJO to the registered factory.
 *   5. Cache the resulting `Connection` by name so subsequent lookups skip
 *      the whole pipeline.
 *
 * Warnings collected during steps 2–3 (unknown overlay source) are pushed
 * into the shared `log` array — same array exposed as `MalloyConfig.log`.
 * The log grows the first time a connection is looked up; callers that
 * read `log` before any lookup won't see resolution warnings. That's an
 * intentional consequence of deferred resolution: we don't pay for
 * warnings on connections nobody asks about.
 */
export function buildManagedLookup(
  compiledConnections: Record<string, ConfigDict>,
  overlays: ConfigOverlays,
  log: LogMessage[]
): ManagedConnectionLookup {
  const entries = Object.entries(compiledConnections);
  const firstConnectionName = entries.length > 0 ? entries[0][0] : undefined;

  const cache = new Map<string, Connection>();

  return {
    async lookupConnection(connectionName?: string): Promise<Connection> {
      if (connectionName === undefined) {
        connectionName = firstConnectionName;
      }
      if (connectionName === undefined) {
        throw new Error('No connections defined in config');
      }

      const cached = cache.get(connectionName);
      if (cached) return cached;

      const compiledEntry = compiledConnections[connectionName];
      if (!compiledEntry) {
        throw new Error(
          `No connection named "${connectionName}" found in config`
        );
      }

      const resolved = await resolveCompiledEntry(compiledEntry, overlays, log);

      // compileConnections guarantees `is` is present and a string-valued
      // literal node — resolveCompiledEntry preserves it. Defensive check
      // in case a compiler bug sneaks through.
      if (typeof resolved['is'] !== 'string') {
        throw new Error(
          `Connection "${connectionName}" is missing a valid "is" field`
        );
      }

      const typeDef = getConnectionTypeDef(resolved.is);
      if (!typeDef) {
        throw new Error(
          `No registered connection type "${resolved.is}" for connection "${connectionName}". ` +
            'Did you forget to import the connection package?'
        );
      }

      const connConfig: ConnectionConfig = {name: connectionName};
      for (const [key, value] of Object.entries(resolved)) {
        if (key === 'is') continue;
        if (value !== undefined && value !== null) {
          connConfig[key] = value as ConnectionConfig[string];
        }
      }

      validateConnectionConfigProperties(
        connectionName,
        resolved.is,
        connConfig
      );
      const connection = await typeDef.factory(connConfig);
      cache.set(connectionName, connection);
      return connection;
    },

    async close(): Promise<void> {
      const connections = [...cache.values()];
      cache.clear();
      for (const conn of connections) {
        await conn.close();
      }
    },
  };
}

/**
 * Async walk of a single connection's compiled entry against the overlays,
 * followed by property-default application. Returns the plain POJO that
 * gets handed to the factory.
 */
async function resolveCompiledEntry(
  entry: ConfigDict,
  overlays: ConfigOverlays,
  log: LogMessage[]
): Promise<ConnectionConfigEntry> {
  const resolved = (await resolveNode(entry, overlays, log)) as Record<
    string,
    unknown
  >;
  await applyPropertyDefaults(resolved, overlays);
  return resolved as ConnectionConfigEntry;
}

/**
 * Walk a node, awaiting any overlay calls. References that fail to resolve
 * return `undefined`; the parent dict walker drops the corresponding
 * property. Unknown overlay sources push a warning to the log (case 1);
 * overlays returning undefined are silently dropped (case 2).
 */
async function resolveNode(
  node: ConfigNode,
  overlays: ConfigOverlays,
  log: LogMessage[]
): Promise<unknown> {
  switch (node.kind) {
    case 'value':
      return node.value;
    case 'reference':
      return resolveReference(node, overlays, log);
    case 'dict': {
      const out: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(node.entries)) {
        const r = await resolveNode(child, overlays, log);
        if (r !== undefined) out[k] = r;
      }
      return out;
    }
  }
}

async function resolveReference(
  ref: ConfigReference,
  overlays: ConfigOverlays,
  log: LogMessage[]
): Promise<unknown> {
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
  // Case 2: overlay returns undefined (sync or via a Promise) — silent drop.
  // `await` tolerates both sync and Promise return types.
  return await overlay(ref.path);
}

/**
 * Fill in missing properties on a resolved entry from the registry's
 * declared defaults. Reference-shaped defaults (like DuckDB's
 * `workingDirectory: {config: 'rootDirectory'}`) resolve through the same
 * overlays as inline refs. Unresolved defaults are silently dropped — a
 * default is a hint, not a requirement (case 3).
 *
 * Interaction with inline references: if the user wrote a property as a
 * reference that resolved to `undefined`, `resolveNode` already dropped it
 * before we see the entry. From here the property looks absent, and the
 * default applies — effectively "try the inline ref, else fall back to the
 * default." Almost always what users want.
 */
async function applyPropertyDefaults(
  entry: Record<string, unknown>,
  overlays: ConfigOverlays
): Promise<void> {
  const typeName = entry['is'];
  if (typeof typeName !== 'string') return;
  const props = getConnectionProperties(typeName) ?? [];
  for (const prop of props) {
    if (prop.default === undefined) continue;
    if (entry[prop.name] !== undefined) continue;
    const v = await resolveDefault(prop.default, overlays);
    if (v !== undefined) entry[prop.name] = v;
  }
}

async function resolveDefault(
  def: NonNullable<ConnectionPropertyDefinition['default']>,
  overlays: ConfigOverlays
): Promise<unknown> {
  if (typeof def !== 'object') return def;
  const keys = Object.keys(def);
  if (keys.length !== 1) return undefined;
  const source = keys[0];
  const raw = (def as Record<string, unknown>)[source];
  const path = typeof raw === 'string' ? [raw] : raw;
  if (!Array.isArray(path)) return undefined;
  const overlay = overlays[source];
  if (!overlay) return undefined;
  return await overlay(path);
}
