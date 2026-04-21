/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection, LookupConnection} from '../../connection/types';
import type {ManagedConnectionLookup} from '../../connection/registry';
import type {LogMessage} from '../../lang/parse-log';
import type {
  BuildID,
  BuildManifest,
  BuildManifestEntry,
  VirtualMap,
} from '../../model/malloy_types';
import {compileConfig} from './config_compile';
import {prepareConfig} from './config_resolve';
import {buildManagedLookup} from './config_lookup';
import {defaultConfigOverlays} from './config_overlays';
import type {ConfigOverlays} from './config_overlays';

/**
 * In-memory manifest store. Reads, updates, and serializes manifest data.
 *
 * Always valid — starts empty. Populate by calling `loadText(jsonText)` with
 * the manifest file contents, which the caller reads themselves (typically
 * through a `URLReader` they already have). The `Manifest` class deliberately
 * does no IO — it exists so that applications that want to build or mutate
 * manifest state have a typed handle with a stable `buildManifest` reference.
 *
 * The `BuildManifest` returned by `buildManifest` is stable: `loadText()` and
 * `update()` mutate the same entries object, so any reference obtained via
 * `buildManifest` stays current without re-assignment.
 *
 * The `strict` flag controls what happens when a persist source's BuildID is
 * not found in the manifest. When strict, the compiler throws an error
 * instead of falling through to inline SQL. Loaded from the manifest file by
 * `loadText()`; applications may override it at any time.
 */
export class Manifest {
  private readonly _manifest: BuildManifest = {entries: {}, strict: false};
  private readonly _touched = new Set<BuildID>();

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
   * The live BuildManifest. This is a stable reference — `loadText()` and
   * `update()` mutate the same object, so passing this to a Runtime means
   * the Runtime always sees current data including the strict flag.
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
 * A resolved Malloy runtime configuration. The constructor takes either a
 * JSON string (legacy/compat) or a POJO plus an optional `ConfigOverlays`
 * dict, compiles the input into a typed tree, resolves all overlay
 * references, and builds the connection lookup via the connection registry.
 *
 * After construction:
 *   - `connections` — the `LookupConnection` runtime consumes. Starts as the
 *     lookup created from the resolved connections; `wrapConnections()` replaces
 *     it with a wrapped version for host-specific behavior.
 *   - `virtualMap` — extracted from the POJO as-is.
 *   - `manifestPath` — extracted from the POJO as-is (the raw string).
 *   - `manifestURL` — resolved URL of `malloy-manifest.json`, computed from
 *     `manifestPath` + the `configURL` carried on the `config` overlay (if
 *     any). `undefined` when no `configURL` is available. Runtime uses this
 *     to lazily read the manifest on the first persistence query. Builders
 *     that want to construct or mutate manifest state use the standalone
 *     `Manifest` class directly — they don't go through MalloyConfig.
 *   - `log` — validation warnings and overlay-resolution warnings.
 *
 * Typical usage:
 *
 *   // From a pre-loaded POJO (e.g. from `discoverConfig` or Publisher):
 *   const config = new MalloyConfig(pojo);
 *   const runtime = new Runtime({config, urlReader});
 *
 *   // From a JSON string:
 *   const config = new MalloyConfig(configText);
 *
 *   // With host-supplied overlays (local hosts after discovery):
 *   const config = new MalloyConfig(pojo, {
 *     config: contextOverlay({rootDirectory: ceilingURL}),
 *   });
 *
 *   // Wrap the connection lookup for host-specific behavior:
 *   config.wrapConnections(base => name => base(name) ?? fallback(name));
 *
 * The old async `new MalloyConfig(urlReader, configURL)` form has been
 * removed. Callers that need to load from a URL should pre-load via
 * `urlReader.readURL()` / `JSON.parse()` and pass the POJO, or use the
 * sync string form after reading the file.
 */
export class MalloyConfig {
  readonly virtualMap?: VirtualMap;
  readonly manifestPath?: string;
  /**
   * Resolved URL of the manifest file (`malloy-manifest.json`), if a
   * `configURL` was provided in the `config` overlay. Computed once in the
   * constructor from `manifestPath` (default `'MANIFESTS'`) joined to
   * `configURL`. Stays `undefined` for callers that didn't supply a
   * `configURL` — Runtime treats that as "no auto-read."
   */
  readonly manifestURL?: URL;
  readonly log: readonly LogMessage[];

  private _connections: LookupConnection<Connection>;
  private readonly _managedLookup: ManagedConnectionLookup;
  private readonly _overlays: ConfigOverlays;

  constructor(source: string);
  constructor(pojo: object, overlays?: ConfigOverlays);
  constructor(sourceOrPojo: string | object, overlays?: ConfigOverlays) {
    const log: LogMessage[] = [];

    // Normalize input to a POJO.
    let pojo: unknown;
    if (typeof sourceOrPojo === 'string') {
      try {
        pojo = JSON.parse(sourceOrPojo);
      } catch (e) {
        log.push({
          message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          severity: 'error',
          code: 'config-validation',
        });
        pojo = {};
      }
    } else {
      pojo = sourceOrPojo;
    }

    // Compile → typed tree + validation warnings.
    const compiled = compileConfig(pojo);
    log.push(...compiled.log);

    // Merge the host-supplied overlays onto the defaults. Same-named
    // entries replace defaults; new keys are added.
    const mergedOverlays: ConfigOverlays = {
      ...defaultConfigOverlays(),
      ...overlays,
    };

    // Synchronous prep: extract literal sections (manifestPath, virtualMap),
    // pull out compiled connection subtrees, fabricate bare entries for
    // missing registered types when `includeDefaultConnections` is set.
    // Reference resolution for connection properties is *not* done here —
    // it happens async at `lookupConnection` time, so overlays that touch
    // IO (secret stores, session reads) have a natural async seam.
    const prepared = prepareConfig(compiled.compiled, log);

    this._managedLookup = buildManagedLookup(
      prepared.compiledConnections,
      mergedOverlays,
      log
    );
    this._connections = this._managedLookup;

    this._overlays = mergedOverlays;
    this.virtualMap = toVirtualMap(prepared.virtualMap);
    this.manifestPath = prepared.manifestPath;
    this.manifestURL = computeManifestURL(
      prepared.manifestPath,
      mergedOverlays,
      log
    );
    this.log = log;
  }

  /**
   * The live `LookupConnection` consumed by Runtime. Stable until
   * `wrapConnections()` is called; after that, returns the wrapped lookup.
   */
  get connections(): LookupConnection<Connection> {
    return this._connections;
  }

  /**
   * Wrap the current connection lookup with a host-supplied wrapper.
   * Mutates in place — subsequent `connections` accesses return the new
   * wrapped lookup. Runtime never needs to know whether wrapping happened.
   *
   * Typical uses:
   *   - VS Code layers settings + defaults below the config lookup
   *   - Publisher attaches session-specific behavior to resolved connections
   */
  wrapConnections(
    wrapper: (
      base: LookupConnection<Connection>
    ) => LookupConnection<Connection>
  ): void {
    this._connections = wrapper(this._connections);
  }

  /**
   * Notify every connection this config has handed out that it is time to
   * release its resources, then drop them from the internal cache.
   *
   * Most callers should use `Runtime.releaseConnections()` instead — the
   * expected contract is one MalloyConfig per Runtime, and the runtime is
   * the natural handle for lifecycle. This method exists because Runtime
   * forwards to it, and for the rare case of a MalloyConfig constructed
   * without an accompanying Runtime.
   *
   * MalloyConfig does not own any connection resources itself — pools,
   * sockets, file handles, and in-process databases all live inside the
   * individual Connection objects. What the managed lookup owns is a cache
   * of `name → Connection` populated lazily as callers request connections.
   * This method walks that cache and calls `Connection.close()` on each
   * entry, which is the signal each connection uses to shut down whatever
   * resources it actually holds.
   *
   * Connections that were never looked up were never constructed and have
   * nothing to release; they are skipped. Wrapping lookups installed via
   * `wrapConnections()` do not interfere — the managed lookup under the
   * wrap is the one holding the cache.
   */
  async releaseConnections(): Promise<void> {
    await this._managedLookup.close();
  }

  /**
   * Query a value from the overlays used to resolve this config.
   *
   * Returns the value the named overlay produces for the given path,
   * or `undefined` if the overlay doesn't exist or the path has no value.
   * Async because overlays may be async (secret stores, session readers);
   * `await` tolerates both sync and Promise return types.
   *
   *   await config.readOverlay('config', 'rootDirectory')
   *   await config.readOverlay('config', 'configURL')
   *   await config.readOverlay('env', 'PG_PASSWORD')
   */
  async readOverlay(overlayName: string, ...path: string[]): Promise<unknown> {
    return await this._overlays[overlayName]?.(path);
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Default directory (relative to the config file) where the manifest lives
 * when `manifestPath` is not explicitly set. ALL CAPS signals a generated
 * artifact, not a hand-authored file. No dot prefix — visible and
 * discoverable in `ls`.
 */
const DEFAULT_MANIFEST_PATH = 'MANIFESTS';

/**
 * The filename inside the manifest directory.
 */
const MANIFEST_FILENAME = 'malloy-manifest.json';

/**
 * Compute the resolved URL of the manifest file from the raw `manifestPath`
 * string and the merged overlays (which may carry a `configURL`).
 *
 * Rules:
 *   - If there's no `configURL` in the `config` overlay → undefined.
 *   - **The `config` overlay MUST resolve `configURL` synchronously.** This
 *     is the one construction-time overlay call; it runs before the first
 *     `lookupConnection` and must return a plain string (or undefined). If
 *     it returns a Promise, `manifestURL` would be `undefined` — persistence
 *     would silently stop working. To avoid the silent failure, we warn on
 *     Promise returns so hosts discover the mistake. Other fields inside the
 *     `config` overlay (`rootDirectory`, etc.) can still be async; only
 *     `configURL` is sync-only.
 *   - `manifestPath` defaults to `'MANIFESTS'`.
 *   - `new URL(manifestPath, configURL)` handles three shapes uniformly:
 *       "MANIFESTS"               → relative to configURL's directory
 *       "../shared/MANIFESTS"     → parent-relative
 *       "/project/malloy/MANIFESTS" → absolute path within configURL's scheme
 *       "file:///elsewhere/stuff" → full URL, ignores configURL base
 *   - A trailing slash is forced onto the directory portion so that the
 *     final `new URL(MANIFEST_FILENAME, dir)` joins correctly.
 */
function computeManifestURL(
  manifestPath: string | undefined,
  overlays: ConfigOverlays,
  log: LogMessage[]
): URL | undefined {
  const configOverlay = overlays['config'];
  const configURLValue = configOverlay?.(['configURL']);
  if (isThenable(configURLValue)) {
    log.push({
      message:
        'the `config` overlay returned a Promise for `configURL`; `configURL` must be resolved synchronously. manifestURL will be undefined and persistence will not work.',
      severity: 'warn',
      code: 'config-overlay',
    });
    return undefined;
  }
  if (typeof configURLValue !== 'string') return undefined;

  let configURL: URL;
  try {
    configURL = new URL(configURLValue);
  } catch {
    return undefined;
  }

  const path = manifestPath ?? DEFAULT_MANIFEST_PATH;
  let manifestRoot: URL;
  try {
    manifestRoot = new URL(path, configURL);
  } catch {
    return undefined;
  }

  const asString = manifestRoot.toString();
  const dirURL = asString.endsWith('/')
    ? manifestRoot
    : new URL(asString + '/');
  return new URL(MANIFEST_FILENAME, dirURL);
}

/**
 * Convert the raw virtualMap POJO shape (a dict of dicts of strings) into
 * the runtime Map-of-Maps representation that Runtime consumes.
 */
function toVirtualMap(raw: unknown): VirtualMap | undefined {
  if (!isRecord(raw)) return undefined;
  const outer = new Map<string, Map<string, string>>();
  for (const [connName, inner] of Object.entries(raw)) {
    if (!isRecord(inner)) continue;
    const innerMap = new Map<string, string>();
    for (const [virtualName, tablePath] of Object.entries(inner)) {
      if (typeof tablePath === 'string') {
        innerMap.set(virtualName, tablePath);
      }
    }
    if (innerMap.size > 0) outer.set(connName, innerMap);
  }
  return outer.size > 0 ? outer : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as {then?: unknown}).then === 'function'
  );
}

function isBuildManifestEntry(value: unknown): value is BuildManifestEntry {
  return isRecord(value) && typeof value['tableName'] === 'string';
}
