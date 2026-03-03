/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {URLReader} from '../../runtime_types';
import type {Connection, LookupConnection} from '../../connection/types';
import type {ConnectionConfigEntry} from '../../connection/registry';
import {
  createConnectionsFromConfig,
  isConnectionConfigEntry,
} from '../../connection/registry';
import type {
  BuildID,
  BuildManifest,
  BuildManifestEntry,
} from '../../model/malloy_types';

const DEFAULT_MANIFEST_PATH = 'MANIFESTS';
const MANIFEST_FILENAME = 'malloy-manifest.json';

/**
 * The parsed contents of a malloy-config.json file.
 */
export interface MalloyProjectConfig {
  connections?: Record<string, ConnectionConfigEntry>;
  manifestPath?: string;
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
 * Loads and holds a Malloy project configuration (connections + manifest).
 *
 * Two construction modes:
 *
 *   // From a URL — reads config + manifest via URLReader
 *   const config = new MalloyConfig(urlReader, configURL);
 *   await config.load();
 *
 *   // From text you already have
 *   const config = new MalloyConfig(configText);
 *
 *   // Either way, construct Runtime the same way
 *   const runtime = new Runtime({
 *     urlReader,
 *     connections: config.connections,
 *     buildManifest: config.manifest.buildManifest,
 *   });
 */
export class MalloyConfig {
  private readonly _urlReader?: URLReader;
  private readonly _configURL?: string;
  private _data: MalloyProjectConfig | undefined;
  private _connectionMap: Record<string, ConnectionConfigEntry> | undefined;
  private readonly _manifest: Manifest;

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
  }

  /**
   * A LookupConnection built from the current connectionMap via the
   * connection type registry. Each access creates a fresh snapshot —
   * changing connectionMap after this does not affect previously-returned
   * LookupConnections.
   */
  get connections(): LookupConnection<Connection> {
    if (!this._connectionMap) {
      throw new Error('Config not loaded. Call load() or loadConfig() first.');
    }
    return createConnectionsFromConfig({connections: this._connectionMap});
  }

  /**
   * The Manifest object. Always exists, may be empty if not yet loaded.
   */
  get manifest(): Manifest {
    return this._manifest;
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
  return {...parsed, connections};
}
