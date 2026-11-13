/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Order matters: the globals must exist before the modules that read them
// load. ES module evaluation follows import order.
import './globals';
import './url';
import {
  API,
  DuckDBDialect,
  mkFieldDef,
  modelDefToModelInfo,
  sourceDefToSourceInfo,
} from '@malloydata/malloy';
import type {TableSourceDef} from '@malloydata/malloy';
import {compileModelCatalog, compileModelDef} from './catalog';
import type * as Malloy from '@malloydata/malloy-interfaces';

declare const __MALLOY_VERSION__: string;

/**
 * What the bundle installs as `globalThis.malloyEmbedded`.
 *
 * Every function takes a request as a JSON string and returns the response
 * as a JSON string, so a host only has to move strings across the engine
 * boundary. Requests and responses are the stable types from
 * `@malloydata/malloy-interfaces`, exactly as for `API.stateless`; see
 * CONTEXT.md for the needs loop a host runs around them.
 *
 * The compile functions never throw: an exception inside the compiler comes
 * back as a response whose `logs` holds one error. `duckdbSchema`, a pure
 * conversion, throws on input it can't read.
 */
export interface MalloyEmbedded {
  version: string;
  compileModel(requestJSON: string): string;
  compileModelContents(requestJSON: string): string;
  compileModelCatalog(requestJSON: string): string;
  compileSource(requestJSON: string): string;
  compileQuery(requestJSON: string): string;
  duckdbSchema(columnsJSON: string): string;
}

/**
 * `compileModel`, except that the finished model's `entries` list every
 * source and named query visible in the model, including imported ones,
 * not only what it exports. That is what an interactive host wants to show
 * ("what can I query?"). Named queries are listed with `kind: 'query'` and
 * their output schema; `compileModel` lists them as sources.
 */
function compileModelContents(
  request: Malloy.CompileModelRequest
): Malloy.CompileModelResponse {
  const {response, modelDef} = compileModelDef(request);
  if (!modelDef) {
    return response;
  }
  const everything = modelDefToModelInfo({
    ...modelDef,
    exports: Object.keys(modelDef.contents),
  });
  const entries = everything.entries.map(entry =>
    modelDef.contents[entry.name]?.type === 'query'
      ? {...entry, kind: 'query' as const}
      : entry
  );
  return {...response, model: {...everything, entries}};
}

function wrap<Req extends {model_url: string}, Res>(
  fn: (request: Req) => Res
): (requestJSON: string) => string {
  return (requestJSON: string) => {
    let url = 'internal://malloy-embedded';
    try {
      const request = JSON.parse(requestJSON) as Req;
      if (typeof request?.model_url === 'string') {
        url = request.model_url;
      }
      return JSON.stringify(fn(request));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const failure: {logs: Malloy.LogMessage[]} = {
        logs: [
          {
            url,
            severity: 'error',
            message,
            range: {
              start: {line: 0, character: 0},
              end: {line: 0, character: 0},
            },
          },
        ],
      };
      return JSON.stringify(failure);
    }
  };
}

const duckdbDialect = new DuckDBDialect();

// As malloy-db-duckdb's fillStructDefFromTypeMap: DESCRIBE can report a
// column name in double quotes.
function unquoteName(name: string): string {
  const match = /^"(.*)"$/.exec(name);
  return match ? match[1].replace(/""/g, '"') : name;
}

/**
 * Turns DuckDB column types into the schema the compiler's needs loop takes
 * for a table or SQL source, the same way Malloy's DuckDB connection does:
 * `columnsJSON` is `[[column_name, column_type], ...]`, as DESCRIBE reports
 * them, and the result is a `Malloy.Schema` as JSON. Types DuckDB's parser
 * here does not understand become SQL-native types.
 */
function duckdbSchema(columnsJSON: string): string {
  const columns = JSON.parse(columnsJSON) as [string, string][];
  const sourceDef: TableSourceDef = {
    type: 'table',
    name: 'columns',
    tablePath: 'columns',
    connection: 'duckdb',
    dialect: duckdbDialect.name,
    fields: columns.map(([name, type]) =>
      mkFieldDef(duckdbDialect.parseDuckDBType(type), unquoteName(name))
    ),
  };
  return JSON.stringify(sourceDefToSourceInfo(sourceDef).schema);
}

const malloyEmbedded: MalloyEmbedded = {
  version: __MALLOY_VERSION__,
  compileModel: wrap(API.stateless.compileModel),
  compileModelContents: wrap(compileModelContents),
  compileModelCatalog: wrap(compileModelCatalog),
  compileSource: wrap(API.stateless.compileSource),
  compileQuery: wrap(API.stateless.compileQuery),
  duckdbSchema,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).malloyEmbedded = malloyEmbedded;
