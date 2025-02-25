/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import {MalloyTranslator} from '../lang';
import {ParseUpdate} from '../lang/parse-malloy';
import {
  AtomicFieldDef,
  AtomicTypeDef,
  FieldDef,
  mkFieldDef,
  ModelDef,
  QueryModel,
  SQLSourceDef,
  TableSourceDef,
} from '../model';
import {modelDefToModelInfo} from '../to_stable';
import {sqlKey} from '../model/sql_block';
import {SQLSourceRequest} from '../lang/translate-response';

// TODO find where this should go...
function tableKey(connectionName: string, tablePath: string): string {
  return `${connectionName}:${tablePath}`;
}

function makeSQLSourceDef(sql: Malloy.SQLQuery, dialect: string): SQLSourceDef {
  return {
    type: 'sql_select',
    selectStr: sql.sql,
    connection: sql.connection_name,
    dialect: dialect,
    fields: sql.schema ? getSchemaFields(sql.schema) : [],
    name: sqlKey(sql.connection_name, sql.sql),
  };
}

function makeTableSourceDef(
  table: Malloy.SQLTable,
  dialect: string
): TableSourceDef {
  return {
    type: 'table',
    tablePath: table.name,
    connection: table.connection_name,
    dialect: dialect,
    fields: table.schema ? getSchemaFields(table.schema) : [],
    name: tableKey(table.connection_name, table.name),
  };
}

function convertNumberSubtype(
  subtype?: Malloy.NumberSubtype
): 'float' | 'integer' | undefined {
  if (subtype === undefined) return undefined;
  if (subtype === 'decimal') return 'float';
  return 'integer';
}

function typeDefFromField(type: Malloy.AtomicType): AtomicTypeDef {
  switch (type.kind) {
    case 'string_type':
      return {type: 'string'};
    case 'number_type':
      return {type: 'number', numberType: convertNumberSubtype(type.subtype)};
    case 'boolean_type':
      return {type: 'boolean'};
    case 'timestamp_type':
      return {type: 'timestamp', timeframe: type.timeframe};
    case 'date_type':
      return {type: 'date', timeframe: type.timeframe};
    case 'sql_native_type':
      return {type: 'sql native', rawType: type.sql_type};
    case 'json_type':
      return {type: 'json'};
    case 'array_type': {
      if (type.element_type.kind === 'record_type') {
        return {
          type: 'array',
          elementTypeDef: {type: 'record_element'},
          fields: type.element_type.fields.map(convertDimension),
        };
      } else {
        const elementTypeDef = typeDefFromField(type.element_type);
        if (elementTypeDef.type === 'record') {
          throw new Error('Arrays of records should be a repeated record type');
        }
        return {
          type: 'array',
          elementTypeDef,
        };
      }
    }
    case 'record_type':
      return {type: 'record', fields: type.fields.map(convertDimension)};
  }
}

function convertDimension(field: Malloy.DimensionInfo): AtomicFieldDef {
  const typeDef = typeDefFromField(field.type);
  return mkFieldDef(typeDef, field.name);
}

function convertTableField(field: Malloy.FieldInfo): AtomicFieldDef {
  if (field.kind !== 'dimension') {
    throw new Error('Table schemas must only have dimension fields');
  }
  return convertDimension(field);
}

function getSchemaFields(schema: Malloy.Schema): FieldDef[] {
  const fields: FieldDef[] = [];
  for (const field of schema.fields) {
    fields.push(convertTableField(field));
  }
  return fields;
}

function compilerNeedsToUpdate(
  compilerNeeds?: Malloy.CompilerNeeds
): ParseUpdate {
  const update: ParseUpdate = {
    urls: {},
    tables: {},
    compileSQL: {},
    translations: {},
  };
  if (compilerNeeds) {
    for (const file of compilerNeeds.files ?? []) {
      if (file.contents !== undefined) {
        update.urls![file.url] = file.contents;
      }
    }
    for (const table of compilerNeeds.table_schemas ?? []) {
      const connection = compilerNeeds.connections?.find(
        c => c.name === table.connection_name
      );
      if (connection && table.schema && connection.dialect) {
        update.tables![tableKey(table.connection_name, table.name)] =
          makeTableSourceDef(table, connection.dialect);
      }
    }
    for (const sql of compilerNeeds.sql_schemas ?? []) {
      const connection = compilerNeeds.connections?.find(
        c => c.name === sql.connection_name
      );
      if (connection && connection.dialect) {
        update.compileSQL![sqlKey(sql.connection_name, sql.sql)] =
          makeSQLSourceDef(sql, connection.dialect);
      }
    }
    for (const translation of compilerNeeds.translations ?? []) {
      if (translation.compiled_model_json) {
        const modelDef = JSON.parse(translation.compiled_model_json);
        update.translations![translation.url] = modelDef;
      }
    }
  }
  return update;
}

function convertCompilerNeeds(
  compileSQL: SQLSourceRequest | undefined,
  urls: string[] | undefined,
  tables:
    | Record<
        string,
        {
          connectionName: string | undefined;
          tablePath: string;
        }
      >
    | undefined
): Malloy.CompilerNeeds {
  const compilerNeeds: Malloy.CompilerNeeds = {
    files: [],
    table_schemas: [],
  };
  const neededConnections = new Set<string>();
  if (compileSQL !== undefined) {
    compilerNeeds.sql_schemas = [
      {
        sql: compileSQL.selectStr,
        connection_name: compileSQL.connection,
      },
    ];
    neededConnections.add(compileSQL.connection);
  }
  if (urls !== undefined) {
    for (const url of urls) {
      compilerNeeds.files!.push({url});
    }
  }
  if (tables !== undefined) {
    for (const key in tables) {
      const table = tables[key];
      // TODO do we even support default connections any more?
      const connectionName = table.connectionName ?? '__default__';
      compilerNeeds.table_schemas!.push({
        name: table.tablePath,
        connection_name: connectionName,
      });
      neededConnections.add(connectionName);
    }
  }
  compilerNeeds.connections = Array.from(neededConnections).map(c => ({
    name: c,
  }));
  return compilerNeeds;
}

function compile(
  modelURL: string,
  compilerNeeds?: Malloy.CompilerNeeds,
  extendURL?: string
):
  | {
      model: Malloy.ModelInfo;
      modelDef: ModelDef;
      compilerNeeds?: undefined;
    }
  | {
      model?: undefined;
      modelDef?: undefined;
      compilerNeeds: Malloy.CompilerNeeds;
    } {
  let extendingModel: ModelDef | undefined;
  if (extendURL) {
    const extendResult = compile(extendURL, compilerNeeds);
    if (extendResult.modelDef) {
      extendingModel = extendResult.modelDef;
    } else {
      return extendResult;
    }
  }
  const translator = new MalloyTranslator(
    modelURL,
    null,
    compilerNeedsToUpdate(compilerNeeds)
  );
  const result = translator.translate(extendingModel);
  if (result.final) {
    if (result.modelDef) {
      return {
        model: modelDefToModelInfo(result.modelDef),
        modelDef: result.modelDef,
      };
    } else {
      if (result.problems === undefined || result.problems.length === 0) {
        throw new Error('No problems found, but no model either');
      }
      // TODO return an error...
      throw new Error(result.problems[0].message);
    }
  } else {
    const compilerNeeds = convertCompilerNeeds(
      result.compileSQL,
      result.urls,
      result.tables
    );
    return {compilerNeeds};
  }
}

// Given the URL to a model, return the StableModelDef for that model

export function compileModel(
  request: Malloy.CompileModelRequest
): Malloy.CompileModelResponse {
  return compile(request.model_url, request.compiler_needs);
}

// Given the URL to a model and a name of a queryable thing, get a StableSourceDef

export function compileSource(
  request: Malloy.CompileSourceRequest
): Malloy.CompileSourceResponse {
  const result = compile(request.model_url, request.compiler_needs);
  if (result.model) {
    const source = result.model.entries.find(e => e.name === request.name);
    if (source === undefined) {
      // TODO decide how to actually respond with an error?
      throw new Error('Source not found');
    }
    return {source};
  } else {
    return {compiler_needs: result.compilerNeeds};
  }
}

// Given a StableQueryDef and the URL to a model, run it and return a StableResult

// Given a StableQueryDef and the URL to a model, compile it and return a StableResultDef

export function compileQuery(
  request: Malloy.CompileQueryRequest
): Malloy.CompileQueryResponse {
  const queryMalloy = Malloy.queryToMalloy(request.query);
  const needs = {
    ...request.compiler_needs,
  };
  const queryURL = 'internal://query.malloy';
  needs.files = [
    {
      url: queryURL,
      contents: queryMalloy,
    },
    ...(needs.files ?? []),
  ];
  const result = compile(queryURL, needs, request.model_url);
  if (result.model) {
    const queries = result.modelDef.queryList;
    if (queries.length === 0) {
      throw new Error('No queries found');
    }
    const index = queries.length - 1;
    const query = result.modelDef.queryList[index];
    const schema = result.model.anonymous_queries[index].schema;
    const queryModel = new QueryModel(result.modelDef);
    const translatedQuery = queryModel.compileQuery(query);
    return {
      result: {
        sql: translatedQuery.sql,
        schema,
      },
    };
  } else {
    return {compiler_needs: result.compilerNeeds};
  }
}

// Given a StableQueryDef and the URL to a model, validate it and return a list of StableErrors

// Given a URL to a model and the name of a source, run the indexing query
