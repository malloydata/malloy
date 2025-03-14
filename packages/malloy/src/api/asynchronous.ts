/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';
import type {InfoConnection, Connection, LookupConnection} from './connection';
import type {URLReader} from '../runtime_types';
import type {CacheManager} from '../malloy';

async function fetchNeeds(
  needs: Malloy.CompilerNeeds | undefined,
  fetchers: CompilerNeedFetch<InfoConnection>
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

export interface CompilerNeedFetch<T extends InfoConnection> {
  connections: LookupConnection<T>;
  urls: URLReader;
  cacheManager?: CacheManager;
}

export async function compileModel(
  request: Malloy.CompileModelRequest,
  fetchers: CompilerNeedFetch<InfoConnection>
): Promise<Malloy.CompileModelResponse> {
  const state = Core.newCompileModelState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileModel(state);
    if (result.model || Core.hasErrors(result.logs)) {
      return result;
    }
    const needs = await fetchNeeds(result.compiler_needs, fetchers);
    Core.updateCompileModelState(state, needs);
  }
}

export async function compileSource(
  request: Malloy.CompileSourceRequest,
  fetchers: CompilerNeedFetch<InfoConnection>
): Promise<Malloy.CompileSourceResponse> {
  const state = Core.newCompileSourceState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileSource(state, request.name);
    if (result.source || Core.hasErrors(result.logs)) {
      return result;
    }
    const needs = await fetchNeeds(result.compiler_needs, fetchers);
    Core.updateCompileModelState(state, needs);
  }
}

export async function compileQuery(
  request: Malloy.CompileQueryRequest,
  fetchers: CompilerNeedFetch<InfoConnection>
): Promise<Malloy.CompileQueryResponse> {
  const state = Core.newCompileQueryState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileQuery(state);
    if (result.result || Core.hasErrors(result.logs)) {
      return result;
    }
    const needs = await fetchNeeds(result.compiler_needs, fetchers);
    Core.updateCompileModelState(state, needs);
  }
}

export async function runQuery(
  request: Malloy.CompileQueryRequest,
  fetchers: CompilerNeedFetch<Connection>
): Promise<Malloy.CompileQueryResponse> {
  const compiled = await compileQuery(request, fetchers);
  if (compiled.result === undefined) {
    return compiled;
  }
  const defaultURL = request.model_url;
  if (compiled.result.sql === undefined) {
    return {
      logs: [
        ...(compiled.logs ?? []),
        {
          url: defaultURL,
          severity: 'error',
          message: 'Internal error: Compiler did not generate SQL',
          range: Core.DEFAULT_LOG_RANGE,
        },
      ],
    };
  }
  try {
    const connection = await fetchers.connections.lookupConnection(
      compiled.result.connection_name
    );
    const data = await connection.runSQL(
      compiled.result.sql,
      compiled.result.schema
    );
    return {
      ...compiled,
      result: {
        ...compiled.result,
        data,
      },
    };
  } catch (error) {
    return {
      ...compiled,
      logs: [
        ...(compiled.logs ?? []),
        {
          url: defaultURL,
          severity: 'error',
          message: `Error running SQL: ${error.message}`,
          range: Core.DEFAULT_LOG_RANGE,
        },
      ],
    };
  }
}
