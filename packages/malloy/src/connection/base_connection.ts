/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  MalloyQueryData,
  QueryRunStats,
  SQLSourceDef,
  StructDef,
  TableSourceDef,
} from '../model/malloy_types';
import {RunSQLOptions} from '../run_sql_options';
import {
  Connection,
  FetchSchemaOptions,
  PersistSQLResults,
  PooledConnection,
  StreamingConnection,
} from './types';

export interface SchemaFound<T extends StructDef> {
  schema: T;
  error?: undefined;
  expires?: number;
}
export interface SchemaNotFound {
  schema?: undefined;
  expires?: undefined;
  error: string;
}
export type CachedSchema<T extends StructDef> = SchemaFound<T> | SchemaNotFound;

export abstract class BaseConnection implements Connection {
  abstract runSQL(
    sql: string,
    options?: RunSQLOptions | undefined
  ): Promise<MalloyQueryData>;

  abstract get name(): string;

  abstract get dialectName(): string;

  /*
   * Dialects should implement fetchTableSchema and fetchSelectSchema. The
   * runtime calls fetchSchemaForTables and fetchSchemaForSQLStruct which
   * use a schema cache, and eventually call these.
   * TODO move the runtime routines out of connection and into the runtime.
   */
  abstract fetchTableSchema(
    tableName: string,
    tablePath: string
  ): Promise<TableSourceDef | string>;

  abstract fetchSelectSchema(
    sqlSource: SQLSourceDef
  ): Promise<SQLSourceDef | string>;

  protected schemaCache: Record<string, CachedSchema<StructDef>> = {};
  protected async checkSchemaCache<T extends StructDef>(
    schemaKey: string,
    schemaType: 'table' | 'sql_select',
    fillCache: () => Promise<T | string>,
    refreshTimestamp: number | undefined
  ): Promise<CachedSchema<T>> {
    let cached = this.schemaCache[schemaKey];
    if (!cached || (cached.expires && cached.expires > Date.now())) {
      const cacheResponse = await fillCache();
      if (typeof cacheResponse === 'string') {
        cached = {error: cacheResponse};
      } else {
        cached = {schema: cacheResponse};
      }
      cached.expires = refreshTimestamp;
      this.schemaCache[schemaKey] = cached;
    }
    if (cached.error) {
      return cached;
    }
    if (cached.schema && cached.schema.type === schemaType) {
      return {schema: cached.schema as T};
    }
    return {error: 'Wrong type found in schema cache'};
  }

  public async fetchSchemaForTables(
    missing: Record<string, string>,
    {refreshTimestamp}: FetchSchemaOptions
  ): Promise<{
    schemas: Record<string, TableSourceDef>;
    errors: Record<string, string>;
  }> {
    const schemas: Record<string, TableSourceDef> = {};
    const errors: {[name: string]: string} = {};

    for (const [tableName, tablePath] of Object.entries(missing)) {
      const inCache = await this.checkSchemaCache<TableSourceDef>(
        tablePath,
        'table',
        async () => await this.fetchTableSchema(tableName, tablePath),
        refreshTimestamp
      );
      if (inCache.schema) {
        schemas[tablePath] = inCache.schema;
      }
      if (inCache.error) {
        errors[tablePath] = inCache.error;
      }
    }
    return {schemas, errors};
  }

  public async fetchSchemaForSQLStruct(
    sqlRef: SQLSourceDef,
    {refreshTimestamp}: FetchSchemaOptions
  ): Promise<
    | {structDef: SQLSourceDef; error?: undefined}
    | {error: string; structDef?: undefined}
  > {
    const inCache = await this.checkSchemaCache<SQLSourceDef>(
      sqlRef.name,
      'sql_select',
      async () => await this.fetchSelectSchema(sqlRef),
      refreshTimestamp
    );
    if (inCache.schema) {
      return {structDef: inCache.schema};
    }
    if (inCache.error) {
      return {error: inCache.error};
    }
    return {error: 'Unknown schema fetch error'};
  }

  isPool(): this is PooledConnection {
    return false;
  }

  canPersist(): this is PersistSQLResults {
    return false;
  }

  canStream(): this is StreamingConnection {
    return false;
  }

  async close(): Promise<void> {}

  async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  async fetchMetadata() {
    return {};
  }

  async fetchTableMetadata(_tablePath: string) {
    return {};
  }
}
