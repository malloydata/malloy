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
 * For each registered connection type T, add a bare `{is: T}` compiled
 * entry named T unless one already exists under that name. Only runs when
 * the POJO sets `includeDefaultConnections: true`. Property values
 * (including reference-shaped defaults like DuckDB's
 * `{config: 'rootDirectory'}`) are filled in later by the async lookup
 * resolver, not here.
 *
 * The skip is purely name-based: the `is` of a user entry is irrelevant.
 * `{duckdb: {is: 'postgres'}}` shadows the duckdb phantom (slot taken);
 * `{dankdb: {is: 'duckdb'}}` does not (slot `duckdb` is still free, and
 * both end up reachable). This name-only rule is the contract hosts rely
 * on — e.g. the VS Code connections sidebar advertises defaults by name,
 * and the runtime must resolve them under those same names.
 *
 * Mutates `compiledConnections` in place.
 */
function fabricateMissingConnections(
  compiledConnections: Record<string, ConfigDict>
): void {
  for (const typeName of getRegisteredConnectionTypes()) {
    if (compiledConnections[typeName]) continue;
    compiledConnections[typeName] = {
      kind: 'dict',
      entries: {
        is: {kind: 'value', value: typeName},
      },
    };
  }
}
