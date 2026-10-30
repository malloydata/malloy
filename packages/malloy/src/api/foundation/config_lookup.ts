/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang/parse-log';
import {
  getConnectionProperties,
  getConnectionTypeDef,
  isConnectionConfigEntry,
} from '../../connection/registry';
import type {
  ConnectionConfigEntry,
  ConnectionPropertyDefinition,
  ManagedConnectionLookup,
} from '../../connection/registry';
import type {Connection, ConnectionConfig} from '../../connection/types';
import {checkValueType, makeWarning} from './config_compile';
import type {ConfigDict, ConfigNode, ConfigReference} from './config_compile';
import type {ConfigOverlays, OverlayRequest} from './config_overlays';

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
 *   2. Resolve each property. A reference calls its overlay, passing the
 *      property's type. A value of the wrong type is dropped with a
 *      warning, the same as a wrong-typed literal.
 *   3. Fill in any property whose definition carries a `default` and that
 *      the user didn't specify (including post-step-2 drops from unresolved
 *      inline references).
 *   4. Hand the resolved POJO to the registered factory.
 *   5. Cache the resulting `Connection` by name so subsequent lookups skip
 *      the whole pipeline.
 *
 * Warnings collected during steps 2–3 (unknown overlay source, a reference
 * value of the wrong type) are pushed into the shared `log` array — the
 * same array exposed as `MalloyConfig.log`.
 * The log grows the first time a connection is looked up; callers that
 * read `log` before any lookup won't see resolution warnings. That's an
 * intentional consequence of deferred resolution: we don't pay for
 * warnings on connections nobody asks about.
 */
export function buildManagedLookup(
  compiledConnections: Record<string, ConfigDict>,
  rawConnections: Record<string, ConnectionConfigEntry>,
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

      const resolved = await resolveCompiledEntry(
        connectionName,
        compiledEntry,
        overlays,
        log
      );

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

      const connection = await typeDef.factory(
        connConfig,
        rawConnections[connectionName]
      );
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

    async idle(): Promise<void> {
      // Cache is preserved — same Connection objects are reused so that
      // schema cache and other in-process state survive the idle.
      for (const conn of cache.values()) {
        await conn.idle();
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
  connectionName: string,
  entry: ConfigDict,
  overlays: ConfigOverlays,
  log: LogMessage[]
): Promise<ConnectionConfigEntry> {
  const isNode = entry.entries['is'];
  const typeName = isNode?.kind === 'value' ? isNode.value : undefined;
  const propDefs = new Map(
    (typeof typeName === 'string'
      ? (getConnectionProperties(typeName) ?? [])
      : []
    ).map(p => [p.name, p])
  );
  const resolved: Record<string, unknown> = {};
  for (const [key, node] of Object.entries(entry.entries)) {
    const value = await resolveProperty(
      connectionName,
      key,
      node,
      propDefs.get(key),
      overlays,
      log
    );
    if (value !== undefined) resolved[key] = value;
  }
  // The compileConnections pipeline guarantees every connection entry has
  // `is` set to a literal string, so this should always pass — but a
  // structured throw beats a downstream NPE if a compiler bug ever sneaks
  // through.
  if (!isConnectionConfigEntry(resolved)) {
    throw new Error(
      'Connection entry did not resolve to a valid {is: string, ...} dict'
    );
  }
  // Before defaults, so that a declared default can't quietly satisfy a
  // promise the user's own value failed to keep.
  requireAuthoredValues(connectionName, entry, resolved);
  await applyPropertyDefaults(resolved, overlays);
  return resolved;
}

/**
 * Enforce `mustHaveValue`: a property the user wrote must survive resolution.
 *
 * The compiled entry is the record of what was authored — a reference that
 * resolved to nothing, or a value that failed its type check, is gone from
 * `resolved` but still present here. Absence from both is fine; that's the
 * user declining to set the property, which is what `optional` already means.
 */
function requireAuthoredValues(
  connectionName: string,
  entry: ConfigDict,
  resolved: ConnectionConfigEntry
): void {
  for (const prop of getConnectionProperties(resolved.is) ?? []) {
    if (!prop.mustHaveValue) continue;
    if (entry.entries[prop.name] === undefined) continue;
    if (resolved[prop.name] !== undefined) continue;
    throw new Error(
      `Connection "${connectionName}" sets "${prop.name}", but no value ` +
        'arrived — an overlay reference that did not resolve, or a value that ' +
        'was rejected. Omitting the property is allowed; this one cannot fall ' +
        'back silently.'
    );
  }
}

/**
 * Return the value of one property, or undefined to leave it out. Literals
 * were type-checked when the config was compiled. A reference is checked
 * here: a value of the wrong type is left out with a warning, the same as a
 * bad literal. For a `mustHaveValue` property, `requireAuthoredValues` then
 * turns the missing value into an error.
 */
async function resolveProperty(
  connectionName: string,
  key: string,
  node: ConfigNode,
  propDef: ConnectionPropertyDefinition | undefined,
  overlays: ConfigOverlays,
  log: LogMessage[]
): Promise<unknown> {
  switch (node.kind) {
    case 'value':
      return node.value;
    case 'invalid':
      return undefined;
    case 'dict':
      throw new Error(
        `Connection "${connectionName}" property "${key}" compiled to a ` +
          'dictionary — likely a config compiler bug'
      );
    case 'reference':
      break;
  }
  if (propDef === undefined) {
    throw new Error(
      `Connection "${connectionName}" has a reference in "${key}", which is ` +
        'not a registered property of its type — likely a config compiler bug'
    );
  }
  const ref = node;
  const value = await resolveReference(ref, overlays, log, {
    type: propDef.type,
  });
  if (value === undefined) return undefined;
  const typeError = checkValueType(value, propDef.type);
  if (typeError === undefined) return value;
  // The warning shows the reference, not the value, which may be a secret.
  const written = ref.path.length === 1 ? ref.path[0] : ref.path;
  log.push(
    makeWarning(
      `connections.${connectionName}.${key}`,
      `${JSON.stringify({[ref.source]: written})} ${typeError} ` +
        `(expected ${propDef.type})`
    )
  );
  return undefined;
}

async function resolveReference(
  ref: ConfigReference,
  overlays: ConfigOverlays,
  log: LogMessage[],
  request: OverlayRequest
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
  return await overlay(ref.path, request);
}

/**
 * Fill in missing properties on a resolved entry from the registry's
 * declared defaults. Reference-shaped defaults (like DuckDB's
 * `workingDirectory: {config: 'rootDirectory'}`) resolve through the same
 * overlays as inline refs, and are type-checked the same way. A default
 * that doesn't resolve, or has the wrong type, is silently dropped — a
 * default is a hint, not a requirement (case 3).
 *
 * Interaction with inline references: if the user wrote a property as a
 * reference that resolved to `undefined` or to the wrong type, it was already
 * dropped before we see the entry. From here the property looks absent, and the
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
    const v = await resolveDefault(prop, overlays);
    if (v !== undefined) entry[prop.name] = v;
  }
}

async function resolveDefault(
  prop: ConnectionPropertyDefinition,
  overlays: ConfigOverlays
): Promise<unknown> {
  const def = prop.default;
  if (typeof def !== 'object') return def;
  const keys = Object.keys(def);
  if (keys.length !== 1) return undefined;
  const source = keys[0];
  const raw = (def as Record<string, unknown>)[source];
  const path = typeof raw === 'string' ? [raw] : raw;
  if (!Array.isArray(path)) return undefined;
  const overlay = overlays[source];
  if (!overlay) return undefined;
  const v = await overlay(path, {type: prop.type});
  return checkValueType(v, prop.type) === undefined ? v : undefined;
}
