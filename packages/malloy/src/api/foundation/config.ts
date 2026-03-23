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
  isConnectionConfigEntry,
} from '../../connection/registry';
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
    let entries: Record<string, BuildManifestEntry>;
    if (parsed['entries'] && typeof parsed['entries'] === 'object') {
      entries = parsed['entries'] as Record<string, BuildManifestEntry>;
    } else {
      // Treat as old flat-record format: every key with a tableName is an entry
      entries = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (
          key !== 'strict' &&
          val &&
          typeof val === 'object' &&
          'tableName' in val
        ) {
          entries[key] = val as BuildManifestEntry;
        }
      }
    }
    Object.assign(this._manifest.entries, entries);
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
      this._data = parseConfigText(urlReaderOrText);
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
    this._data = parseConfigText(contents);
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
}

/**
 * Parse a config JSON string into a MalloyProjectConfig.
 * Invalid connection entries (missing `is`) are silently dropped.
 */
function parseConfigText(jsonText: string): MalloyProjectConfig {
  const parsed = JSON.parse(jsonText);
  const connections = Object.fromEntries(
    Object.entries(parsed.connections ?? {}).filter(([, v]) =>
      isConnectionConfigEntry(v)
    )
  );
  const result: MalloyProjectConfig = {...parsed, connections};
  if (
    parsed.virtualMap &&
    typeof parsed.virtualMap === 'object' &&
    !Array.isArray(parsed.virtualMap)
  ) {
    const outer = new Map<string, Map<string, string>>();
    for (const [connName, inner] of Object.entries(parsed.virtualMap)) {
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
  return result;
}
