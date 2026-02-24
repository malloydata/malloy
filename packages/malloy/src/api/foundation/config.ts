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
 * The internal BuildManifest object is stable: load() and update() mutate
 * the same object, so any reference obtained via `buildManifest` stays current.
 */
export class Manifest {
  private readonly _urlReader?: URLReader;
  private readonly _data: BuildManifest = {};
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
    // Clear existing entries and touched set
    for (const key of Object.keys(this._data)) {
      delete this._data[key];
    }
    this._touched.clear();

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

    const loaded: BuildManifest = JSON.parse(contents);
    Object.assign(this._data, loaded);
  }

  /**
   * Load manifest data from a JSON string.
   * Replaces any existing data.
   */
  loadText(jsonText: string): void {
    for (const key of Object.keys(this._data)) {
      delete this._data[key];
    }
    this._touched.clear();
    const loaded: BuildManifest = JSON.parse(jsonText);
    Object.assign(this._data, loaded);
  }

  /**
   * The live BuildManifest. This is a stable reference — load() and update()
   * mutate the same object, so passing this to a Runtime means the Runtime
   * always sees current data.
   */
  get buildManifest(): BuildManifest {
    return this._data;
  }

  /**
   * Add or replace a manifest entry. Also marks it as touched.
   */
  update(buildId: BuildID, entry: BuildManifestEntry): void {
    this._data[buildId] = entry;
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
   * Returns only entries that were update()d or touch()ed.
   * This is the manifest a builder should write — it reflects
   * exactly what the current build references.
   */
  get activeEntries(): BuildManifest {
    const result: BuildManifest = {};
    for (const id of this._touched) {
      if (this._data[id]) {
        result[id] = this._data[id];
      }
    }
    return result;
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
