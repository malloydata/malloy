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
import {
  contextOverlay,
  defaultConfigOverlays,
  isThenable,
} from './config_overlays';
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
/**
 * Filesystem context for a `MalloyConfig`: where the config file lives
 * (`configURL`) and where the project root is (`rootDirectory`).
 *
 * Both are URL-shaped strings (e.g. `'file:///path/to/config.json'`).
 * Hosts in Node convert their paths to file URLs (`url.pathToFileURL(path)
 * .toString()`); browser hosts pass `https://...` or whatever scheme they
 * serve from. Foundation never reaches for `process.cwd` — that decision
 * lives in the host.
 *
 *   - `configURL` — anchor for `manifestPath` and `givensPath` resolution.
 *     Set by `discoverConfig` to the URL of the matched config file. POJO
 *     callers pass it directly when their config carries any path setting.
 *   - `rootDirectory` — project root. Consumed by connection-property
 *     defaults via the `{config: 'rootDirectory'}` overlay-reference shape
 *     (e.g. DuckDB's `databasePath` default). Set by `discoverConfig` to
 *     the ceiling of the discovery range; POJO callers pass it when they
 *     need a project-rooted anchor.
 */
export type FilesystemContext = {
  configURL?: string;
  rootDirectory?: string;
};

/**
 * Second-arg options for `MalloyConfig`. Combines the filesystem context
 * with non-`config` overlays. The `config` slot in `overlays` is reserved
 * — pass `configURL` / `rootDirectory` directly instead. A reserved-slot
 * collision is warned and dropped, not silently merged.
 */
export interface MalloyConfigOptions extends FilesystemContext {
  overlays?: ConfigOverlays;
}

export class MalloyConfig {
  readonly virtualMap?: VirtualMap;
  /** URL-shaped string of the config file, or undefined if not supplied. */
  readonly configURL?: string;
  /** URL-shaped string of the project root, or undefined if not supplied. */
  readonly rootDirectory?: string;
  readonly manifestPath?: string;
  /**
   * Resolved URL string of the manifest file (`malloy-manifest.json`), if a
   * `configURL` was supplied. Computed once in the constructor from
   * `manifestPath` (default `'MANIFESTS'`) joined to `configURL`. Stays
   * `undefined` when no `configURL` is available — Runtime treats that as
   * "no auto-read."
   */
  readonly manifestURL?: string;
  readonly givensPath?: string;
  /**
   * Resolved URL string of the givens-values JSON file, if `givensPath`
   * was set and a `configURL` was supplied. Resolved against `configURL`
   * so relative paths in the project's `malloy-config.json` work the same
   * way `manifestPath` does. Stays `undefined` if `givensPath` was not
   * configured; Runtime treats that as "no per-runtime givens layer."
   */
  readonly givensURL?: string;
  /**
   * Surface names of givens that the runtime locks. Locked givens cannot
   * be overridden via per-query supply (`.run({givens: {X: ...}})` for a
   * locked X throws at API entry) and are filtered out of `Model.givens`
   * / `PreparedQuery.givens` introspection so UIs don't render editors
   * for them. Security primitive — multi-tenant deployments lock the
   * tenant identifier so a downstream endpoint that accidentally accepts
   * caller-controlled overrides can't leak across tenants.
   *
   * Validation that every locked name has a resolved value (file +
   * constructor) happens lazily at the first compile that needs givens,
   * since the `givensURL` file read is async.
   */
  readonly finalizeGivens?: ReadonlyArray<string>;
  readonly log: readonly LogMessage[];

  private _connections: LookupConnection<Connection>;
  private readonly _managedLookup: ManagedConnectionLookup;
  private readonly _overlays: ConfigOverlays;

  /**
   * @deprecated Pass `MalloyConfigOptions` (`{configURL, rootDirectory,
   * overlays}`) instead of a raw `ConfigOverlays` dict. The old shape is
   * detected at runtime and adapted automatically; remove the
   * `contextOverlay({...})` wrapping when convenient.
   */
  constructor(source: string, overlays: ConfigOverlays);
  /** Build a `MalloyConfig` from a JSON config string. */
  constructor(source: string, options?: MalloyConfigOptions);
  /**
   * @deprecated See the source-string overload's deprecation note.
   */
  constructor(pojo: object, overlays: ConfigOverlays);
  /** Build a `MalloyConfig` from a parsed POJO. */
  constructor(pojo: object, options?: MalloyConfigOptions);
  constructor(
    sourceOrPojo: string | object,
    optsOrOverlays?: MalloyConfigOptions | ConfigOverlays
  ) {
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

    // Distinguish the new typed-options form from the legacy
    // ConfigOverlays-dict form. Legacy dicts have function-valued slots
    // (`config: () => ...`); new options have string/object fields.
    const options = normalizeOptions(optsOrOverlays, log);

    // configURL must parse as a URL — foundation joins paths against it
    // (manifestURL, givensURL). rootDirectory is opaque; foundation just
    // forwards it via the `config` overlay to whoever consumes it (e.g.
    // DuckDB's databasePath default), so its shape is the consumer's call.
    const configURL = validateURLString(options.configURL, 'configURL', log);
    const rootDirectory = options.rootDirectory;

    // Build the internal `config` overlay from the typed FS context. Other
    // overlay slots (env, host-defined session/secret) ride alongside as
    // host-supplied. The `config` slot is reserved here; if the host
    // supplied one in `options.overlays`, normalizeOptions already warned
    // and dropped it.
    const mergedOverlays: ConfigOverlays = {
      ...defaultConfigOverlays(),
      ...options.overlays,
      config: contextOverlay({
        configURL,
        rootDirectory,
      }),
    };

    // Synchronous prep: extract literal sections (manifestPath, virtualMap),
    // pull out compiled connection subtrees, fabricate bare entries for
    // missing registered types when `includeDefaultConnections` is set.
    // Reference resolution for connection properties is *not* done here —
    // it happens async at `lookupConnection` time, so overlays that touch
    // IO (secret stores, session reads) have a natural async seam.
    const prepared = prepareConfig(compiled.compiled, mergedOverlays, log);

    this._managedLookup = buildManagedLookup(
      prepared.compiledConnections,
      mergedOverlays,
      log
    );
    this._connections = this._managedLookup;

    this._overlays = mergedOverlays;
    this.virtualMap = toVirtualMap(prepared.virtualMap);
    this.configURL = configURL;
    this.rootDirectory = rootDirectory;
    this.manifestPath = prepared.manifestPath;
    this.manifestURL = computeManifestURL(prepared.manifestPath, configURL);
    this.givensPath = prepared.givensPath;
    this.givensURL = computeGivensURL(prepared.givensPath, configURL, log);
    this.finalizeGivens = prepared.finalizeGivens;
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
   * Notify every connection this config has handed out that the host is
   * done with it, applying the requested disposition to its backend
   * resources. Two policies:
   *
   * - `'close'` (default) — destructive. Calls `Connection.close()` on each
   *   cached entry and drops the cache. Subsequent operations on those
   *   connection objects may fail. Use this at real shutdown: process
   *   exit, extension deactivate, config-file change.
   *
   * - `'idle'` — reversible. Calls `Connection.idle()` on each cached entry
   *   without dropping the cache. The same Connection objects are reused
   *   on next lookup; schema cache and other in-process state survive.
   *   The next operation transparently reattaches any backend resources
   *   that were released. Use this between operations in long-lived hosts
   *   (VSCode, MCP servers, anything that builds Runtimes per request) to
   *   release file locks / pooled sockets while the host is otherwise
   *   idle.
   *
   * Most callers should use `Runtime.shutdown(...)` instead — the expected
   * contract is one MalloyConfig per Runtime, and the runtime is the
   * natural handle for lifecycle. This method exists because Runtime
   * forwards to it, and for the rare case of a MalloyConfig constructed
   * without an accompanying Runtime.
   *
   * MalloyConfig does not own any connection resources itself — pools,
   * sockets, file handles, and in-process databases all live inside the
   * individual Connection objects. What the managed lookup owns is a cache
   * of `name → Connection` populated lazily as callers request
   * connections. Connections that were never looked up were never
   * constructed and have nothing to release; they are skipped. Wrapping
   * lookups installed via `wrapConnections()` do not interfere — the
   * managed lookup under the wrap is the one holding the cache.
   */
  async shutdown(connections: 'close' | 'idle' = 'close'): Promise<void> {
    if (connections === 'idle') {
      await this._managedLookup.idle();
    } else {
      await this._managedLookup.close();
    }
  }

  /**
   * @deprecated Use `shutdown('close')` instead.
   */
  async releaseConnections(): Promise<void> {
    await this.shutdown('close');
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
  configURL: string | undefined
): string | undefined {
  if (!configURL) return undefined;
  let baseURL: URL;
  try {
    baseURL = new URL(configURL);
  } catch {
    return undefined;
  }
  const path = manifestPath ?? DEFAULT_MANIFEST_PATH;
  let manifestRoot: URL;
  try {
    manifestRoot = new URL(path, baseURL);
  } catch {
    return undefined;
  }
  const asString = manifestRoot.toString();
  const dirURL = asString.endsWith('/')
    ? manifestRoot
    : new URL(asString + '/');
  return new URL(MANIFEST_FILENAME, dirURL).toString();
}

/**
 * Resolve `givensPath` to a full URL string, joined against `configURL`
 * so relative paths anchor at the project's `malloy-config.json`
 * directory. Returns `undefined` and warns when `givensPath` was set but
 * resolution can't proceed — silent drop here is unfriendly because
 * unlike `manifestPath`, `givensPath` has no graceful-fallback story.
 */
function computeGivensURL(
  givensPath: string | undefined,
  configURL: string | undefined,
  log: LogMessage[]
): string | undefined {
  if (!givensPath) return undefined;
  if (!configURL) {
    log.push({
      message:
        'givensPath is set but no configURL is available; per-runtime givens will not be loaded. Pass `configURL` (or use an absolute URL such as `file:///...`).',
      severity: 'warn',
      code: 'config-overlay',
    });
    return undefined;
  }
  let baseURL: URL;
  try {
    baseURL = new URL(configURL);
  } catch {
    return undefined;
  }
  try {
    return new URL(givensPath, baseURL).toString();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.push({
      message: `givensPath '${givensPath}' could not be resolved against configURL '${configURL}': ${msg}`,
      severity: 'warn',
      code: 'config-validation',
    });
    return undefined;
  }
}

/**
 * Distinguish the new typed-options form (`{configURL?, rootDirectory?,
 * overlays?}`) from the legacy `ConfigOverlays`-dict form (`{config: fn,
 * env: fn, ...}`) by checking for function-valued top-level slots. Legacy
 * inputs are adapted: extract `configURL` and `rootDirectory` from
 * `overlays.config?.(['name'])` (sync only — async overlays warn and
 * drop), preserve the rest as `options.overlays`. New inputs pass
 * through, but a non-empty `overlays.config` is reserved-slot collision —
 * warn and drop.
 */
function normalizeOptions(
  optsOrOverlays: MalloyConfigOptions | ConfigOverlays | undefined,
  log: LogMessage[]
): MalloyConfigOptions {
  if (optsOrOverlays === undefined) return {};
  if (isLegacyOverlays(optsOrOverlays)) {
    return adaptLegacyOverlays(optsOrOverlays, log);
  }
  const opts = optsOrOverlays;
  if (opts.overlays && 'config' in opts.overlays) {
    log.push({
      message:
        '`config` is reserved by MalloyConfig; pass `configURL` and `rootDirectory` directly instead. Supplied `overlays.config` ignored.',
      severity: 'warn',
      code: 'config-overlay',
    });
    const {config: _config, ...rest} = opts.overlays;
    return {...opts, overlays: rest};
  }
  return opts;
}

function isLegacyOverlays(
  arg: MalloyConfigOptions | ConfigOverlays
): arg is ConfigOverlays {
  for (const v of Object.values(arg)) {
    if (typeof v === 'function') return true;
  }
  return false;
}

function adaptLegacyOverlays(
  overlays: ConfigOverlays,
  log: LogMessage[]
): MalloyConfigOptions {
  const cfg = overlays['config'];
  if (!cfg) return {overlays};
  const configURL = readSyncString(cfg, 'configURL', log);
  const rootDirectory = readSyncString(cfg, 'rootDirectory', log);
  // Strip the legacy `config` overlay; its values are now typed fields.
  // Any other slots (env, host-defined) ride through.
  const {config: _config, ...rest} = overlays;
  return {configURL, rootDirectory, overlays: rest};
}

function readSyncString(
  overlay: NonNullable<ConfigOverlays['config']>,
  key: string,
  log: LogMessage[]
): string | undefined {
  const v = overlay([key]);
  if (isThenable(v)) {
    log.push({
      message: `the legacy \`config\` overlay returned a Promise for \`${key}\`; top-level FS context must resolve synchronously. ${key} will be undefined.`,
      severity: 'warn',
      code: 'config-overlay',
    });
    return undefined;
  }
  return typeof v === 'string' ? v : undefined;
}

/**
 * Diagnose a URL-shaped string. Returns the string back when valid,
 * undefined (with a warning) when not. Empty/undefined inputs return
 * undefined silently — those are the "not supplied" case.
 */
function validateURLString(
  value: string | undefined,
  fieldName: string,
  log: LogMessage[]
): string | undefined {
  if (value === undefined) return undefined;
  try {
    new URL(value);
    return value;
  } catch {
    log.push({
      message: `${fieldName} must be a URL-shaped string (e.g. 'file:///path/to/...'), got '${value}'. In Node, use \`url.pathToFileURL(path).toString()\`.`,
      severity: 'warn',
      code: 'config-validation',
    });
    return undefined;
  }
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

function isBuildManifestEntry(value: unknown): value is BuildManifestEntry {
  return isRecord(value) && typeof value['tableName'] === 'string';
}
