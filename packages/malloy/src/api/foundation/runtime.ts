/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection, LookupConnection} from '../../connection/types';
import type {URLReader, EventStream} from '../../runtime_types';
import type {
  ModelDef,
  Query as InternalQuery,
  SearchIndexResult,
  SearchValueMapResult,
  QueryRunStats,
  PrepareResultOptions,
  BuildManifest,
  GivenValue,
  VirtualMap,
} from '../../model';
import {isSourceDef, mkSafeRecord} from '../../model';
import {getDialect} from '../../dialect';
import type {Dialect} from '../../dialect';
import type {RunSQLOptions} from '../../run_sql_options';
import {rowDataToNumber} from '../../api/row_data_utils';
import type {CacheManager} from './cache';
import type {MalloyConfig} from './config';
import {EmptyURLReader, FixedConnectionMap} from './readers';
import type {ParseOptions, CompileOptions, CompileQueryOptions} from './types';
import type {PreparedResult, Explore} from './core';
import {Model, PreparedQuery} from './core';
import type {DataRecord, Result} from './result';
import {Malloy} from './compile';

// =============================================================================
// Type Aliases
// =============================================================================

type ModelURL = URL;
type ModelString = string;
type QueryURL = URL;
type QueryString = string;

type Connectionable =
  | {
      config: MalloyConfig;
      connection?: undefined;
      connections?: LookupConnection<Connection>;
    }
  | {connection: Connection; connections?: undefined; config?: undefined}
  | {
      connections: LookupConnection<Connection>;
      connection?: undefined;
      config?: undefined;
    };

// =============================================================================
// FluentState Base Class
// =============================================================================

class FluentState<T> {
  private readonly _materialize: () => Promise<T>;
  private materialized: Promise<T> | undefined;

  constructor(
    protected runtime: Runtime,
    materialize: () => Promise<T>
  ) {
    this._materialize = materialize;
  }

  protected materialize(): Promise<T> {
    if (this.materialized === undefined) {
      return this.rematerialize();
    }
    return this.materialized;
  }

  protected rematerialize(): Promise<T> {
    this.materialized = this._materialize();
    return this.materialized;
  }

  protected makeQueryMaterializer(
    materialize: () => Promise<PreparedQuery>,
    options?: CompileQueryOptions
  ): QueryMaterializer {
    return new QueryMaterializer(this.runtime, materialize, options);
  }

  protected makeExploreMaterializer(
    materialize: () => Promise<Explore>,
    options?: CompileQueryOptions
  ): ExploreMaterializer {
    return new ExploreMaterializer(this.runtime, materialize, options);
  }

  protected makePreparedResultMaterializer(
    materialize: () => Promise<PreparedResult>
  ): PreparedResultMaterializer {
    return new PreparedResultMaterializer(this.runtime, materialize);
  }
}

// =============================================================================
// Runtime
// =============================================================================

/**
 * An environment for compiling and running Malloy queries.
 */
export class Runtime {
  isTestRuntime = false;
  private _urlReader: URLReader;
  private _connections: LookupConnection<Connection>;
  private _eventStream: EventStream | undefined;
  private _cacheManager: CacheManager | undefined;
  private _config: MalloyConfig | undefined;
  private _buildManifest: BuildManifest | undefined;
  private _resolvedBuildManifestPromise:
    | Promise<BuildManifest | undefined>
    | undefined;
  private _resolvedGivensPromise:
    | Promise<Record<string, GivenValue> | undefined>
    | undefined;
  private _constructorGivensMap: ReadonlyMap<string, GivenValue>;
  private _finalizedGivensSet: ReadonlySet<string>;
  private _virtualMap: VirtualMap | undefined;

  constructor({
    urlReader,
    connections,
    connection,
    config,
    buildManifest,
    eventStream,
    cacheManager,
    givens,
  }: {
    urlReader?: URLReader;
    buildManifest?: BuildManifest;
    eventStream?: EventStream;
    cacheManager?: CacheManager;
    /**
     * Per-runtime givens supplied directly by the host (multi-tenant
     * server passing JWT-derived values; tests; scripts). Overlaid on top
     * of `config.givensURL` per-key, then per-query supply via
     * `.run({givens: ...})` overlays on top of both.
     */
    givens?: Record<string, GivenValue>;
  } & Connectionable) {
    if (config !== undefined) {
      this._config = config;
      connections = connections ?? config.connections;
    } else if (connections === undefined) {
      if (connection === undefined) {
        throw new Error(
          'A MalloyConfig, LookupConnection<Connection>, or Connection is required.'
        );
      }
      connections = {
        lookupConnection: () => Promise.resolve(connection),
      };
    }
    if (urlReader === undefined) {
      urlReader = new EmptyURLReader();
    }
    this._urlReader = urlReader;
    this._connections = connections;
    this._buildManifest = buildManifest;
    this._eventStream = eventStream;
    this._cacheManager = cacheManager;
    if (givens) {
      for (const [name, value] of Object.entries(givens)) {
        if (value === undefined) {
          throw new Error(
            `Runtime givens.${name}: explicit undefined is not a valid value. ` +
              'Omit the key to defer to declaration default or the file layer; ' +
              'use null for an explicit null value.'
          );
        }
      }
    }
    this._constructorGivensMap = givens
      ? new Map(Object.entries(givens))
      : new Map();
    this._finalizedGivensSet = new Set(this._config?.finalizeGivens ?? []);
  }

  /**
   * @return The `CacheManager` for this runtime instance.
   */
  public get cacheManager(): CacheManager | undefined {
    return this._cacheManager;
  }

  /**
   * @return The `URLReader` for this runtime instance.
   */
  public get urlReader(): URLReader {
    return this._urlReader;
  }

  /**
   * @return The `LookupConnection<Connection>` for this runtime instance.
   */
  public get connections(): LookupConnection<Connection> {
    return this._connections;
  }

  /**
   * @return The `EventStream` for this runtime instance.
   */
  public get eventStream(): EventStream | undefined {
    return this._eventStream;
  }

  /**
   * Constructor-supplied givens, exposed for the materializer's per-query
   * merge. Underscore-prefixed because it's the constructor layer only —
   * use `getGivens()` for the full file+constructor view a caller usually
   * wants.
   *
   * @internal Accessed from QueryMaterializer.
   */
  public get _constructorGivens(): ReadonlyMap<string, GivenValue> {
    return this._constructorGivensMap;
  }

  /**
   * The runtime's effective givens — file (from `config.givensPath`,
   * lazily loaded) merged with the constructor `givens:` option, with
   * the constructor winning per-key. Per-query supply via
   * `.run({ givens: ... })` is *not* included; that's a per-call
   * argument, not runtime state.
   *
   * Async because the file may not yet be loaded; subsequent calls share
   * the cached promise.
   */
  public async getGivens(): Promise<ReadonlyMap<string, GivenValue>> {
    const file = await this._resolveGivens();
    const merged = new Map<string, GivenValue>();
    if (file) {
      for (const [k, v] of Object.entries(file)) merged.set(k, v);
    }
    for (const [k, v] of this._constructorGivensMap) merged.set(k, v);
    return merged;
  }

  /**
   * Surface names of givens locked at the runtime layer (the resolved set
   * the `config.finalizeGivens` directive produced). Per-query supply for
   * these names throws; `Model.givens` and `PreparedQuery.givens` filter
   * them out so introspection-driven UIs don't render editors for them.
   *
   * @internal Accessed from QueryMaterializer and Model construction.
   */
  public get _finalizedGivens(): ReadonlySet<string> {
    return this._finalizedGivensSet;
  }

  /**
   * Setter — install an explicit build manifest for persist source
   * substitution. From this point on, compiled queries resolve persist
   * sources against `manifest` (still overridable per-query via
   * `CompileQueryOptions.buildManifest`). Pass `undefined` to clear.
   *
   * This wins over the auto-read path: an explicit value here takes
   * precedence over whatever `config.manifestURL` would have resolved
   * to. Setting also drops any cached auto-read promise so a subsequent
   * compile sees the new value rather than a stale soft-miss.
   *
   * No getter is provided — call `_resolveBuildManifest()` to materialize
   * the value the next compile will actually use (explicit > auto-read >
   * undefined).
   */
  public set buildManifest(manifest: BuildManifest | undefined) {
    this._buildManifest = manifest;
    this._resolvedBuildManifestPromise = undefined;
  }

  /**
   * Resolve the build manifest for the next compile. Called from inside
   * the async query-compile path (`QueryMaterializer.loadPreparedResult`).
   *
   * Precedence:
   *   1. Explicit `_buildManifest` (from constructor option or setter) → use it.
   *   2. `config.manifestURL` present → lazily read it via `_urlReader`,
   *      parse as JSON, cache the promise.
   *      - Read failure (file not present, permission denied, etc.) →
   *        soft miss to `undefined`. The common "no manifest yet" case
   *        for projects that don't use persistence.
   *      - File present but unparseable → return `{entries: {}, loadError}`
   *        instead of `undefined`. Non-strict compiles still fall through
   *        to inline SQL (entries is empty), but strict compiles can
   *        include the load error in their "not found in manifest" throw,
   *        so the user sees *why* the manifest looks empty.
   *   3. No URL → `undefined`.
   *
   * The cached promise means concurrent compiles share one IO round-trip;
   * `buildManifest = ...` (setter) clears the cache so subsequent compiles
   * see the new value.
   *
   * @internal Accessed from the Materializer classes in this file. Not part
   * of the public API — the leading underscore + `@internal` marks intent.
   */
  public _resolveBuildManifest(): Promise<BuildManifest | undefined> {
    if (this._buildManifest) {
      return Promise.resolve(this._buildManifest);
    }
    const urlStr = this._config?.manifestURL;
    if (!urlStr) return Promise.resolve(undefined);
    if (!this._resolvedBuildManifestPromise) {
      this._resolvedBuildManifestPromise = (async () => {
        let text: string;
        try {
          const result = await this._urlReader.readURL(new URL(urlStr));
          text = typeof result === 'string' ? result : result.contents;
        } catch {
          // Read failure (no file, permission, etc.) — treat as "no
          // manifest, no substitution." Strict mode is silently inactive
          // here, matching the soloist case where there's nothing to
          // strict-check against.
          return undefined;
        }
        try {
          const parsed: unknown = JSON.parse(text);
          if (!isBuildManifestShape(parsed)) {
            throw new Error('manifest is not an object with an "entries" map');
          }
          return parsed;
        } catch (e) {
          // File was present but couldn't be parsed. Return an empty
          // manifest carrying the load error so a strict-mode compile can
          // surface the real reason in its throw.
          const msg = e instanceof Error ? e.message : String(e);
          return {
            entries: {},
            loadError: `Manifest file at ${urlStr} could not be parsed: ${msg}`,
          };
        }
      })();
    }
    return this._resolvedBuildManifestPromise;
  }

  /**
   * Resolve the per-runtime givens map from `config.givensURL` (the file
   * `givensPath` points at). Lazy and cached as a Promise — first compile
   * triggers the read, subsequent compiles share the result.
   *
   * Stricter error policy than `_resolveBuildManifest`: a missing file or
   * malformed JSON throws. Per design, the per-runtime givens layer is a
   * configured contract, not an opportunistic read; a misconfigured path
   * should fail loudly at the first compile, not silently degrade.
   *
   * Returns `undefined` only when no `givensURL` is configured.
   *
   * @internal Accessed from QueryMaterializer.
   */
  public _resolveGivens(): Promise<Record<string, GivenValue> | undefined> {
    const urlStr = this._config?.givensURL;
    if (!urlStr) return Promise.resolve(undefined);
    if (!this._resolvedGivensPromise) {
      this._resolvedGivensPromise = (async () => {
        let text: string;
        try {
          const result = await this._urlReader.readURL(new URL(urlStr));
          text = typeof result === 'string' ? result : result.contents;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(
            `givens: failed to read givens file at ${urlStr}: ${msg}`
          );
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`givens: failed to parse JSON at ${urlStr}: ${msg}`);
        }
        if (!isGivensObject(parsed)) {
          const got = Array.isArray(parsed)
            ? 'array'
            : parsed === null
              ? 'null'
              : typeof parsed;
          throw new Error(
            `givens: file at ${urlStr} must be a JSON object of name → value pairs, got ${got}`
          );
        }
        return parsed;
      })();
    }
    return this._resolvedGivensPromise;
  }

  /** @internal */
  public _invalidateGivensCache(): void {
    this._resolvedGivensPromise = undefined;
  }

  /**
   * The virtual map for virtual source resolution.
   * When set, compiled queries automatically resolve virtual sources
   * against this map. Can be overridden per-query via
   * CompileQueryOptions.virtualMap.
   *
   * When constructed with a MalloyConfig, falls through to
   * config.virtualMap.
   */
  public get virtualMap(): VirtualMap | undefined {
    return this._virtualMap ?? this._config?.virtualMap;
  }

  public set virtualMap(map: VirtualMap | undefined) {
    this._virtualMap = map;
  }

  /**
   * Tell this runtime's connections what to do with their backend
   * resources now that the host is done with this Runtime. Two policies:
   *
   * - `'close'` (default) — destructive shutdown. Connections release
   *   resources and become unusable. Use at real shutdown: process exit,
   *   extension deactivate, config-file change.
   *
   * - `'idle'` — reversible release. Connections release expensive
   *   resources (DuckDB file locks, socket pools) but stay logically
   *   valid. The same Connection objects are reused on next lookup;
   *   schema cache and other in-process state survive. Use between
   *   operations in long-lived hosts (a VSCode extension, an MCP server,
   *   any host that builds Runtimes per request) so that other writers
   *   can claim resources during idle gaps.
   *
   * A no-op for runtimes constructed without a MalloyConfig — in that
   * case the caller owns the connections they passed in.
   */
  public async shutdown(
    connections: 'close' | 'idle' = 'close'
  ): Promise<void> {
    await this._config?.shutdown(connections);
  }

  /**
   * @deprecated Use `shutdown('close')` instead.
   */
  public async releaseConnections(): Promise<void> {
    await this.shutdown('close');
  }

  /**
   * Load a Malloy model by URL or contents.
   *
   * @param source The model URL or contents to load and (eventually) compile.
   * @return A `ModelMaterializer` capable of materializing the requested model,
   * or loading further related objects.
   */
  public loadModel(
    source: ModelURL | ModelString,
    options?: ParseOptions & CompileOptions & CompileQueryOptions
  ): ModelMaterializer {
    const {refreshSchemaCache, noThrowOnError} = options || {};
    if (this.isTestRuntime) {
      if (options === undefined) {
        options = {testEnvironment: true};
      } else {
        options = {...options, testEnvironment: true};
      }
    }
    const compilable = source instanceof URL ? {url: source} : {source};
    return new ModelMaterializer(
      this,
      async () => {
        const m = await Malloy.compile({
          ...compilable,
          urlReader: this.urlReader,
          connections: this.connections,
          refreshSchemaCache,
          noThrowOnError,
          eventStream: this.eventStream,
          importBaseURL: options?.importBaseURL,
          testEnvironment: options?.testEnvironment,
          cacheManager: this.cacheManager,
        });
        return this._withRuntimeContext(m);
      },
      options
    );
  }

  /**
   * Re-wrap a `Model` produced by `Malloy.compile` with this runtime's
   * `RuntimeContext` so context-sensitive Model methods (currently
   * `Model.givens` filtering finalized names; future runtime-aware
   * concerns) work correctly. No-op when there's nothing in the context.
   *
   * @internal Accessed from `ModelMaterializer.extendModel` and Runtime
   * loadModel paths.
   */
  public _withRuntimeContext(m: Model): Model {
    if (this._finalizedGivensSet.size === 0) return m;
    return new Model(
      m._modelDef,
      m.problems,
      m.fromSources,
      m.getExistingQueryModel(),
      {
        finalizedGivens: this._finalizedGivensSet,
      }
    );
  }

  // TODO Consider formalizing this. Perhaps as a `withModel` method,
  //      as well as a `Model.fromModelDefinition` if we choose to expose
  //      `ModelDef` to the world formally. For now, this should only
  //      be used in tests.
  public _loadModelFromModelDef(
    modelDef: ModelDef,
    options?: CompileQueryOptions
  ): ModelMaterializer {
    return new ModelMaterializer(
      this,
      async () => {
        return new Model(
          modelDef,
          [],
          [],
          undefined,
          this._finalizedGivensSet.size > 0
            ? {finalizedGivens: this._finalizedGivensSet}
            : undefined
        );
      },
      options
    );
  }

  /**
   * Load a Malloy query by URL or contents.
   *
   * @param query The query URL or contents to load and (eventually) compile.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQuery(
    query: QueryURL | QueryString,
    options?: ParseOptions & CompileOptions & CompileQueryOptions
  ): QueryMaterializer {
    return this.loadModel(query, options).loadFinalQuery();
  }

  /**
   * Load a Malloy query by the URL or contents of a Malloy model document
   * and the index of an unnamed query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param index The index of the query to use within the model.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByIndex(
    model: ModelURL | ModelString,
    index: number,
    options?: ParseOptions & CompileOptions & CompileQueryOptions
  ): QueryMaterializer {
    return this.loadModel(model, options).loadQueryByIndex(index, options);
  }

  /**
   * Load a Malloy query by the URL or contents of a Malloy model document
   * and the name of a query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param name The name of the query to use within the model.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByName(
    model: ModelURL | ModelString,
    name: string,
    options?: ParseOptions & CompileOptions & CompileQueryOptions
  ): QueryMaterializer {
    return this.loadModel(model, options).loadQueryByName(name, options);
  }

  // TODO maybe use overloads for the alternative parameters
  /**
   * Compile a Malloy model by URL or contents.
   *
   * @param source The URL or contents of a Malloy model document to compile.
   * @return A promise of a compiled `Model`.
   */
  public getModel(
    source: ModelURL | ModelString,
    options?: ParseOptions & CompileOptions
  ): Promise<Model> {
    return this.loadModel(source, options).getModel();
  }

  /**
   * Compile a Malloy query by URL or contents.
   *
   * @param query The URL or contents of a Malloy query document to compile.
   * @return A promise of a compiled `PreparedQuery`.
   */
  public getQuery(
    query: QueryURL | QueryString,
    options?: ParseOptions & CompileOptions
  ): Promise<PreparedQuery> {
    return this.loadQuery(query, options).getPreparedQuery();
  }

  /**
   * Compile a Malloy query by the URL or contents of a model document
   * and the index of an unnamed query contained within the model.
   *
   * @param model The URL or contents of a Malloy model document to compile.
   * @param index The index of an unnamed query contained within the model.
   * @return A promise of a compiled `PreparedQuery`.
   */
  public getQueryByIndex(
    model: ModelURL | ModelString,
    index: number,
    options?: ParseOptions & CompileOptions
  ): Promise<PreparedQuery> {
    return this.loadQueryByIndex(model, index, options).getPreparedQuery();
  }

  /**
   * Compile a Malloy query by the URL or contents of a model document
   * and the name of a query contained within the model.
   *
   * @param model The URL or contents of a Malloy model document to compile.
   * @param name The name of a query contained within the model.
   * @return A promise of a compiled `PreparedQuery`.
   */
  public getQueryByName(
    model: ModelURL | ModelString,
    name: string,
    options?: ParseOptions & CompileOptions
  ): Promise<PreparedQuery> {
    return this.loadQueryByName(model, name, options).getPreparedQuery();
  }
}

// =============================================================================
// ConnectionRuntime and SingleConnectionRuntime
// =============================================================================

export class ConnectionRuntime extends Runtime {
  public readonly rawConnections: Connection[];

  constructor({
    urlReader,
    connections,
  }: {
    urlReader?: URLReader;
    connections: Connection[];
  }) {
    super({
      connections: FixedConnectionMap.fromArray(connections),
      urlReader,
    });
    this.rawConnections = connections;
  }
}

export class SingleConnectionRuntime<
  T extends Connection = Connection,
> extends Runtime {
  public readonly connection: T;

  constructor({
    urlReader,
    connection,
    eventStream,
    cacheManager,
  }: {
    urlReader?: URLReader;
    eventStream?: EventStream;
    cacheManager?: CacheManager;
    connection: T;
  }) {
    super({
      urlReader,
      eventStream,
      cacheManager,
      connection,
    });
    this.connection = connection;
  }

  get supportsNesting(): boolean {
    return getDialect(this.connection.dialectName).supportsNesting;
  }

  // quote a column name
  quote(column: string): string {
    return getDialect(this.connection.dialectName).sqlQuoteIdentifier(column);
  }

  get dialect(): Dialect {
    return getDialect(this.connection.dialectName);
  }

  getQuoter(): (arg: TemplateStringsArray) => string {
    return (x: TemplateStringsArray) => this.quote(x.toString());
  }
}

// =============================================================================
// ModelMaterializer
// =============================================================================

/**
 * An object representing the task of loading a `Model`, capable of
 * materializing that model (via `getModel()`) or extending the task to load
 * queries or explores (via e.g. `loadFinalQuery()`, `loadQuery`, `loadExploreByName`, etc.).
 */
export class ModelMaterializer extends FluentState<Model> {
  private readonly compileQueryOptions: CompileQueryOptions | undefined;
  constructor(
    protected runtime: Runtime,
    materialize: () => Promise<Model>,
    options?: CompileQueryOptions
  ) {
    super(runtime, materialize);
    this.compileQueryOptions = options;
  }

  /**
   * Load the final (unnamed) Malloy query contained within this loaded `Model`.
   *
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadFinalQuery(options?: CompileQueryOptions): QueryMaterializer {
    return this.makeQueryMaterializer(
      async () => {
        return (await this.materialize()).getPreparedQuery();
      },
      {
        ...this.compileQueryOptions,
        ...options,
      }
    );
  }

  /**
   * Load an unnamed query contained within this loaded `Model` by index.
   *
   * @param index The index of the query to load.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByIndex(
    index: number,
    options?: CompileQueryOptions
  ): QueryMaterializer {
    return this.makeQueryMaterializer(
      async () => {
        return (await this.materialize()).getPreparedQueryByIndex(index);
      },
      {
        ...this.compileQueryOptions,
        ...options,
      }
    );
  }

  /**
   * Load a query contained within this loaded `Model` by its name.
   *
   * @param name The name of the query to load.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByName(
    name: string,
    options?: CompileQueryOptions
  ): QueryMaterializer {
    return this.makeQueryMaterializer(
      async () => {
        return (await this.materialize()).getPreparedQueryByName(name);
      },
      {
        ...this.compileQueryOptions,
        ...options,
      }
    );
  }

  /**
   * Load a query against this loaded `Model` by its URL or contents.
   *
   * @param query The URL or contents of the query to load and (eventually) compile.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQuery(
    query: QueryString | QueryURL,
    options?: ParseOptions & CompileOptions & CompileQueryOptions
  ): QueryMaterializer {
    const {refreshSchemaCache, noThrowOnError} = options || {};
    return this.makeQueryMaterializer(async () => {
      const urlReader = this.runtime.urlReader;
      const connections = this.runtime.connections;
      if (this.runtime.isTestRuntime) {
        if (options === undefined) {
          options = {testEnvironment: true};
        } else {
          options = {...options, testEnvironment: true};
        }
      }
      const compilable = query instanceof URL ? {url: query} : {source: query};
      const model = await this.getModel();
      const queryModel = await Malloy.compile({
        ...compilable,
        urlReader,
        connections,
        model,
        refreshSchemaCache,
        noThrowOnError,
        importBaseURL: options?.importBaseURL,
        testEnvironment: options?.testEnvironment,
        ...this.compileQueryOptions,
      });
      return queryModel.preparedQuery;
    });
  }

  /**
   * Extend a Malloy model by URL or contents.
   *
   * @param source The model URL or contents to load and (eventually) compile.
   * @return A `ModelMaterializer` capable of materializing the requested model,
   * or loading further related objects.
   */
  public extendModel(
    query: QueryString | QueryURL,
    options?: ParseOptions & CompileOptions & CompileQueryOptions
  ): ModelMaterializer {
    if (this.runtime.isTestRuntime) {
      if (options === undefined) {
        options = {testEnvironment: true};
      } else {
        options = {...options, testEnvironment: true};
      }
    }
    return new ModelMaterializer(
      this.runtime,
      async () => {
        const urlReader = this.runtime.urlReader;
        const connections = this.runtime.connections;
        const compilable =
          query instanceof URL ? {url: query} : {source: query};
        const model = await this.getModel();
        const queryModel = await Malloy.compile({
          ...compilable,
          urlReader,
          connections,
          model,
          refreshSchemaCache: options?.refreshSchemaCache,
          noThrowOnError: options?.noThrowOnError,
          importBaseURL: options?.importBaseURL,
          testEnvironment: options?.testEnvironment,
          ...this.compileQueryOptions,
        });
        return this.runtime._withRuntimeContext(queryModel);
      },
      options
    );
  }

  public async search(
    sourceName: string,
    searchTerm: string,
    limit = 1000,
    searchField: string | undefined = undefined
  ): Promise<SearchIndexResult[] | undefined> {
    const model = await this.materialize();
    const queryModel = model.queryModel;
    const schema = model.getExploreByName(sourceName).structDef;
    if (!isSourceDef(schema)) {
      throw new Error('Source to be searched was unexpectedly, not a source');
    }
    const connectionName = schema.connection;
    const connection =
      await this.runtime.connections.lookupConnection(connectionName);
    return await queryModel.searchIndex(
      connection,
      sourceName,
      searchTerm,
      limit,
      searchField
    );
  }

  public async searchValueMap(
    sourceName: string,
    limit = 10,
    options?: ParseOptions
  ): Promise<SearchValueMapResult[] | undefined> {
    const model = await this.materialize();
    const schema = model.getExploreByName(sourceName);
    if (!isSourceDef(schema.structDef)) {
      throw new Error('Source to be searched was unexpectedly, not a source');
    }
    let indexQuery = '{index: *}';

    if (schema.getFieldByNameIfExists('search_index')) {
      indexQuery = 'search_index';
    }

    const searchMapMalloy = `
      run: ${sourceName}
        -> ${indexQuery}
        -> {
          where: fieldType = 'string'
          group_by: fieldName
          aggregate: cardinality is count(fieldValue)
          nest: values is {
            group_by: fieldValue, weight
            order_by: weight desc
            limit: ${limit}
          }
          limit: 1000
        }
    `;
    const result = await this.loadQuery(searchMapMalloy, options).run({
      rowLimit: 1000,
    });
    // The query above is fully constrained — its shape is dictated by the
    // group_by/aggregate/nest we just compiled. Use the public `data`
    // accessor (a typed `QueryData`) and assert the row shape rather than
    // reaching into `_queryResult` and laundering through `unknown`.
    type SearchValueMapRow = {
      fieldName: string;
      cardinality: unknown;
      values: {fieldValue: string; weight: unknown}[];
    };
    const rawResult = result.data.toObject() as SearchValueMapRow[];
    return rawResult.map(row => ({
      ...row,
      cardinality: rowDataToNumber(row.cardinality),
      values: row.values.map(v => ({
        ...v,
        weight: rowDataToNumber(v.weight),
      })),
    }));
  }

  /**
   * Materialize the final query contained within this loaded `Model`.
   *
   * @return A promise to a prepared query.
   */
  public getFinalQuery(): Promise<PreparedQuery> {
    return this.loadFinalQuery().getPreparedQuery();
  }

  /**
   * Materialize an unnamed query contained within this loaded `Model` by index.
   *
   * @param index The index of the query contained within this loaded `Model`.
   * @return A promise to a prepared query.
   */
  public getQueryByIndex(index: number): Promise<PreparedQuery> {
    return this.loadQueryByIndex(index).getPreparedQuery();
  }

  /**
   * Materialize a query contained within this loaded `Model` by name.
   *
   * @param name The name of the query contained within this loaded `Model`.
   * @return A promise to a prepared query.
   */
  public getQueryByName(name: string): Promise<PreparedQuery> {
    return this.loadQueryByName(name).getPreparedQuery();
  }

  /**
   * Materialize a query against this loaded `Model` by its URL or contents.
   *
   * @param query The URL or contents of a query document to compile.
   * @return A promise to a prepared query.
   */
  public getQuery(
    query: QueryString | QueryURL,
    options?: ParseOptions
  ): Promise<PreparedQuery> {
    return this.loadQuery(query, options).getPreparedQuery();
  }

  // TODO Consider formalizing this. Perhaps as a `withQuery` method,
  //      as well as a `PreparedQuery.fromQueryDefinition` if we choose to expose
  //      `InternalQuery` to the world formally. For now, this should only
  //      be used in tests.
  public _loadQueryFromQueryDef(
    query: InternalQuery,
    options?: CompileQueryOptions
  ): QueryMaterializer {
    return this.makeQueryMaterializer(
      async () => {
        const model = await this.materialize();
        return new PreparedQuery(query, model, model.problems);
      },
      {
        ...this.compileQueryOptions,
        ...options,
      }
    );
  }

  /**
   * Load an explore contained within this loaded `Model` by name.
   *
   * @param name The name of the explore contained within this loaded `Model`.
   * @return An `ExploreMaterializer` capable of materializing the requested explore,
   * or loading further related objects.
   */
  public loadExploreByName(name: string): ExploreMaterializer {
    return this.makeExploreMaterializer(async () => {
      return (await this.materialize()).getExploreByName(name);
    }, this.compileQueryOptions);
  }

  /**
   * Materialize an explore contained within this loaded `Model` by its name.
   *
   * @param query The name of an explore within this loaded `Model`.
   * @return A promise to an explore.
   */
  public getExploreByName(name: string): Promise<Explore> {
    return this.loadExploreByName(name).getExplore();
  }

  /**
   * Compile and materialize this loaded `Model`.
   *
   * @return A promise to the compiled model that is loaded.
   */
  public getModel(): Promise<Model> {
    return this.materialize();
  }
}

// =============================================================================
// QueryMaterializer
// =============================================================================

function runSQLOptionsWithAnnotations(
  preparedResult: PreparedResult,
  givenOptions?: RunSQLOptions
): RunSQLOptions {
  return {
    queryAnnotation: preparedResult.annotation,
    modelAnnotation: preparedResult.modelAnnotation,
    ...givenOptions,
  };
}

/**
 * An object representing the task of loading a `Query`, capable of
 * materializing the query (via `getPreparedQuery()`) or extending the task to load
 * prepared results or run the query (via e.g. `loadPreparedResult()` or `run()`).
 */
export class QueryMaterializer extends FluentState<PreparedQuery> {
  private readonly compileQueryOptions: CompileQueryOptions | undefined;
  constructor(
    protected runtime: Runtime,
    materialize: () => Promise<PreparedQuery>,
    options?: CompileQueryOptions
  ) {
    super(runtime, materialize);
    this.compileQueryOptions = options;
  }

  /**
   * Run this loaded `Query`.
   *
   * @return The query results from running this loaded query.
   */
  async run(options?: RunSQLOptions & CompileQueryOptions): Promise<Result> {
    const connections = this.runtime.connections;
    const preparedResult = await this.getPreparedResult(options);
    const finalOptions = runSQLOptionsWithAnnotations(preparedResult, options);
    return Malloy.run({connections, preparedResult, options: finalOptions});
  }

  async *runStream(
    options?: RunSQLOptions & CompileQueryOptions
  ): AsyncIterableIterator<DataRecord> {
    const preparedResult = await this.getPreparedResult(options);
    const connections = this.runtime.connections;
    const finalOptions = runSQLOptionsWithAnnotations(preparedResult, options);
    const stream = Malloy.runStream({
      connections,
      preparedResult,
      options: finalOptions,
    });
    for await (const row of stream) {
      yield row;
    }
  }

  /**
   * Load the prepared result of this loaded query.
   *
   * @return A `PreparedResultMaterializer` capable of materializing the requested
   * prepared query or running it.
   */
  public loadPreparedResult(
    options?: CompileQueryOptions
  ): PreparedResultMaterializer {
    return this.makePreparedResultMaterializer(async () => {
      const preparedQuery = await this.materialize();
      const mergedOptions: CompileQueryOptions = {
        eventStream: this.eventStream,
        ...this.compileQueryOptions,
        ...options,
      };

      // Use manifest from options if provided, otherwise fall back to
      // Runtime's manifest (explicit or lazily-read from config.manifestURL).
      // Pass EMPTY_BUILD_MANIFEST in options to explicitly suppress manifest substitution.
      const explicitManifest = mergedOptions.buildManifest !== undefined;
      let buildManifest =
        mergedOptions.buildManifest ??
        (await this.runtime._resolveBuildManifest());

      // If we have a manifest with entries, compute connectionDigests for lookups.
      // TODO: This is inefficient - we call getBuildPlan just to find connection names.
      // Consider adding a listConnections() method to LookupConnection, or caching this.
      let connectionDigests: Record<string, string> | undefined;
      if (
        buildManifest &&
        Object.keys(buildManifest.entries).length === 0 &&
        !buildManifest.strict
      ) {
        // Empty non-strict manifest — nothing to substitute, skip persistence checks
        buildManifest = undefined;
      }
      if (buildManifest) {
        const modelTag = preparedQuery.model.tagParse({prefix: /^##! /}).tag;
        if (!modelTag.has('experimental', 'persistence')) {
          if (explicitManifest) {
            // Explicitly passed non-empty manifest requires persistence support
            throw new Error(
              'Model must have ##! experimental.persistence to use buildManifest'
            );
          }
          // Runtime-level manifest (e.g. from config): silently ignore
          buildManifest = undefined;
        }
      }
      if (buildManifest) {
        const plan = preparedQuery.model.getBuildPlan();
        const connectionNames = new Set(
          Object.values(plan.sources).map(s => s.connectionName)
        );
        connectionDigests = mkSafeRecord();
        for (const connName of connectionNames) {
          const conn =
            await this.runtime.connections.lookupConnection(connName);
          connectionDigests[connName] = conn.getDigest();
        }
      }

      // Use virtualMap from options if provided, otherwise fall back to Runtime's.
      const virtualMap = mergedOptions.virtualMap ?? this.runtime.virtualMap;

      // Per-query supply for a finalized given is rejected at API entry
      // — the finalized-givens set is the runtime's "this can't be
      // overridden by the caller" guarantee. Fail before any IO so misuse
      // is loud.
      const finalizedSet = this.runtime._finalizedGivens;
      if (finalizedSet.size > 0 && mergedOptions.givens) {
        for (const name of Object.keys(mergedOptions.givens)) {
          if (finalizedSet.has(name)) {
            throw new Error(
              `Cannot supply '${name}' per-query: it is finalized at the runtime layer (config.finalizeGivens).`
            );
          }
        }
      }

      // Three layers of givens, merged per-key in precedence order:
      //   1. config.givensURL file (lazy + cached)
      //   2. Runtime constructor `givens:` option
      //   3. Per-query supply via `.run({givens: ...})`
      // Higher-numbered layers win on collision. Each layer is optional;
      // the merge collapses to undefined when all three are absent.
      const fileGivens = await this.runtime._resolveGivens();
      const constructorGivens = mapToRecord(this.runtime._constructorGivens);
      const haveAny = fileGivens || constructorGivens || mergedOptions.givens;
      const mergedGivens = haveAny
        ? {...fileGivens, ...constructorGivens, ...mergedOptions.givens}
        : undefined;

      // Query-scoped validation: of the givens THIS query references,
      // any that are finalized must have a value somewhere (file or
      // constructor). One config covers a project; individual files
      // declare overlapping but distinct given sets; an unrelated query
      // shouldn't fail because some other file's given is in the
      // finalize list without a value. The per-query rejection above is
      // the actual security primitive; this check is the sanity net for
      // "you locked it but forgot to supply it."
      const queryGivenUsage = preparedQuery._query.givenUsage ?? [];
      if (finalizedSet.size > 0 && queryGivenUsage.length > 0) {
        const referencedIds = new Set(queryGivenUsage.map(g => g.id));
        const missing: string[] = [];
        for (const [surfaceName, entry] of Object.entries(
          preparedQuery._modelDef.contents
        )) {
          if (entry.type !== 'given') continue;
          if (!referencedIds.has(entry.id)) continue;
          if (!finalizedSet.has(surfaceName)) continue;
          if (mergedGivens && surfaceName in mergedGivens) continue;
          missing.push(surfaceName);
        }
        if (missing.length > 0) {
          throw new Error(
            `Query references finalized given(s) with no resolved value: ${missing.join(', ')}. Each finalized given the query needs must have a value in givensPath or in the Runtime constructor's \`givens\`.`
          );
        }
      }

      // Build PrepareResultOptions from CompileQueryOptions + connectionDigests.
      const prepareResultOptions: PrepareResultOptions = {
        defaultRowLimit: mergedOptions.defaultRowLimit,
        buildManifest,
        connectionDigests,
        virtualMap,
      };

      return preparedQuery.getPreparedResult({
        ...mergedOptions,
        ...prepareResultOptions,
        givens: mergedGivens,
      });
    });
  }

  /**
   * Materialize the prepared result of this loaded query.
   *
   * @return A promise of the prepared result of this loaded query.
   */
  public getPreparedResult(
    options?: CompileQueryOptions
  ): Promise<PreparedResult> {
    return this.loadPreparedResult(options).getPreparedResult();
  }

  /**
   * Materialize the SQL of this loaded query.
   *
   * @return A promise of the SQL string.
   */
  public async getSQL(options?: CompileQueryOptions): Promise<string> {
    return (await this.getPreparedResult(options)).sql;
  }

  /**
   * Materialize this loaded query.
   *
   * @return A promise of the `PreparedQuery`.
   */
  public getPreparedQuery(): Promise<PreparedQuery> {
    return this.materialize();
  }

  /**
   * Estimates the cost of this loaded `Query`.
   *
   * @return The estimated cost of running this loaded query.
   */
  public async estimateQueryCost(
    options?: CompileQueryOptions
  ): Promise<QueryRunStats> {
    const connections = this.runtime.connections;
    const preparedResult = await this.getPreparedResult(options);
    return Malloy.estimateQueryCost({connections, preparedResult});
  }

  get eventStream(): EventStream | undefined {
    return this.runtime.eventStream;
  }
}

// =============================================================================
// PreparedResultMaterializer
// =============================================================================

/**
 * An object representing the task of loading a `PreparedResult`, capable of
 * materializing the prepared result (via `getPreparedResult()`) or extending the task run
 * the query.
 */
export class PreparedResultMaterializer extends FluentState<PreparedResult> {
  /**
   * Run this prepared result.
   *
   * @return A promise to the query result data.
   */
  async run(options?: RunSQLOptions): Promise<Result> {
    const preparedResult = await this.getPreparedResult();
    const connections = this.runtime.connections;
    const finalOptions = runSQLOptionsWithAnnotations(preparedResult, options);
    return Malloy.run({
      connections,
      preparedResult,
      options: finalOptions,
    });
  }

  async *runStream(options?: {
    rowLimit?: number;
  }): AsyncIterableIterator<DataRecord> {
    const preparedResult = await this.getPreparedResult();
    const connections = this.runtime.connections;
    const finalOptions = runSQLOptionsWithAnnotations(preparedResult, options);
    const stream = Malloy.runStream({
      connections,
      preparedResult,
      options: finalOptions,
    });
    for await (const row of stream) {
      yield row;
    }
  }

  /**
   * Materialize this loaded prepared result.
   *
   * @return A promise of a prepared result.
   */
  public getPreparedResult(): Promise<PreparedResult> {
    return this.materialize();
  }

  /**
   * Materialize the SQL of this loaded prepared result.
   *
   * @return A promise to the SQL string.
   */
  public async getSQL(): Promise<string> {
    return (await this.getPreparedResult()).sql;
  }
}

// =============================================================================
// ExploreMaterializer
// =============================================================================

/**
 * An object representing the task of loading an `Explore`, capable of
 * materializing the explore (via `getExplore()`) or extending the task to produce
 * related queries.
 */
export class ExploreMaterializer extends FluentState<Explore> {
  private readonly compileQueryOptions: CompileQueryOptions | undefined;
  constructor(
    protected runtime: Runtime,
    materialize: () => Promise<Explore>,
    options?: CompileQueryOptions
  ) {
    super(runtime, materialize);
    this.compileQueryOptions = options;
  }

  /**
   * Load a query contained within this loaded explore.
   *
   * @param name The name of the query to load.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByName(
    name: string,
    options?: CompileQueryOptions
  ): QueryMaterializer {
    return this.makeQueryMaterializer(
      async () => {
        return (await this.materialize()).getQueryByName(name);
      },
      {...this.compileQueryOptions, ...options}
    );
  }

  /**
   * Materialize a query contained within this loaded explore.
   *
   * @param name The name of the query to materialize.
   * @return A promise to the requested prepared query.
   */
  public getQueryByName(name: string): Promise<PreparedQuery> {
    return this.loadQueryByName(name).getPreparedQuery();
  }

  /**
   * Materialize this loaded explore.
   *
   * @return A promise to the compiled `Explore`.
   */
  public getExplore(): Promise<Explore> {
    return this.materialize();
  }
}

/**
 * Structural check for the `BuildManifest` shape: a non-null object with an
 * object `entries` field. Doesn't validate every entry — `BuildManifestEntry`
 * is just `{tableName: string}`, so a stricter walk could come later if we
 * find malformed entries causing trouble. The current goal is to fail
 * cleanly on a manifest file that parsed to a string/array/null instead of
 * leaving a downstream `entries[buildId]` lookup to crash on `undefined`.
 */
function isBuildManifestShape(value: unknown): value is BuildManifest {
  if (typeof value !== 'object' || value === null) return false;
  const entries = (value as {entries?: unknown}).entries;
  return typeof entries === 'object' && entries !== null;
}

/**
 * Shallow shape-check for the givens-values file: must be a non-array
 * non-null object. Per-value type checking happens later when each
 * declared given is bound via `resolveSuppliedGivens` — at this layer we
 * only ensure the top-level shape is a name → value map.
 */
function isGivensObject(value: unknown): value is Record<string, GivenValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Convert a non-empty `ReadonlyMap` into a plain object for spread-merging
 * with other given layers. Returns `undefined` for an empty map so the
 * merge can short-circuit when all layers are absent.
 */
function mapToRecord(
  m: ReadonlyMap<string, GivenValue>
): Record<string, GivenValue> | undefined {
  if (m.size === 0) return undefined;
  return Object.fromEntries(m);
}
