/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang/parse-log';
import {getRegisteredConnectionTypes} from '../../connection/registry';
import type {ConfigDict} from './config_compile';

/**
 * The synchronous slice of config preparation. What the `MalloyConfig`
 * constructor needs *before* any overlay IO happens:
 *
 *   - `compiledConnections` — per-connection compiled subtrees. References
 *     inside these are resolved lazily at `lookupConnection` time, not here.
 *     Fabricated bare `{is: typeName}` entries are included when the POJO
 *     opts in via `includeDefaultConnections`.
 *   - `manifestPath` — raw string (never a reference; section compiler only
 *     produces value nodes).
 *   - `virtualMap` — raw literal POJO (same — virtualMap is a literal slot).
 *
 * `includeDefaultConnections` is an input directive, not an output value —
 * fabrication has already happened by the time this returns.
 */
export interface PreparedConfig {
  compiledConnections: Record<string, ConfigDict>;
  manifestPath?: string;
  virtualMap?: unknown;
}

/**
 * Synchronous top-level walk of a compiled config tree. Extracts the
 * non-connection sections (which only contain literals — see the section
 * compilers) and hands back the compiled connection subtrees untouched.
 *
 * Reference resolution for connection properties is *not* done here. It is
 * deferred until `lookupConnection` is called, at which point the async
 * walker in `config_lookup.ts` can `await` overlays that do IO (secret
 * stores, session fetches, etc.). This keeps `MalloyConfig` construction
 * synchronous and zero-IO.
 *
 * Fabrication of bare `{is: typeName}` compiled entries for registered
 * backends not otherwise represented happens here when the config opts in
 * via `includeDefaultConnections`. Property defaults are filled in at
 * lookup time alongside reference resolution.
 */
export function prepareConfig(
  compiled: ConfigDict,
  _log: LogMessage[]
): PreparedConfig {
  let compiledConnections: Record<string, ConfigDict> = {};
  let manifestPath: string | undefined;
  let virtualMap: unknown;
  let includeDefaultConnections = false;

  for (const [key, node] of Object.entries(compiled.entries)) {
    switch (key) {
      case 'connections': {
        if (node.kind !== 'dict') break;
        compiledConnections = extractCompiledConnections(node);
        break;
      }
      case 'manifestPath': {
        if (node.kind === 'value' && typeof node.value === 'string') {
          manifestPath = node.value;
        }
        break;
      }
      case 'virtualMap': {
        // virtualMap is a literal dict slot — compileVirtualMap never
        // produces a reference node. MalloyConfig converts the raw POJO
        // into its runtime Map-of-Maps representation.
        if (node.kind === 'value') virtualMap = node.value;
        break;
      }
      case 'includeDefaultConnections': {
        if (node.kind === 'value' && typeof node.value === 'boolean') {
          includeDefaultConnections = node.value;
        }
        break;
      }
    }
  }

  if (includeDefaultConnections) {
    fabricateMissingConnections(compiledConnections);
  }

  return {compiledConnections, manifestPath, virtualMap};
}

/**
 * Pull each well-formed compiled connection entry out of the `connections`
 * subtree. Entries are already validated by `compileConnections` — anything
 * shaped wrong was dropped or reported during compile. We defensively skip
 * non-dict children here anyway.
 */
function extractCompiledConnections(
  node: ConfigDict
): Record<string, ConfigDict> {
  const out: Record<string, ConfigDict> = {};
  for (const [name, child] of Object.entries(node.entries)) {
    if (child.kind === 'dict') out[name] = child;
  }
  return out;
}

/**
 * Add a bare `{is: typeName}` compiled entry for each registered connection
 * type not already represented in `compiledConnections`. Only runs when the
 * POJO sets `includeDefaultConnections: true`. Property values (including
 * reference-shaped defaults like DuckDB's `{config: 'rootDirectory'}`) are
 * *not* filled in here — that is the job of the async lookup resolver.
 *
 * Skip rules:
 *   - Type already in use: some existing entry has `is: typeName`.
 *   - Name already taken: some existing entry is *named* `typeName`, even
 *     if its `is` points elsewhere. This protects a user who writes
 *     `{duckdb: {is: 'postgres', ...}}` — naming an entry after a type but
 *     pointing at a different backend — from being clobbered.
 *
 * Mutates `compiledConnections` in place.
 */
function fabricateMissingConnections(
  compiledConnections: Record<string, ConfigDict>
): void {
  const presentTypes = new Set<string>();
  for (const entry of Object.values(compiledConnections)) {
    const isNode = entry.entries['is'];
    if (isNode?.kind === 'value' && typeof isNode.value === 'string') {
      presentTypes.add(isNode.value);
    }
  }
  for (const typeName of getRegisteredConnectionTypes()) {
    if (presentTypes.has(typeName)) continue;
    if (compiledConnections[typeName]) continue;
    compiledConnections[typeName] = {
      kind: 'dict',
      entries: {
        is: {kind: 'value', value: typeName},
      },
    };
  }
}
