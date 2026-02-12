/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '../../lang';
import {MalloyTranslator} from '../../lang';
import type {
  Connection,
  InfoConnection,
  LookupConnection,
  FetchSchemaOptions,
} from '../../connection/types';
import type {
  ConnectionTypeDef,
  ConnectionPropertyDefinition,
  ParseConnectionsOptions,
  ConnectionsConfig,
  CreateConnectionsFromConfigOptions,
} from '../../connection/registry';
import {
  registerConnectionType as _registerConnectionType,
  getConnectionProperties as _getConnectionProperties,
  parseConnections as _parseConnections,
  getRegisteredConnectionTypes as _getRegisteredConnectionTypes,
  readConnectionsConfig as _readConnectionsConfig,
  writeConnectionsConfig as _writeConnectionsConfig,
  createConnectionsFromConfig as _createConnectionsFromConfig,
} from '../../connection/registry';
import type {
  URLReader,
  EventStream,
  InvalidationKey,
} from '../../runtime_types';
import type {SQLSourceDef, DependencyTree, QueryRunStats} from '../../model';
import {mkModelDef} from '../../model';
import {sqlKey} from '../../model/sql_block';
import type {RunSQLOptions} from '../../run_sql_options';
import {MALLOY_VERSION} from '../../version';
import type {CacheManager} from './cache';
import {readURL, getInvalidationKey, isInternalURL} from './readers';
import {Parse} from './document';
import type {ParseOptions, CompileOptions, CompileQueryOptions} from './types';
import type {PreparedResult} from './core';
import {Model, Explore} from './core';
import {Result, DataRecord} from './result';

const MALLOY_INTERNAL_URL = 'internal://internal.malloy';

// =============================================================================
// Types
// =============================================================================

type Compilable =
  | {
      url: URL;
      source?: undefined;
      parse?: undefined;
    }
  | {
      source: string;
      url?: URL;
      parse?: undefined;
    }
  | {
      parse: Parse;
      url?: URL;
      source?: undefined;
    };

export interface MalloyCompileOptions {
  url?: URL;
  source?: string;
  parse?: Parse;
  urlReader: URLReader;
  connections: LookupConnection<InfoConnection>;
  model?: Model;
  cacheManager?: CacheManager;
  refreshSchemaCache?: boolean | number;
  noThrowOnError?: boolean;
  eventStream?: EventStream;
  importBaseURL?: URL;
  testEnvironment?: boolean;
}

export interface MalloyRunOptions {
  connection?: Connection;
  preparedResult?: PreparedResult;
  sqlStruct?: SQLSourceDef;
  connections?: LookupConnection<Connection>;
  options?: RunSQLOptions;
}

// =============================================================================
// Helper Functions
// =============================================================================

function flatDeps(tree: DependencyTree): string[] {
  return [...Object.keys(tree), ...Object.values(tree).map(flatDeps).flat()];
}

// =============================================================================
// MalloyError
// =============================================================================

/**
 * A Malloy error, which may contain log messages produced during compilation.
 */
export class MalloyError extends Error {
  /**
   * An array of log messages produced during compilation.
   */
  constructor(
    message: string,
    readonly problems: LogMessage[] = []
  ) {
    super(message);
  }
}

// =============================================================================
// Malloy Static Class
// =============================================================================

export class Malloy {
  public static get version(): string {
    return MALLOY_VERSION;
  }

  /**
   * Register a connection type for use with `parseConnections()`.
   * Typically called by db-* packages on import as a side effect.
   */
  static registerConnectionType(
    typeName: string,
    def: ConnectionTypeDef
  ): void {
    _registerConnectionType(typeName, def);
  }

  /**
   * Get the property definitions for a registered connection type.
   */
  static getConnectionProperties(
    typeName: string
  ): ConnectionPropertyDefinition[] | undefined {
    return _getConnectionProperties(typeName);
  }

  /**
   * Parse a MOTLY connection config and return a LookupConnection
   * that lazily creates connections using registered type factories.
   */
  static parseConnections(
    configText: string,
    options?: ParseConnectionsOptions
  ): LookupConnection<Connection> {
    return _parseConnections(configText, options);
  }

  /**
   * Get the names of all registered connection types.
   */
  static getRegisteredConnectionTypes(): string[] {
    return _getRegisteredConnectionTypes();
  }

  /**
   * Parse a JSON config string into an editable ConnectionsConfig.
   */
  static readConnectionsConfig(jsonText: string): ConnectionsConfig {
    return _readConnectionsConfig(jsonText);
  }

  /**
   * Serialize a ConnectionsConfig to a JSON string.
   */
  static writeConnectionsConfig(config: ConnectionsConfig): string {
    return _writeConnectionsConfig(config);
  }

  /**
   * Create a LookupConnection from a ConnectionsConfig using registered factories.
   */
  static createConnectionsFromConfig(
    config: ConnectionsConfig,
    options?: CreateConnectionsFromConfigOptions
  ): LookupConnection<Connection> {
    return _createConnectionsFromConfig(config, options);
  }

  private static _parse(
    source: string,
    url?: URL,
    eventStream?: EventStream,
    options?: ParseOptions,
    invalidationKey?: InvalidationKey
  ): Parse {
    if (url === undefined) {
      url = new URL(MALLOY_INTERNAL_URL);
    }
    let importBaseURL = url;
    if (options?.importBaseURL) {
      importBaseURL = options?.importBaseURL;
    }
    const translator = new MalloyTranslator(
      url.toString(),
      importBaseURL.toString(),
      {
        urls: {[url.toString()]: source},
      },
      eventStream
    );
    if (options?.testEnvironment) {
      translator.allDialectsEnabled = true;
    }
    return new Parse(translator, invalidationKey);
  }

  /**
   * Parse a Malloy document by URL.
   *
   * @param url The URL of the Malloy document to parse.
   * @param urlReader Object capable of fetching URL contents.
   * @return A (promise of a) `Parse` result.
   */
  public static parse({
    url,
    urlReader,
    eventStream,
    options,
  }: {
    url: URL;
    urlReader: URLReader;
    eventStream?: EventStream;
    options?: ParseOptions;
  }): Promise<Parse>;
  /**
   * Parse a Malloy document by contents.
   *
   * @param url The URL of the Malloy document to parse (optional).
   * @param source The contents of the Malloy document to parse.
   * @return A `Parse` result.
   */
  public static parse({
    source,
    url,
    eventStream,
    options,
  }: {
    url?: URL;
    source: string;
    eventStream?: EventStream;
    options?: ParseOptions;
  }): Parse;
  public static parse({
    url,
    urlReader,
    source,
    eventStream,
    options,
  }: {
    url?: URL;
    source?: string;
    urlReader?: URLReader;
    eventStream?: EventStream;
    options?: ParseOptions;
  }): Parse | Promise<Parse> {
    if (source !== undefined) {
      return Malloy._parse(source, url, eventStream, options);
    } else {
      if (urlReader === undefined) {
        throw new Error('Internal Error: urlReader is required.');
      }
      if (url === undefined) {
        throw new Error(
          'Internal Error: url is required if source not present.'
        );
      }
      return readURL(urlReader, url).then(({contents, invalidationKey}) => {
        return Malloy._parse(
          contents,
          url,
          eventStream,
          options,
          invalidationKey
        );
      });
    }
  }

  /**
   * Compile a parsed Malloy document.
   *
   * @param urlReader Object capable of reading contents of a URL.
   * @param connections Mapping of connection names to objects capable of reading Malloy schemas.
   * @param parse The parsed Malloy document.
   * @param model A compiled model to build upon (optional).
   * @return A (promise of a) compiled `Model`.
   */
  public static async compile({
    url,
    source,
    parse,
    urlReader,
    connections,
    model,
    refreshSchemaCache,
    noThrowOnError,
    eventStream,
    importBaseURL,
    cacheManager,
  }: {
    urlReader: URLReader;
    connections: LookupConnection<InfoConnection>;
    model?: Model;
    cacheManager?: CacheManager;
  } & Compilable &
    CompileOptions &
    CompileQueryOptions &
    ParseOptions): Promise<Model> {
    let refreshTimestamp: number | undefined;
    if (refreshSchemaCache) {
      refreshTimestamp =
        typeof refreshSchemaCache === 'number'
          ? refreshSchemaCache
          : Date.now();
    }
    if (url === undefined && source === undefined && parse === undefined) {
      throw new Error('Internal Error: url, source, or parse required.');
    }
    if (url === undefined) {
      if (parse !== undefined) {
        url = new URL(parse._translator.sourceURL);
      } else {
        url = new URL(MALLOY_INTERNAL_URL);
      }
    }
    const invalidationKeys: {[url: string]: InvalidationKey} = {};
    // Before anything, if we have a URL and not source code, we check if that URL
    // is cached.
    if (source === undefined && cacheManager !== undefined) {
      const cached = await cacheManager.getCachedModelDef(
        urlReader,
        url.toString()
      );
      if (cached) {
        return new Model(
          cached.modelDef,
          [], // TODO when using a model from cache, should we also store the problems??
          [url.toString(), ...flatDeps(cached.modelDef.dependencies)]
        );
      }
    }
    importBaseURL ??= url;
    let translator: MalloyTranslator;
    // It's not cached, so we may need to get the actual source
    const _url = url.toString();
    if (parse !== undefined) {
      translator = parse._translator;
      const invalidationKey =
        parse._invalidationKey ?? (await getInvalidationKey(urlReader, url));
      invalidationKeys[_url] = invalidationKey;
    } else {
      if (source === undefined) {
        const {contents, invalidationKey} = await readURL(urlReader, url);
        invalidationKeys[_url] = invalidationKey;
        source = contents;
      } else {
        const invalidationKey = await getInvalidationKey(urlReader, url);
        invalidationKeys[_url] = invalidationKey;
      }
      translator = new MalloyTranslator(
        _url,
        importBaseURL.toString(),
        {
          urls: {[_url]: source},
        },
        eventStream
      );
    }
    for (;;) {
      const result = translator.translate(model?._modelDef);
      if (result.final) {
        if (result.modelDef) {
          await cacheManager?.setCachedModelDef(url.toString(), {
            modelDef: result.modelDef,
            invalidationKeys,
          });
          for (const m of translator.newlyTranslatedDependencies()) {
            await cacheManager?.setCachedModelDef(m.url, {
              modelDef: m.modelDef,
              invalidationKeys,
            });
          }
          // If the model wasn't modified, create new Model with result's modelDef
          // (which has the queryList) but share the cached QueryModel from input model
          const existingQueryModel =
            !result.modelWasModified && model
              ? model.getExistingQueryModel()
              : undefined;
          return new Model(
            result.modelDef,
            result.problems || [],
            [...(model?.fromSources ?? []), ...(result.fromSources ?? [])],
            existingQueryModel
          );
        } else if (noThrowOnError) {
          const emptyModel = mkModelDef('modelDidNotCompile');
          const modelFromCompile = model?._modelDef || emptyModel;
          return new Model(modelFromCompile, result.problems || [], [
            ...(model?.fromSources ?? []),
            ...(result.fromSources ?? []),
          ]);
        } else {
          const errors = result.problems || [];
          const errText = translator.prettyErrors();
          throw new MalloyError(
            `Error(s) compiling model:\n${errText}`,
            errors
          );
        }
      } else {
        // Parse incomplete because some external information is required,
        // there might be more than one of these in a single reply ...
        if (result.urls) {
          for (const neededUrl of result.urls) {
            try {
              if (isInternalURL(neededUrl)) {
                throw new Error(
                  'In order to use relative imports, you must compile a file via a URL.'
                );
              }
              // First, check the cache
              if (cacheManager !== undefined) {
                const cached = await cacheManager.getCachedModelDef(
                  urlReader,
                  neededUrl
                );
                if (cached) {
                  for (const dependency in cached.invalidationKeys) {
                    invalidationKeys[dependency] =
                      cached.invalidationKeys[dependency];
                  }
                  translator.update({
                    translations: {[neededUrl]: cached.modelDef},
                  });
                  continue;
                }
              }
              // Otherwise, fetch the URL contents
              const {contents, invalidationKey} = await readURL(
                urlReader,
                new URL(neededUrl)
              );
              const urls = {[neededUrl]: contents};
              invalidationKeys[neededUrl] = invalidationKey;
              translator.update({urls});
            } catch (error) {
              translator.update({
                errors: {urls: {[neededUrl]: (error as Error).message}},
              });
            }
          }
        }
        const {modelAnnotation} = translator.modelAnnotation(model?._modelDef);
        if (result.tables) {
          // collect tables by connection name since there may be multiple connections
          const tablesByConnection: Map<
            string | undefined,
            Record<string, string>
          > = new Map();
          for (const tableKey in result.tables) {
            const {connectionName, tablePath} = result.tables[tableKey];

            const connectionToTablesMap =
              tablesByConnection.get(connectionName);
            if (connectionToTablesMap === undefined) {
              tablesByConnection.set(connectionName, {[tableKey]: tablePath});
            } else {
              connectionToTablesMap[tableKey] = tablePath;
            }
          }
          // iterate over connections, fetching schema for all missing tables
          for (const [connectionName, tablePathByKey] of tablesByConnection) {
            try {
              const connection =
                await connections.lookupConnection(connectionName);
              // TODO detect if the union of `Object.keys(tables)` and `Object.keys(errors)` is not the same
              //      as `Object.keys(tablePathByKey)`, i.e. that all tables are accounted for. Otherwise
              //      the translator runs into an infinite loop fetching tables.
              const {schemas: tables, errors} =
                await Malloy.safelyFetchTableSchema(
                  connection,
                  tablePathByKey,
                  {
                    refreshTimestamp,
                    modelAnnotation,
                  }
                );
              translator.update({tables, errors: {tables: errors}});
            } catch (error) {
              // There was an exception getting the connection, associate that error
              // with all its tables
              const tables = {};
              const errors: {[name: string]: string} = {};
              for (const tableKey in tablePathByKey) {
                errors[tableKey] = (error as Error).toString();
              }
              translator.update({tables, errors: {tables: errors}});
            }
          }
        }
        if (result.compileSQL) {
          // Unlike other requests, these do not come in batches
          const toCompile = result.compileSQL;
          const connectionName = toCompile.connection;
          const key = sqlKey(toCompile.connection, toCompile.selectStr);
          try {
            const conn = await connections.lookupConnection(connectionName);
            const resolved = await conn.fetchSchemaForSQLStruct(toCompile, {
              refreshTimestamp,
              modelAnnotation,
            });
            if (resolved.error) {
              translator.update({
                errors: {
                  compileSQL: {
                    [key]: resolved.error,
                  },
                },
              });
            }
            if (resolved.structDef) {
              translator.update({
                compileSQL: {[key]: resolved.structDef},
              });
            }
          } catch (error) {
            const errors: {[name: string]: string} = {};
            errors[key] = (error as Error).toString();
            translator.update({errors: {compileSQL: errors}});
          }
        }
      }
    }
  }

  /**
   * A dialect must provide a response for every table, or the translator loop
   * will never exit. Because there was a time when this happened, we throw
   * instead of looping forever, but the fix is to correct the dialect.
   */
  static async safelyFetchTableSchema(
    connection: InfoConnection,
    toFetch: Record<string, string>,
    opts: FetchSchemaOptions
  ) {
    const ret = await connection.fetchSchemaForTables(toFetch, opts);
    for (const req of Object.keys(toFetch)) {
      if (ret.schemas[req] === undefined && ret.errors[req] === undefined) {
        throw new Error(
          `Schema fetch error for ${connection.name}, no response for ${req} from ${connection.dialectName}`
        );
      }
    }
    return ret;
  }

  /**
   * Run a fully-prepared query.
   *
   * @param get A mapping from connection names to objects capable of running SQL.
   * @param preparedResult A fully-prepared query which is ready to run (a `PreparedResult`).
   * @return Query result data and associated metadata.
   */
  public static async run(params: {
    connections: LookupConnection<Connection>;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connection: Connection;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connection: Connection;
    sqlStruct: SQLSourceDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLSourceDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connection: Connection;
    sqlStruct: SQLSourceDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLSourceDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run({
    connections,
    preparedResult,
    sqlStruct,
    connection,
    options,
  }: {
    connection?: Connection;
    preparedResult?: PreparedResult;
    sqlStruct?: SQLSourceDef;
    connections?: LookupConnection<Connection>;
    options?: RunSQLOptions;
  }): Promise<Result> {
    if (!connection) {
      if (!connections) {
        throw new Error(
          'Internal Error: Connection or LookupConnection<Connection> must be provided.'
        );
      }
      const connectionName =
        sqlStruct?.connection || preparedResult?.connectionName;
      connection = await connections.lookupConnection(connectionName);
    }
    if (sqlStruct) {
      const data = await connection.runSQL(sqlStruct.selectStr);
      return new Result(
        {
          structs: [sqlStruct],
          sql: sqlStruct.selectStr,
          result: data.rows,
          totalRows: data.totalRows,
          runStats: data.runStats,
          lastStageName: sqlStruct.name,
          // TODO feature-sql-block There is no malloy code...
          malloy: '',
          connectionName: sqlStruct.connection,
          // TODO feature-sql-block There is no source explore...
          sourceExplore: '',
          sourceFilters: [],
          profilingUrl: data.profilingUrl,
        },
        mkModelDef('empty_model')
      );
    } else if (preparedResult) {
      const result = await connection.runSQL(preparedResult.sql, options);
      return new Result(
        {
          ...preparedResult._rawQuery,
          result: result.rows,
          totalRows: result.totalRows,
          runStats: result.runStats,
          profilingUrl: result.profilingUrl,
        },
        preparedResult._modelDef
      );
    } else {
      throw new Error(
        'Internal error: sqlStruct or preparedResult must be provided.'
      );
    }
  }

  public static runStream(params: {
    connections: LookupConnection<Connection>;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connection: Connection;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connection: Connection;
    sqlStruct: SQLSourceDef;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLSourceDef;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static async *runStream({
    connections,
    preparedResult,
    sqlStruct,
    connection,
    options,
  }: {
    connection?: Connection;
    preparedResult?: PreparedResult;
    sqlStruct?: SQLSourceDef;
    connections?: LookupConnection<Connection>;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord> {
    if (sqlStruct === undefined && preparedResult === undefined) {
      throw new Error(
        'Internal error: sqlBlock or preparedResult must be provided.'
      );
    }
    const connectionName =
      sqlStruct?.connection || preparedResult?.connectionName;
    if (connection === undefined) {
      if (connections === undefined) {
        throw new Error(
          'Internal Error: Connection or LookupConnection<Connection> must be provided.'
        );
      }
      connection = await connections.lookupConnection(connectionName);
    }
    // TODO is there a better way to handle this case? Just require StreamingConnections?
    if (!connection.canStream()) {
      throw new Error(`Connection '${connectionName}' cannot stream results.`);
    }
    let sql: string;
    let resultExplore: Explore;
    if (sqlStruct) {
      resultExplore = new Explore(sqlStruct);
      sql = sqlStruct.selectStr;
    } else if (preparedResult !== undefined) {
      resultExplore = preparedResult.resultExplore;
      sql = preparedResult.sql;
    } else {
      throw new Error(
        'Internal error: sqlStruct or preparedResult must be provided.'
      );
    }
    let index = 0;
    for await (const row of connection.runSQLStream(sql, options)) {
      yield new DataRecord(row, index, resultExplore, undefined, undefined);
      index += 1;
    }
  }

  public static async estimateQueryCost(params: {
    connections: LookupConnection<Connection>;
    preparedResult: PreparedResult;
  }): Promise<QueryRunStats>;
  public static async estimateQueryCost(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLSourceDef;
  }): Promise<QueryRunStats>;
  public static async estimateQueryCost({
    connections,
    preparedResult,
    sqlStruct,
  }: {
    preparedResult?: PreparedResult;
    sqlStruct?: SQLSourceDef;
    connections: LookupConnection<Connection>;
  }): Promise<QueryRunStats> {
    if (!connections) {
      throw new Error(
        'Internal Error: Connection or LookupConnection<Connection> must be provided.'
      );
    }

    const connectionName =
      sqlStruct?.connection || preparedResult?.connectionName;
    const connection = await connections.lookupConnection(connectionName);

    if (sqlStruct) {
      return await connection.estimateQueryCost(sqlStruct.selectStr);
    } else if (preparedResult) {
      return await connection.estimateQueryCost(preparedResult.sql);
    } else {
      throw new Error(
        'Internal error: sqlStruct or preparedResult must be provided.'
      );
    }
  }
}
