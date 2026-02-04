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
import type {CacheManager} from './foundation';
import {DEFAULT_LOG_RANGE} from './util';
import {Timer} from '../timing';

async function fetchNeeds(
  needs: Malloy.CompilerNeeds | undefined,
  fetchers: CompilerNeedFetch<InfoConnection>
): Promise<{needs: Malloy.CompilerNeeds; timingInfo: Malloy.TimingInfo}> {
  const timer = new Timer('fetch_needs');
  if (needs === undefined) {
    throw new Error(
      "Expected compiler to have needs because it didn't return a result"
    );
  }
  const result: Malloy.CompilerNeeds = {};
  if (needs.connections) {
    for (const connection of needs.connections) {
      const t = new Timer('lookup_connection');
      const info = await fetchers.connections.lookupConnection(connection.name);
      timer.contribute([t.stop()]);
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
      const t = new Timer('read_url');
      const info = await fetchers.urls.readURL(new URL(file.url));
      timer.contribute([t.stop()]);
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
      const t1 = new Timer('lookup_connection');
      const connection =
        await fetchers.connections.lookupConnection(connectionName);
      timer.contribute([t1.stop()]);
      const tableNames = tableSchemasByConnection[connectionName].map(
        t => t.name
      );
      const t2 = new Timer('fetch_table_schemas');
      const schemas = await Promise.all(
        tableNames.map(async tableName => ({
          name: tableName,
          schema: await connection.fetchSchemaForTable(tableName),
        }))
      );
      timer.contribute([t2.stop()]);
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
      const t1 = new Timer('lookup_connection');
      const connection =
        await fetchers.connections.lookupConnection(connectionName);
      timer.contribute([t1.stop()]);
      const sqlQueries = sqlSchemasByConnectionName[connectionName].map(
        t => t.sql
      );
      const t2 = new Timer('lookup_sql_schemas');
      const schemas = await Promise.all(
        sqlQueries.map(async sql => ({
          sql,
          schema: await connection.fetchSchemaForSQLQuery(sql),
        }))
      );
      timer.contribute([t2.stop()]);
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
  return {needs: result, timingInfo: timer.stop()};
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
  const timer = new Timer('compile_model');
  const state = Core.newCompileModelState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileModel(state);
    timer.incorporate(result.timing_info);
    if (result.model || Core.hasErrors(result.logs)) {
      return {...result, timing_info: timer.stop()};
    }
    const {needs, timingInfo} = await fetchNeeds(
      result.compiler_needs,
      fetchers
    );
    timer.incorporate(timingInfo);
    Core.updateCompileModelState(state, needs);
  }
}

export async function compileSource(
  request: Malloy.CompileSourceRequest,
  fetchers: CompilerNeedFetch<InfoConnection>
): Promise<Malloy.CompileSourceResponse> {
  const timer = new Timer('compile_source');
  const state = Core.newCompileSourceState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileSource(state, request.name);
    timer.incorporate(result.timing_info);
    if (result.source || Core.hasErrors(result.logs)) {
      return {...result, timing_info: timer.stop()};
    }
    const {needs, timingInfo} = await fetchNeeds(
      result.compiler_needs,
      fetchers
    );
    timer.incorporate(timingInfo);
    Core.updateCompileModelState(state, needs);
  }
}

export async function compileQuery(
  request: Malloy.CompileQueryRequest,
  fetchers: CompilerNeedFetch<InfoConnection>
): Promise<Malloy.CompileQueryResponse> {
  const timer = new Timer('compile_query');
  const state = Core.newCompileQueryState(request);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = Core.statedCompileQuery(state);
    timer.incorporate(result.timing_info);
    if (result.result || Core.hasErrors(result.logs)) {
      return {...result, timing_info: timer.stop()};
    }
    const {needs, timingInfo} = await fetchNeeds(
      result.compiler_needs,
      fetchers
    );
    timer.incorporate(timingInfo);
    Core.updateCompileModelState(state, needs);
  }
}

export async function runQuery(
  request: Malloy.RunQueryRequest,
  fetchers: CompilerNeedFetch<Connection>
): Promise<Malloy.RunQueryResponse> {
  const timer = new Timer('run_query');
  const compiled = await compileQuery(request, fetchers);
  timer.incorporate(compiled.timing_info);
  if (compiled.result === undefined) {
    return {...compiled, timing_info: timer.stop()};
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
          range: DEFAULT_LOG_RANGE,
        },
      ],
    };
  }
  try {
    const t1 = new Timer('lookup_connection');
    const connection = await fetchers.connections.lookupConnection(
      compiled.result.connection_name
    );
    timer.contribute([t1.stop()]);
    const t2 = new Timer('run_sql');
    const data = await connection.runSQL(
      compiled.result.sql,
      compiled.result.schema
    );
    timer.contribute([t2.stop()]);
    return {
      ...compiled,
      result: {
        ...compiled.result,
        data,
      },
      timing_info: timer.stop(),
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
          range: DEFAULT_LOG_RANGE,
        },
      ],
      timing_info: timer.stop(),
    };
  }
}
