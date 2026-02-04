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
} from '../../model';
import {isSourceDef} from '../../model';
import {getDialect} from '../../dialect';
import type {Dialect} from '../../dialect';
import type {RunSQLOptions} from '../../run_sql_options';
import {rowDataToNumber} from '../../api/row_data_utils';
import type {CacheManager} from './cache';
import {EmptyURLReader, FixedConnectionMap} from './readers';
import type {ParseOptions, CompileOptions, CompileQueryOptions} from './types';
import type {PreparedResult, Explore, NamedQuery} from './core';
import {Model, PreparedQuery} from './core';
import type {DataRecord, Result} from './result';
// Note: compile.ts will call setMalloyFunctions to wire up the circular dependency

// Forward declaration - will be set by compile.ts to avoid circular import issues
// Using any for the function types since Malloy methods have multiple overloads
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let MalloyCompile: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let MalloyRun: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let MalloyRunStream: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let MalloyEstimateQueryCost: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setMalloyFunctions(fns: {
  compile: typeof MalloyCompile;
  run: typeof MalloyRun;
  runStream: typeof MalloyRunStream;
  estimateQueryCost: typeof MalloyEstimateQueryCost;
}) {
  MalloyCompile = fns.compile;
  MalloyRun = fns.run;
  MalloyRunStream = fns.runStream;
  MalloyEstimateQueryCost = fns.estimateQueryCost;
}

// =============================================================================
// Type Aliases
// =============================================================================

type ModelURL = URL;
type ModelString = string;
type QueryURL = URL;
type QueryString = string;

type Connectionable =
  | {connection: Connection; connections?: undefined}
  | {connections: LookupConnection<Connection>; connection?: undefined};

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

  protected makeNamedQueryMaterializer(
    materialize: () => Promise<NamedQuery>,
    options?: CompileQueryOptions
  ): NamedQueryMaterializer {
    return new NamedQueryMaterializer(this.runtime, materialize, options);
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

  constructor({
    urlReader,
    connections,
    connection,
    eventStream,
    cacheManager,
  }: {
    urlReader?: URLReader;
    eventStream?: EventStream;
    cacheManager?: CacheManager;
  } & Connectionable) {
    if (connections === undefined) {
      if (connection === undefined) {
        throw new Error(
          'A LookupConnection<Connection> or Connection is required.'
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
    this._eventStream = eventStream;
    this._cacheManager = cacheManager;
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
        return MalloyCompile({
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
      },
      options
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
        return new Model(modelDef, [], []);
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
    return getDialect(this.connection.dialectName).sqlMaybeQuoteIdentifier(
      column
    );
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
      const queryModel = await MalloyCompile({
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
        const queryModel = await MalloyCompile({
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
        return queryModel;
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
    const rawResult = result._queryResult.result as unknown as {
      fieldName: string;
      cardinality: unknown;
      values: {fieldValue: string; weight: unknown}[];
    }[];
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
   * Load a named query from this loaded `Model`.
   *
   * @param name The name of the query to load.
   * @return A `NamedQueryMaterializer` capable of materializing the requested query,
   * loading its prepared result, or running it.
   */
  public getNamedQuery(
    name: string,
    options?: CompileQueryOptions
  ): NamedQueryMaterializer {
    return this.makeNamedQueryMaterializer(
      async () => {
        return (await this.materialize()).getNamedQuery(name);
      },
      {
        ...this.compileQueryOptions,
        ...options,
      }
    );
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
// NamedQueryMaterializer
// =============================================================================

/**
 * An object representing the task of loading a `NamedQuery`, capable of
 * materializing the query, loading its prepared result, or running it.
 */
export class NamedQueryMaterializer extends FluentState<NamedQuery> {
  private readonly compileQueryOptions: CompileQueryOptions | undefined;

  constructor(
    protected runtime: Runtime,
    materialize: () => Promise<NamedQuery>,
    options?: CompileQueryOptions
  ) {
    super(runtime, materialize);
    this.compileQueryOptions = options;
  }

  /**
   * Get the `NamedQuery` object.
   *
   * @return A promise to the materialized NamedQuery.
   */
  public getNamedQuery(): Promise<NamedQuery> {
    return this.materialize();
  }

  /**
   * Load the prepared result for this named query.
   *
   * @return A `QueryMaterializer` capable of running the query.
   */
  public load(options?: CompileQueryOptions): QueryMaterializer {
    return this.makeQueryMaterializer(
      async () => {
        const namedQuery = await this.materialize();
        // Convert NamedQuery to PreparedQuery for QueryMaterializer
        return new PreparedQuery(
          namedQuery._queryDef,
          namedQuery._model,
          namedQuery._model.problems,
          namedQuery.name
        );
      },
      {
        ...this.compileQueryOptions,
        ...options,
      }
    );
  }

  /**
   * Run this named query.
   *
   * @return The query results from running this query.
   */
  async run(options?: RunSQLOptions & CompileQueryOptions): Promise<Result> {
    return this.load(options).run(options);
  }

  /**
   * Run this named query and stream results.
   */
  async *runStream(
    options?: RunSQLOptions & CompileQueryOptions
  ): AsyncIterableIterator<DataRecord> {
    const materializer = this.load(options);
    for await (const row of materializer.runStream(options)) {
      yield row;
    }
  }

  /**
   * Load the prepared result of this named query.
   *
   * @return A `PreparedResultMaterializer` capable of materializing the prepared result.
   */
  public loadPreparedResult(
    options?: CompileQueryOptions
  ): PreparedResultMaterializer {
    return this.makePreparedResultMaterializer(async () => {
      const namedQuery = await this.materialize();
      const mergedOptions: CompileQueryOptions = {
        ...this.compileQueryOptions,
        ...options,
      };
      return namedQuery.getPreparedResult(mergedOptions);
    });
  }

  /**
   * Materialize the prepared result for this named query.
   *
   * @return A promise to the PreparedResult containing generated SQL.
   */
  public getPreparedResult(
    options?: CompileQueryOptions
  ): Promise<PreparedResult> {
    return this.loadPreparedResult(options).getPreparedResult();
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
    return MalloyRun({connections, preparedResult, options: finalOptions});
  }

  async *runStream(
    options?: RunSQLOptions & CompileQueryOptions
  ): AsyncIterableIterator<DataRecord> {
    const preparedResult = await this.getPreparedResult(options);
    const connections = this.runtime.connections;
    const finalOptions = runSQLOptionsWithAnnotations(preparedResult, options);
    const stream = MalloyRunStream({
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

      // If buildManifest is provided, compute connectionDigests for manifest lookups
      // TODO: This is inefficient - we call getBuildPlan just to find connection names.
      // Consider adding a listConnections() method to LookupConnection, or caching this.
      let connectionDigests: Record<string, string> | undefined;
      if (mergedOptions.buildManifest) {
        // Require experimental.persistence annotation to use buildManifest
        const modelTag = preparedQuery.model.tagParse().tag;
        if (!modelTag.has('experimental', 'persistence')) {
          throw new Error(
            'Model must have ## experimental.persistence annotation to use buildManifest'
          );
        }
        const plan = preparedQuery.model.getBuildPlan();
        const connectionNames = new Set(
          Object.values(plan.sources).map(s => s.connectionName)
        );
        connectionDigests = {};
        for (const connName of connectionNames) {
          const conn =
            await this.runtime.connections.lookupConnection(connName);
          connectionDigests[connName] = await conn.getDigest();
        }
      }

      // Build PrepareResultOptions from CompileQueryOptions + connectionDigests
      const prepareResultOptions: PrepareResultOptions = {
        defaultRowLimit: mergedOptions.defaultRowLimit,
        buildManifest: mergedOptions.buildManifest,
        connectionDigests,
        strictPersist: mergedOptions.strictPersist,
      };

      return preparedQuery.getPreparedResult({
        ...mergedOptions,
        ...prepareResultOptions,
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
    return MalloyEstimateQueryCost({connections, preparedResult});
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
    return MalloyRun({
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
    const stream = MalloyRunStream({
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
