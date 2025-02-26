/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';
import {InfoConnection, LookupConnection} from './connection';
import {URLReader} from '../runtime_types';
import {CacheManager} from '../malloy';

async function fetchNeeds(
  needs: Malloy.CompilerNeeds | undefined,
  fetchers: CompilerNeedFetch
): Promise<Malloy.CompilerNeeds> {
  if (needs === undefined) {
    throw new Error(
      "Expected compiler to have needs because it didn't return a result"
    );
  }
  const result: Malloy.CompilerNeeds = {};
  if (needs.connections) {
    for (const connection of needs.connections) {
      const info = await fetchers.connections.lookupConnection(connection.name);
      result.connections ??= [];
      result.connections.push({
        ...connection,
        dialect: info.dialectName,
      });
    }
  }
  if (needs.files) {
    for (const file of needs.files) {
      // TODO handle checking if the cache has the file...
      const info = await fetchers.urls.readURL(new URL(file.url));
      result.files ??= [];
      if (typeof info === 'string') {
        result.files.push({
          ...file,
          contents: info,
        });
      } else {
        result.files.push({
          ...file,
          contents: info.contents,
          invalidation_key: info.invalidationKey?.toString(),
        });
      }
    }
  }
  if (needs.table_schemas) {
    const tableSchemasByConnection: {
      [connectionName: string]: Malloy.SQLTable[];
    } = {};
    for (const tableSchema of needs.table_schemas) {
      tableSchemasByConnection[tableSchema.connection_name] ??= [];
      tableSchemasByConnection[tableSchema.connection_name].push(tableSchema);
    }
    for (const connectionName in tableSchemasByConnection) {
      const connection =
        await fetchers.connections.lookupConnection(connectionName);
      const tableNames = tableSchemasByConnection[connectionName].map(
        t => t.name
      );
      const schemas = await Promise.all(
        tableNames.map(async tableName => ({
          name: tableName,
          schema: await connection.fetchSchemaForTable(tableName),
        }))
      );
      result.table_schemas ??= [];
      for (const schema of schemas) {
        result.table_schemas.push({
          connection_name: connectionName,
          name: schema.name,
          schema: schema.schema,
        });
      }
    }
  }
  if (needs.sql_schemas) {
    const sqlSchemasByConnectionName: {
      [connectionName: string]: Malloy.SQLQuery[];
    } = {};
    for (const sqlSchema of needs.sql_schemas) {
      sqlSchemasByConnectionName[sqlSchema.connection_name] ??= [];
      sqlSchemasByConnectionName[sqlSchema.connection_name].push(sqlSchema);
    }
    for (const connectionName in sqlSchemasByConnectionName) {
      const connection =
        await fetchers.connections.lookupConnection(connectionName);
      const sqlQueries = sqlSchemasByConnectionName[connectionName].map(
        t => t.sql
      );
      const schemas = await Promise.all(
        sqlQueries.map(async sql => ({
          sql,
          schema: await connection.fetchSchemaForSQLQuery(sql),
        }))
      );
      result.sql_schemas ??= [];
      for (const schema of schemas) {
        result.sql_schemas.push({
          connection_name: connectionName,
          sql: schema.sql,
          schema: schema.schema,
        });
      }
    }
  }
  return result;
}

export interface CompilerNeedFetch {
  connections: LookupConnection<InfoConnection>;
  urls: URLReader;
  cacheManager?: CacheManager;
}

export async function compileModel(
  request: Malloy.CompileModelRequest,
  fetchers: CompilerNeedFetch
): Promise<Malloy.CompileModelResponse> {
  const state = Core.newCompileModelState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileModel(state);
    if (result.model) {
      return result;
    }
    const needs = await fetchNeeds(result.compiler_needs, fetchers);
    Core.updateCompileModelState(state, needs);
  }
}

export async function compileSource(
  request: Malloy.CompileSourceRequest
): Promise<Malloy.CompileSourceResponse> {
  return Core.compileSource(request);
}

export async function compileQuery(
  request: Malloy.CompileQueryRequest
): Promise<Malloy.CompileQueryResponse> {
  return Core.compileQuery(request);
}
