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
  ConnectionPropertyDefinition,
  ConnectionPropertyType,
} from '../../connection/registry';

// =============================================================================
// Typed dictionary tree
// =============================================================================

/**
 * A compiled config node. The compiler produces a tree of these; the resolver
 * walks the tree against a ConfigOverlays dict and produces a plain POJO.
 */
export type ConfigNode = ConfigDict | ConfigLiteral | ConfigReference;

export interface ConfigDict {
  kind: 'dict';
  entries: Record<string, ConfigNode>;
}

/**
 * A leaf node holding a literal — primitives for typed slots, arbitrary
 * JSON for `json`-typed slots (no reference expansion, no type checking).
 */
export interface ConfigLiteral {
  kind: 'value';
  value: unknown;
}

export interface ConfigReference {
  kind: 'reference';
  /** Overlay name: "env", "config", "session", etc. */
  source: string;
  /** Path into the overlay. */
  path: string[];
}

// =============================================================================
// Section compilers
// =============================================================================

export type SectionCompiler = (
  value: unknown,
  log: LogMessage[]
) => ConfigNode | undefined;

const TOP_LEVEL_SECTIONS: Record<string, SectionCompiler> = {
  connections: compileConnections,
  manifestPath: compileManifestPath,
  virtualMap: compileVirtualMap,
  includeDefaultConnections: compileIncludeDefaultConnections,
};

const KNOWN_TOP_LEVEL_KEYS = new Set(Object.keys(TOP_LEVEL_SECTIONS));

// =============================================================================
// Entry point
// =============================================================================

/**
 * Compile a POJO into a typed dictionary tree, collecting validation warnings.
 * Does not throw — caller inspects `log` for issues.
 */
export function compileConfig(pojo: unknown): {
  compiled: ConfigDict;
  log: LogMessage[];
} {
  const log: LogMessage[] = [];
  const compiled: ConfigDict = {kind: 'dict', entries: {}};

  if (!isRecord(pojo)) {
    log.push({
      message: 'config is not a JSON object',
      severity: 'error',
      code: 'config-validation',
    });
    return {compiled, log};
  }

  for (const [key, value] of Object.entries(pojo)) {
    const compiler = TOP_LEVEL_SECTIONS[key];
    if (!compiler) {
      const suggestion = closestMatch(key, [...KNOWN_TOP_LEVEL_KEYS]);
      const hint = suggestion ? `. Did you mean "${suggestion}"?` : '';
      log.push(makeWarning(key, `unknown config key "${key}"${hint}`));
      continue;
    }
    const node = compiler(value, log);
    if (node !== undefined) {
      compiled.entries[key] = node;
    }
  }

  return {compiled, log};
}

// =============================================================================
// connections
// =============================================================================

function compileConnections(
  value: unknown,
  log: LogMessage[]
): ConfigNode | undefined {
  if (!isRecord(value)) {
    log.push(makeWarning('connections', '"connections" should be an object'));
    return undefined;
  }

  const registeredTypes = new Set(getRegisteredConnectionTypes());
  const connections: ConfigDict = {kind: 'dict', entries: {}};

  for (const [name, rawEntry] of Object.entries(value)) {
    const prefix = `connections.${name}`;

    if (!isRecord(rawEntry)) {
      log.push(makeWarning(prefix, 'should be an object'));
      continue;
    }

    const is = rawEntry['is'];
    if (is === undefined || is === null || is === '') {
      log.push(
        makeWarning(prefix, 'missing required "is" field (connection type)')
      );
      continue;
    }

    if (typeof is !== 'string') {
      log.push(makeWarning(`${prefix}.is`, '"is" should be a string'));
      continue;
    }

    if (!registeredTypes.has(is)) {
      const suggestion = closestMatch(is, [...registeredTypes]);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
      log.push(
        makeWarning(
          `${prefix}.is`,
          `unknown connection type "${is}".${hint} Available types: ${[...registeredTypes].join(', ')}`
        )
      );
      continue;
    }

    const entry = compileConnectionEntry(prefix, is, rawEntry, log);
    connections.entries[name] = entry;
  }

  return connections;
}

function compileConnectionEntry(
  prefix: string,
  typeName: string,
  rawEntry: Record<string, unknown>,
  log: LogMessage[]
): ConfigDict {
  const props = getConnectionProperties(typeName) ?? [];
  const propMap = new Map<string, ConnectionPropertyDefinition>(
    props.map(p => [p.name, p])
  );

  const entry: ConfigDict = {kind: 'dict', entries: {}};
  // Record the connection type as a plain value.
  entry.entries['is'] = {kind: 'value', value: typeName};

  for (const [key, value] of Object.entries(rawEntry)) {
    if (key === 'is') continue;

    const propDef = propMap.get(key);
    if (!propDef) {
      const suggestion = closestMatch(key, [...propMap.keys()]);
      const hint = suggestion ? `. Did you mean "${suggestion}"?` : '';
      log.push(
        makeWarning(
          `${prefix}.${key}`,
          `unknown property "${key}" for connection type "${typeName}"${hint}`
        )
      );
      continue;
    }

    const node = compileConnectionProperty(
      `${prefix}.${key}`,
      propDef,
      value,
      log
    );
    if (node !== undefined) {
      entry.entries[key] = node;
    }
  }

  return entry;
}

/**
 * Compile a single connection property value. At non-`json` property slots,
 * a single-key object whose value is a string or string[] is recognized as
 * an overlay reference. `json`-typed slots always pass through as literal
 * data — this is the security invariant that prevents reference injection
 * into structured config.
 */
function compileConnectionProperty(
  path: string,
  propDef: ConnectionPropertyDefinition,
  value: unknown,
  log: LogMessage[]
): ConfigNode | undefined {
  if (value === undefined || value === null) return undefined;

  if (propDef.type === 'json') {
    return {kind: 'value', value};
  }

  const ref = asReferenceShape(value);
  if (ref !== undefined) {
    if (propDef.requireLiteralString) {
      log.push(
        makeWarning(
          path,
          'must be a literal string and cannot use an overlay reference'
        )
      );
      return {kind: 'value', value};
    }
    return ref;
  }

  const typeError = checkValueType(value, propDef.type);
  if (typeError) {
    if (propDef.requireLiteralString) {
      log.push(
        makeWarning(
          path,
          `must be a literal string, got ${describeConfigValue(value)}`
        )
      );
      return {kind: 'value', value};
    }
    log.push(makeWarning(path, `${typeError} (expected ${propDef.type})`));
    return undefined;
  }
  return {kind: 'value', value};
}

// =============================================================================
// Pass-through sections
// =============================================================================

function compileManifestPath(
  value: unknown,
  log: LogMessage[]
): ConfigNode | undefined {
  if (typeof value !== 'string') {
    log.push(makeWarning('manifestPath', '"manifestPath" should be a string'));
    return undefined;
  }
  return {kind: 'value', value};
}

function compileVirtualMap(
  value: unknown,
  _log: LogMessage[]
): ConfigNode | undefined {
  // virtualMap is a literal dict slot — no reference expansion, even if
  // entries happen to look reference-shaped. The resolver will convert the
  // plain structure into the runtime `VirtualMap` representation.
  return {kind: 'value', value};
}

function compileIncludeDefaultConnections(
  value: unknown,
  _log: LogMessage[]
): ConfigNode | undefined {
  return {kind: 'value', value};
}

// =============================================================================
// Reference-shape detection
// =============================================================================

/**
 * Inspect a raw POJO value for the "overlay reference" shape: a single-key
 * object whose value is a string (scalar path) or string[] (nested path).
 * Returns a ConfigReference node if it matches, otherwise undefined.
 *
 * The single-key constraint distinguishes references from literal objects.
 * This is a runtime invariant — TypeScript can't express "exactly one key".
 */
function asReferenceShape(value: unknown): ConfigReference | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== 1) return undefined;
  const source = keys[0];
  const inner = (value as Record<string, unknown>)[source];
  if (typeof inner === 'string') {
    return {kind: 'reference', source, path: [inner]};
  }
  if (Array.isArray(inner) && inner.every(x => typeof x === 'string')) {
    return {kind: 'reference', source, path: inner as string[]};
  }
  return undefined;
}

// =============================================================================
// Helpers
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function makeWarning(path: string, message: string): LogMessage {
  return {
    message: `${path}: ${message}`,
    severity: 'warn',
    code: 'config-validation',
  };
}

function describeConfigValue(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkValueType(
  value: unknown,
  expectedType: ConnectionPropertyType
): string | undefined {
  switch (expectedType) {
    case 'number':
      if (typeof value !== 'number')
        return `should be a number, got ${typeof value}`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean')
        return `should be a boolean, got ${typeof value}`;
      break;
    case 'string':
    case 'password':
    case 'secret':
    case 'file':
    case 'text':
      if (typeof value !== 'string')
        return `should be a string, got ${typeof value}`;
      break;
    case 'json':
      break;
  }
  return undefined;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({length: m + 1}, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function closestMatch(input: string, candidates: string[]): string | undefined {
  if (candidates.length === 0) return undefined;
  let best = candidates[0];
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  const maxDist = Math.max(
    1,
    Math.floor(Math.max(input.length, best.length) / 3)
  );
  return bestDist <= maxDist ? best : undefined;
}
