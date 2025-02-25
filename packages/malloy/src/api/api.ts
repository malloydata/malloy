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
  isSegmentSQL,
  mkFieldDef,
  ModelDef,
  QueryModel,
  SQLSentence,
  SQLSourceDef,
  TableSourceDef,
} from '../model';
import {modelDefToModelInfo} from '../to_stable';

function makeSQLSourceDef(sql: Malloy.SQLQuery): SQLSourceDef {
  return {
    type: 'sql_select',
    selectStr: sql.sql,
    connection: sql.connection_name,
    dialect: sql.dialect ?? '__missing_dialect__', // TODO make this an error
    fields: sql.schema ? getSchemaFields(sql.schema) : [],
    name: '', // TODO
  };
}

function makeTableSourceDef(table: Malloy.SQLTable): TableSourceDef {
  return {
    type: 'table',
    tablePath: table.name,
    connection: table.connection_name,
    dialect: table.dialect ?? '__missing_dialect__', // TODO make this an error
    fields: table.schema ? getSchemaFields(table.schema) : [],
    name: `${table.connection_name}:${table.name}`,
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
      update.tables![table.key] = makeTableSourceDef(table);
    }
    for (const sql of compilerNeeds.sql_schemas ?? []) {
      if (sql !== undefined) {
        update.compileSQL![sql.key] = makeSQLSourceDef(sql);
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
  compileSQL: {partialModel: ModelDef; sqlSentence: SQLSentence} | undefined,
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
  if (compileSQL !== undefined) {
    const block = compileSQLBlock(
      compileSQL.partialModel,
      compileSQL.sqlSentence
    );
    compilerNeeds.sql_schemas = [
      {
        sql: block.selectStr,
        connection_name: block.connection,
        key: block.name,
      },
    ];
  }
  if (urls !== undefined) {
    for (const url of urls) {
      compilerNeeds.files!.push({url});
    }
  }
  if (tables !== undefined) {
    for (const key in tables) {
      const table = tables[key];
      compilerNeeds.table_schemas!.push({
        name: table.tablePath,
        connection_name: table.connectionName ?? '__default__', // TODO do we even support default connections any more?,
        key,
      });
    }
  }
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
    const compileSQL =
      result.compileSQL && result.partialModel
        ? {partialModel: result.partialModel, sqlSentence: result.compileSQL}
        : undefined;
    const compilerNeeds = convertCompilerNeeds(
      compileSQL,
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

function compileSQLBlock(
  partialModel: ModelDef | undefined,
  toCompile: SQLSentence
): SQLSourceDef {
  let queryModel: QueryModel | undefined = undefined;
  let selectStr = '';
  let parenAlready = false;
  for (const segment of toCompile.select) {
    if (isSegmentSQL(segment)) {
      selectStr += segment.sql;
      parenAlready = segment.sql.match(/\(\s*$/) !== null;
    } else {
      // TODO catch exceptions and throw errors ...
      if (!queryModel) {
        if (!partialModel) {
          throw new Error(
            'Internal error: Partial model missing when compiling SQL block'
          );
        }
        queryModel = new QueryModel(partialModel);
      }
      const compiledSql = queryModel.compileQuery(
        segment,
        {
          defaultRowLimit: undefined,
        },
        false
      ).sql;
      selectStr += parenAlready ? compiledSql : `(${compiledSql})`;
      parenAlready = false;
    }
  }
  const {name, connection} = toCompile;
  return {
    type: 'sql_select',
    name,
    connection,
    dialect: '~no_dialect~',
    selectStr,
    fields: [],
  };
}
