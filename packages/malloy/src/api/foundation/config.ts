/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {URLReader} from '../../runtime_types';
import type {Connection, LookupConnection} from '../../connection/types';
import type {
  ConnectionConfigEntry,
  ManagedConnectionLookup,
} from '../../connection/registry';
import {
  createConnectionsFromConfig,
  getConnectionProperties,
  getRegisteredConnectionTypes,
  isConnectionConfigEntry,
  isValueRef,
} from '../../connection/registry';
import type {LogMessage} from '../../lang/parse-log';
import type {
  BuildID,
  BuildManifest,
  BuildManifestEntry,
  VirtualMap,
} from '../../model/malloy_types';

const DEFAULT_MANIFEST_PATH = 'MANIFESTS';
const MANIFEST_FILENAME = 'malloy-manifest.json';

/**
 * The parsed contents of a malloy-config.json file.
 */
export interface MalloyProjectConfig {
  connections?: Record<string, ConnectionConfigEntry>;
  manifestPath?: string;
  virtualMap?: VirtualMap;
}

/**
 * In-memory manifest store. Reads, updates, and serializes manifest data.
 *
 * Always valid — starts empty, call load() to populate from a file.
 * The BuildManifest object returned by `buildManifest` is stable: load()
 * and update() mutate the same entries object, so any reference obtained
 * via `buildManifest` stays current without re-assignment.
 *
 * The `strict` flag controls what happens when a persist source's BuildID
 * is not found in the manifest. When strict, the compiler throws an error
 * instead of falling through to inline SQL. The flag is loaded from the
 * manifest file and can be overridden by the application before creating
 * a Runtime.
 */
export class Manifest {
  private readonly _urlReader?: URLReader;
  private readonly _manifest: BuildManifest = {entries: {}, strict: false};
  private readonly _touched = new Set<BuildID>();

  constructor(urlReader?: URLReader) {
    this._urlReader = urlReader;
  }

  /**
   * Load manifest data from a manifest root directory.
   * Reads `<manifestRoot>/malloy-manifest.json` via the URLReader.
   * Replaces any existing data. If the file doesn't exist or no URLReader
   * is available, clears to empty.
   */
  async load(manifestRoot: URL): Promise<void> {
    this._clearEntries();
    this._touched.clear();
    this._manifest.strict = false;

    if (!this._urlReader) return;

    const dir = manifestRoot.toString().endsWith('/')
      ? manifestRoot.toString()
      : manifestRoot.toString() + '/';
    const manifestURL = new URL(MANIFEST_FILENAME, dir);

    let contents: string;
    try {
      const result = await this._urlReader.readURL(manifestURL);
      contents = typeof result === 'string' ? result : result.contents;
    } catch {
      // No manifest file — stay empty
      return;
    }

    this._loadParsed(JSON.parse(contents));
  }

  /**
   * Load manifest data from a JSON string.
   * Replaces any existing data.
   */
  loadText(jsonText: string): void {
    this._clearEntries();
    this._touched.clear();
    this._manifest.strict = false;
    this._loadParsed(JSON.parse(jsonText));
  }

  /**
   * The live BuildManifest. This is a stable reference — load() and update()
   * mutate the same object, so passing this to a Runtime means the Runtime
   * always sees current data including the strict flag.
   */
  get buildManifest(): BuildManifest {
    return this._manifest;
  }

  /**
   * Whether missing manifest entries should cause errors.
   * Loaded from the manifest file; can be overridden by the application.
   */
  get strict(): boolean {
    return this._manifest.strict ?? false;
  }

  set strict(value: boolean) {
    this._manifest.strict = value;
  }

  /**
   * Add or replace a manifest entry. Also marks it as touched.
   */
  update(buildId: BuildID, entry: BuildManifestEntry): void {
    this._manifest.entries[buildId] = entry;
    this._touched.add(buildId);
  }

  /**
   * Mark an existing entry as active without changing it.
   * Use this for entries that already exist and don't need rebuilding.
   */
  touch(buildId: BuildID): void {
    this._touched.add(buildId);
  }

  /**
   * Returns a BuildManifest with only entries that were update()d or touch()ed.
   * This is the manifest a builder should write — it reflects exactly what the
   * current build references. Preserves the strict flag.
   */
  get activeEntries(): BuildManifest {
    const entries: Record<BuildID, BuildManifestEntry> = {};
    for (const id of this._touched) {
      if (this._manifest.entries[id]) {
        entries[id] = this._manifest.entries[id];
      }
    }
    return {entries, strict: this._manifest.strict};
  }

  private _clearEntries(): void {
    for (const key of Object.keys(this._manifest.entries)) {
      delete this._manifest.entries[key];
    }
  }

  private _loadParsed(parsed: Record<string, unknown>): void {
    if (typeof parsed['strict'] === 'boolean') {
      this._manifest.strict = parsed['strict'];
    }
    // New format: {entries: {...}, strict?: boolean}
    // Old format: {buildId: {tableName}, ...} (flat record, no "entries" key)
    const rawEntries = isRecord(parsed['entries']) ? parsed['entries'] : parsed;
    for (const [key, val] of Object.entries(rawEntries)) {
      if (key !== 'strict' && isBuildManifestEntry(val)) {
        this._manifest.entries[key] = val;
      }
    }
  }
}

/**
 * Loads and holds a Malloy project configuration (connections + manifest +
 * virtualMap). Pass directly to Runtime — everything flows automatically.
 *
 *   // From a URL — reads config + manifest via URLReader
 *   const config = new MalloyConfig(urlReader, configURL);
 *   await config.load();
 *
 *   // From text you already have
 *   const config = new MalloyConfig(configText);
 *
 *   // Either way, pass to Runtime — connections, buildManifest, virtualMap
 *   // all come from the config. No manual wiring needed.
 *   const runtime = new Runtime({config, urlReader});
 *
 * To override specific fields, mutate the config before passing:
 *   config.connectionMap = myCustomConnections;
 */
export class MalloyConfig {
  private readonly _urlReader?: URLReader;
  private readonly _configURL?: string;
  private _data: MalloyProjectConfig | undefined;
  private _log: LogMessage[] = [];
  private _connectionMap: Record<string, ConnectionConfigEntry> | undefined;
  private readonly _manifest: Manifest;
  private _managedLookup: ManagedConnectionLookup | undefined;
  private _connectionLookupOverride: LookupConnection<Connection> | undefined;
  private _onConnectionCreated:
    | ((name: string, connection: Connection) => void)
    | undefined;

  constructor(configText: string);
  constructor(urlReader: URLReader, configURL: string);
  constructor(urlReaderOrText: URLReader | string, configURL?: string) {
    if (typeof urlReaderOrText === 'string') {
      const {config, log} = parseConfigText(urlReaderOrText);
      this._data = config;
      this._log = log;
      this._connectionMap = this._data.connections
        ? {...this._data.connections}
        : undefined;
      this._manifest = new Manifest();
    } else {
      this._urlReader = urlReaderOrText;
      this._configURL = configURL;
      this._manifest = new Manifest(urlReaderOrText);
    }
  }

  /**
   * Load everything: parse config file, then load the default manifest.
   * No-op if created from text.
   */
  async load(): Promise<void> {
    await this.loadConfig();
    if (this._configURL) {
      const manifestPath = this._data?.manifestPath ?? DEFAULT_MANIFEST_PATH;
      const manifestRoot = new URL(manifestPath, this._configURL);
      await this._manifest.load(manifestRoot);
    }
  }

  /**
   * Load only the config file. Does not load the manifest.
   * No-op if created from text.
   */
  async loadConfig(): Promise<void> {
    if (!this._urlReader || !this._configURL) return;
    const result = await this._urlReader.readURL(new URL(this._configURL));
    const contents = typeof result === 'string' ? result : result.contents;
    const parsed = parseConfigText(contents);
    this._data = parsed.config;
    this._log = parsed.log;
    this._connectionMap = this._data.connections
      ? {...this._data.connections}
      : undefined;
  }

  /**
   * The parsed config data. Undefined if created from URL and not yet loaded.
   */
  get data(): MalloyProjectConfig | undefined {
    return this._data;
  }

  /**
   * The active connection entries. Set this to override which connections
   * are used before constructing a Runtime.
   */
  get connectionMap(): Record<string, ConnectionConfigEntry> | undefined {
    return this._connectionMap;
  }

  set connectionMap(map: Record<string, ConnectionConfigEntry>) {
    this._connectionMap = map;
    // Invalidate cached managed lookup — new map means new connections
    this._managedLookup = undefined;
  }

  /**
   * A LookupConnection built from the current connectionMap via the
   * connection type registry. The result is cached — repeated access
   * returns the same object (and the same underlying connections).
   *
   * If `connectionLookup` has been set, returns the override instead.
   *
   * Changing `connectionMap` invalidates the cache; the next access
   * creates a fresh ManagedConnectionLookup.
   */
  get connections(): LookupConnection<Connection> {
    if (this._connectionLookupOverride) {
      return this._connectionLookupOverride;
    }
    if (!this._connectionMap) {
      throw new Error('Config not loaded. Call load() or loadConfig() first.');
    }
    if (!this._managedLookup) {
      this._managedLookup = createConnectionsFromConfig(
        {connections: this._connectionMap},
        this._onConnectionCreated
      );
    }
    return this._managedLookup;
  }

  /**
   * Override the connection lookup entirely. When set, the `connections`
   * getter returns this instead of building from `connectionMap`.
   * Use this when you need to merge config connections with other sources.
   */
  get connectionLookup(): LookupConnection<Connection> | undefined {
    return this._connectionLookupOverride;
  }

  set connectionLookup(lookup: LookupConnection<Connection> | undefined) {
    this._connectionLookupOverride = lookup;
  }

  /**
   * Callback invoked once per connection immediately after factory creation.
   * Use for post-creation setup (e.g., registering WASM file handlers).
   * Must be set before the first connection is looked up.
   */
  set onConnectionCreated(
    cb: ((name: string, connection: Connection) => void) | undefined
  ) {
    this._onConnectionCreated = cb;
  }

  /**
   * Close all connections created by this config's internal managed lookup.
   * Does nothing if connections were overridden via `connectionLookup`.
   */
  async close(): Promise<void> {
    if (this._managedLookup) {
      await this._managedLookup.close();
      this._managedLookup = undefined;
    }
  }

  /**
   * The Manifest object. Always exists, may be empty if not yet loaded.
   */
  get manifest(): Manifest {
    return this._manifest;
  }

  /**
   * The VirtualMap parsed from config, if present.
   */
  get virtualMap(): VirtualMap | undefined {
    return this._data?.virtualMap;
  }

  /**
   * Errors and warnings from parsing and validating the config.
   * Includes JSON parse errors (severity 'error') and schema validation
   * warnings (severity 'warn') such as unknown keys, unknown connection
   * types, wrong value types, and missing environment variables.
   */
  get log(): LogMessage[] {
    return this._log;
  }
}

interface ParseResult {
  config: MalloyProjectConfig;
  log: LogMessage[];
}

/**
 * Parse a config JSON string into a MalloyProjectConfig.
 * Invalid connection entries (missing `is`) are silently dropped.
 * Returns the processed config and validation log.
 */
function parseConfigText(jsonText: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      config: {},
      log: [
        {
          message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          severity: 'error',
          code: 'config-validation',
        },
      ],
    };
  }

  if (!isRecord(parsed)) {
    return {
      config: {},
      log: [
        {
          message: 'config is not a JSON object',
          severity: 'error',
          code: 'config-validation',
        },
      ],
    };
  }

  const rawConnections = parsed['connections'];
  const connectionEntries = Object.entries(
    isRecord(rawConnections) ? rawConnections : {}
  ).filter((entry): entry is [string, ConnectionConfigEntry] =>
    isConnectionConfigEntry(entry[1])
  );
  const connections: Record<string, ConnectionConfigEntry> =
    Object.fromEntries(connectionEntries);
  const result: MalloyProjectConfig = {...parsed, connections};
  const virtualMap = parsed['virtualMap'];
  if (
    virtualMap &&
    typeof virtualMap === 'object' &&
    !Array.isArray(virtualMap)
  ) {
    const outer = new Map<string, Map<string, string>>();
    for (const [connName, inner] of Object.entries(virtualMap)) {
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        const innerMap = new Map<string, string>();
        for (const [virtualName, tablePath] of Object.entries(
          inner as Record<string, unknown>
        )) {
          if (typeof tablePath === 'string') {
            innerMap.set(virtualName, tablePath);
          }
        }
        outer.set(connName, innerMap);
      }
    }
    result.virtualMap = outer;
  }
  return {config: result, log: validateConfig(parsed)};
}

const KNOWN_TOP_LEVEL_KEYS = new Set([
  'connections',
  'manifestPath',
  'virtualMap',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBuildManifestEntry(value: unknown): value is BuildManifestEntry {
  return isRecord(value) && typeof value['tableName'] === 'string';
}

function makeWarning(path: string, message: string): LogMessage {
  return {
    message: `${path}: ${message}`,
    severity: 'warn',
    code: 'config-validation',
  };
}

/**
 * Validate a parsed config object against the connection type registry.
 * Returns LogMessage[] — does not throw.
 */
function validateConfig(data: Record<string, unknown>): LogMessage[] {
  const log: LogMessage[] = [];

  for (const key of Object.keys(data)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      const suggestion = closestMatch(key, [...KNOWN_TOP_LEVEL_KEYS]);
      const hint = suggestion ? `. Did you mean "${suggestion}"?` : '';
      log.push(makeWarning(key, `unknown config key "${key}"${hint}`));
    }
  }

  if (
    data['manifestPath'] !== undefined &&
    typeof data['manifestPath'] !== 'string'
  ) {
    log.push(makeWarning('manifestPath', '"manifestPath" should be a string'));
  }

  const connections = data['connections'];
  if (connections === undefined) return log;

  if (!isRecord(connections)) {
    log.push(makeWarning('connections', '"connections" should be an object'));
    return log;
  }

  const registeredTypes = new Set(getRegisteredConnectionTypes());

  for (const [name, rawEntry] of Object.entries(connections)) {
    const prefix = `connections.${name}`;

    if (!isRecord(rawEntry)) {
      log.push(makeWarning(prefix, 'should be an object'));
      continue;
    }

    if (!rawEntry['is']) {
      log.push(
        makeWarning(prefix, 'missing required "is" field (connection type)')
      );
      continue;
    }

    if (typeof rawEntry['is'] !== 'string') {
      log.push(makeWarning(`${prefix}.is`, '"is" should be a string'));
      continue;
    }

    const typeName = rawEntry['is'];

    if (!registeredTypes.has(typeName)) {
      const suggestion = closestMatch(typeName, [...registeredTypes]);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
      log.push(
        makeWarning(
          `${prefix}.is`,
          `unknown connection type "${typeName}".${hint} Available types: ${[...registeredTypes].join(', ')}`
        )
      );
      continue;
    }

    const props = getConnectionProperties(typeName);
    if (!props) continue;

    const knownProps = new Map(props.map(p => [p.name, p]));

    for (const [key, value] of Object.entries(rawEntry)) {
      if (key === 'is') continue;

      const propDef = knownProps.get(key);
      if (!propDef) {
        const suggestion = closestMatch(key, [...knownProps.keys()]);
        const hint = suggestion ? `. Did you mean "${suggestion}"?` : '';
        log.push(
          makeWarning(
            `${prefix}.${key}`,
            `unknown property "${key}" for connection type "${typeName}"${hint}`
          )
        );
        continue;
      }

      // For env var references on non-json props, check the variable exists.
      if (propDef.type !== 'json' && isValueRef(value)) {
        const env = value.env;
        if (process.env[env] === undefined) {
          log.push(
            makeWarning(
              `${prefix}.${key}`,
              `environment variable "${env}" is not set`
            )
          );
        }
        continue;
      }

      const typeError = checkValueType(value, propDef.type);
      if (typeError) {
        log.push(
          makeWarning(
            `${prefix}.${key}`,
            `${typeError} (expected ${propDef.type})`
          )
        );
      }
    }
  }

  return log;
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

function checkValueType(
  value: unknown,
  expectedType: string
): string | undefined {
  if (value === undefined || value === null) return undefined;

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
