/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import type {LogMessage} from '../lang';
import {MalloyTranslator} from '../lang';
import type {ParseUpdate} from '../lang/parse-malloy';
import type {
  AtomicFieldDef,
  AtomicTypeDef,
  FieldDef,
  ModelDef,
  SQLSourceDef,
  StructDef,
  TableSourceDef,
} from '../model';
import {isSourceDef, mkFieldDef, QueryModel, refIsStructDef} from '../model';
import {modelDefToModelInfo, writeLiteralToTag} from '../to_stable';
import {sqlKey} from '../model/sql_block';
import type {SQLSourceRequest} from '../lang/translate-response';
import {annotationToTaglines} from '../annotation';
import {Tag} from '@malloydata/malloy-tag';
import {DEFAULT_LOG_RANGE, mapLogs, nodeToLiteralValue} from './util';
import {Timer} from '../timing';

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
  return {
    ...mkFieldDef(typeDef, field.name),
    annotation:
      field.annotations && field.annotations.length
        ? {
            notes: field.annotations?.map(a => ({
              text: a.value,
              // TODO correctly map the location of the annotation to the location of the table call...
              at: {
                url: '~internal~',
                range: DEFAULT_LOG_RANGE,
              },
            })),
          }
        : undefined,
  };
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
  const compilerNeeds: Malloy.CompilerNeeds = {};
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
      compilerNeeds.files ??= [];
      compilerNeeds.files.push({url});
    }
  }
  if (tables !== undefined) {
    for (const key in tables) {
      const table = tables[key];
      // TODO do we even support default connections any more?
      const connectionName = table.connectionName ?? '__default__';
      compilerNeeds.table_schemas ??= [];
      compilerNeeds.table_schemas.push({
        name: table.tablePath,
        connection_name: connectionName,
      });
      neededConnections.add(connectionName);
    }
  }
  if (neededConnections.size > 0) {
    compilerNeeds.connections = Array.from(neededConnections).map(c => ({
      name: c,
    }));
  }
  return compilerNeeds;
}

export type CompileResponse =
  | {
      model: Malloy.ModelInfo;
      modelDef: ModelDef;
      compilerNeeds?: undefined;
      logs?: LogMessage[];
      timingInfo: Malloy.TimingInfo;
    }
  | {
      model?: undefined;
      modelDef?: undefined;
      compilerNeeds: Malloy.CompilerNeeds;
      logs?: LogMessage[];
      timingInfo: Malloy.TimingInfo;
    }
  | {
      model?: undefined;
      modelDef?: undefined;
      compilerNeeds?: undefined;
      logs: LogMessage[];
      timingInfo: Malloy.TimingInfo;
    };

export function compileQuery(
  request: Malloy.CompileQueryRequest,
  state?: CompileQueryState
): Malloy.CompileQueryResponse {
  state ??= newCompileQueryState(request);
  return statedCompileQuery(state);
}

export interface CompileModelState {
  extending?: CompileModelState;
  translator: MalloyTranslator;
  done: boolean;
  hasSource: boolean;
  excludeReferences: boolean;
}

export function updateCompileModelState(
  state: CompileModelState,
  needs: Malloy.CompilerNeeds | undefined
): void {
  function performUpdate(state: CompileModelState, update: ParseUpdate) {
    state.translator.update(update);
    if (state.extending) {
      performUpdate(state.extending, update);
    }
    if (!state.hasSource) {
      state.hasSource =
        (needs?.files?.some(f => f.url === state.translator.sourceURL) ??
          false) ||
        (needs?.translations?.some(f => f.url === state.translator.sourceURL) ??
          false);
    }
  }
  const update = compilerNeedsToUpdate(needs);
  performUpdate(state, update);
}

function _newCompileModelState(
  modelURL: string,
  compilerNeeds?: Malloy.CompilerNeeds,
  extendURL?: string,
  excludeReferences = false
): CompileModelState {
  const translator = new MalloyTranslator(
    modelURL,
    null,
    compilerNeedsToUpdate(compilerNeeds)
  );
  const hasSource =
    (compilerNeeds?.files?.some(f => f.url === modelURL) ?? false) ||
    (compilerNeeds?.translations?.some(t => t.url === modelURL) ?? false);
  if (extendURL) {
    return {
      extending: _newCompileModelState(
        extendURL,
        compilerNeeds,
        undefined,
        excludeReferences
      ),
      translator,
      done: false,
      hasSource,
      excludeReferences,
    };
  } else {
    return {
      translator,
      done: false,
      hasSource,
      excludeReferences,
    };
  }
}

export function newCompileModelState(
  request: Malloy.CompileModelRequest
): CompileModelState {
  return _newCompileModelState(
    request.model_url,
    request.compiler_needs,
    request.extend_model_url,
    request.exclude_references
  );
}

export function newCompileSourceState(
  request: Malloy.CompileSourceRequest
): CompileModelState {
  return _newCompileModelState(
    request.model_url,
    request.compiler_needs,
    request.extend_model_url,
    request.exclude_references
  );
}

// function hasNeeds(needs: Malloy.CompilerNeeds | undefined): boolean {
//   if (needs === undefined) return false;
//   if (needs.files && needs.files.length > 0) return true;
//   if (needs.table_schemas && needs.table_schemas.length > 0) return true;
//   if (needs.sql_schemas && needs.sql_schemas.length > 0) return true;
//   if (needs.connections && needs.connections.length > 0) return true;
//   return false;
// }

export function statedCompileModel(
  state: CompileModelState
): Malloy.CompileModelResponse {
  return wrapResponse(_statedCompileModel(state), state.translator.sourceURL);
}

export function statedCompileSource(
  state: CompileModelState,
  name: string
): Malloy.CompileSourceResponse {
  return extractSource(
    _statedCompileModel(state),
    name,
    state.translator.sourceURL
  );
}

export function _statedCompileModel(state: CompileModelState): CompileResponse {
  const timer = new Timer('compile_model');
  let extendingModel: ModelDef | undefined = undefined;
  let extendingResult: CompileResponse | undefined = undefined;
  if (state.extending) {
    if (!state.extending.done) {
      extendingResult = _statedCompileModel(state.extending);
      timer.contribute([extendingResult.timingInfo]);
      if (!state.extending.done) {
        return {...extendingResult, timingInfo: timer.stop()};
      }
    }
    extendingModel = state.extending.translator!.modelDef;
  }
  if (!state.hasSource) {
    return {
      compilerNeeds: convertCompilerNeeds(
        undefined,
        [state.translator.sourceURL],
        undefined
      ),
      timingInfo: timer.stop(),
    };
  }

  const result = state.translator.translate(extendingModel);
  timer.incorporate(result.timingInfo);
  if (result.final) {
    state.done = true;
    const timingInfo = timer.stop();
    if (result.modelDef) {
      const model = modelDefToModelInfo(result.modelDef);
      return {
        model,
        modelDef: maybeExcludeReferences(
          result.modelDef,
          state.excludeReferences
        ),
        timingInfo,
      };
    } else {
      if (result.problems === undefined || result.problems.length === 0) {
        throw new Error('No problems found, but no model either');
      }
      return {
        logs: result.problems,
        timingInfo,
      };
    }
  } else {
    const compilerNeeds = convertCompilerNeeds(
      result.compileSQL,
      result.urls,
      result.tables
    );
    const timingInfo = timer.stop();
    return {compilerNeeds, logs: result.problems, timingInfo};
  }
}

function maybeExcludeReferences(
  modelDef: ModelDef,
  excludeReferences: boolean
): ModelDef {
  if (!excludeReferences) return modelDef;
  return {
    ...modelDef,
    references: undefined,
  };
}

function wrapResponse(
  response: CompileResponse,
  defaultURL: string
): Malloy.CompileModelResponse {
  const logs = response.logs ? mapLogs(response.logs, defaultURL) : undefined;
  if (response.compilerNeeds) {
    return {
      compiler_needs: response.compilerNeeds,
      logs,
      timing_info: response.timingInfo,
    };
  } else {
    let translations: Array<Malloy.Translation> | undefined = undefined;
    if (response.modelDef) {
      translations = [
        {
          url: defaultURL,
          compiled_model_json: JSON.stringify(response.modelDef),
        },
      ];
    }
    return {
      model: response.model,
      logs,
      translations,
      timing_info: response.timingInfo,
    };
  }
}

export function compileModel(
  request: Malloy.CompileModelRequest,
  state?: CompileModelState
): Malloy.CompileModelResponse {
  state ??= newCompileModelState(request);
  return statedCompileModel(state);
}

export function compileSource(
  request: Malloy.CompileSourceRequest
): Malloy.CompileSourceResponse {
  const state = newCompileSourceState(request);
  return statedCompileSource(state, request.name);
}

// Given the URL to a model and a name of a queryable thing, get a StableSourceDef

function extractSource(
  result: CompileResponse,
  name: string,
  defaultURL: string
): Malloy.CompileSourceResponse {
  const logs = result.logs ? mapLogs(result.logs, defaultURL) : undefined;
  if (result.model) {
    const source = result.model.entries.find(e => e.name === name);
    if (source === undefined) {
      return {
        logs: [
          ...(logs ?? []),
          {
            url: defaultURL,
            severity: 'error',
            message: `Model does not contain a source named ${name}`,
            range: DEFAULT_LOG_RANGE,
          },
        ],
        timing_info: result.timingInfo,
      };
    }
    return {source, logs, timing_info: result.timingInfo};
  } else {
    return {
      compiler_needs: result.compilerNeeds,
      logs,
      timing_info: result.timingInfo,
    };
  }
}

export function hasErrors(log: Malloy.LogMessage[] | undefined) {
  return log?.some(m => m.severity === 'error') ?? false;
}

// Given a StableQueryDef and the URL to a model, run it and return a StableResult

// Given a StableQueryDef and the URL to a model, compile it and return a StableResultDef

// Given a StableQueryDef and the URL to a model, validate it and return a list of StableErrors

// Given a URL to a model and the name of a source, run the indexing query

export interface CompileQueryState extends CompileModelState {
  defaultRowLimit?: number;
}

export function newCompileQueryState(
  request: Malloy.CompileQueryRequest
): CompileQueryState {
  const queryMalloy = Malloy.queryToMalloy(request.query);
  const needs = {
    ...(request.compiler_needs ?? {}),
  };
  const queryURL = 'internal://query.malloy';
  needs.files = [
    {
      url: queryURL,
      contents: queryMalloy,
    },
    ...(needs.files ?? []),
  ];
  return {
    ..._newCompileModelState(
      queryURL,
      needs,
      request.model_url,
      request.exclude_references
    ),
    defaultRowLimit: request.default_row_limit,
  };
}

export function statedCompileQuery(
  state: CompileQueryState
): Malloy.CompileQueryResponse {
  const timer = new Timer('compile_query');
  const result = _statedCompileModel(state);
  timer.incorporate(result.timingInfo);
  // TODO this can expose the internal URL... is there a better way to handle URL-less errors from the compiler?
  const defaultURL = state.translator.sourceURL;
  const logs = result.logs ? mapLogs(result.logs, defaultURL) : undefined;
  if (result.model) {
    const queries = result.modelDef.queryList;
    if (queries.length === 0) {
      return {
        timing_info: timer.stop(),
        logs: [
          ...(logs ?? []),
          {
            url: defaultURL,
            severity: 'error',
            message: 'Internal error: No queries found',
            range: DEFAULT_LOG_RANGE,
          },
        ],
      };
    }
    const index = queries.length - 1;
    const query = result.modelDef.queryList[index];
    const schema = result.model.anonymous_queries[index].schema;
    const annotations = result.model.anonymous_queries[index].annotations ?? [];
    try {
      const sqlTimer = new Timer('generate_sql');
      const queryModel = new QueryModel(result.modelDef);
      const translatedQuery = queryModel.compileQuery(query, {
        defaultRowLimit: state.defaultRowLimit,
      });
      timer.contribute([sqlTimer.stop()]);
      const modelAnnotations = annotationToTaglines(
        result.modelDef.annotation
      ).map(l => ({
        value: l,
      }));
      let source: StructDef;
      if (query.compositeResolvedSourceDef) {
        source = query.compositeResolvedSourceDef;
      } else {
        if (refIsStructDef(query.structRef)) {
          source = query.structRef;
        } else {
          source = result.modelDef.contents[query.structRef] as StructDef;
        }
      }

      const sourceAnnotations = annotationToTaglines(source.annotation).map(
        l => ({
          value: l,
        })
      );
      const sourceMetadataTag = Tag.withPrefix('#(malloy) ');
      sourceMetadataTag.set(['source', 'name'], translatedQuery.sourceExplore);
      const sourceArguments =
        translatedQuery.sourceArguments ??
        (isSourceDef(source) ? source.arguments : undefined);
      if (sourceArguments) {
        const args = Object.entries(sourceArguments);
        for (let i = 0; i < args.length; i++) {
          const [name, value] = args[i];
          const literal: Malloy.LiteralValue | undefined = nodeToLiteralValue(
            value.value
          );
          if (literal !== undefined) {
            writeLiteralToTag(
              sourceMetadataTag,
              ['source', 'parameters', i, 'value'],
              literal
            );
          }
          sourceMetadataTag.set(['source', 'parameters', i, 'name'], name);
        }
      }
      annotations.push({
        value: sourceMetadataTag.toString(),
      });
      if (translatedQuery.queryName) {
        annotations.push({
          value: Tag.withPrefix('#(malloy) ')
            .set(['query_name'], translatedQuery.queryName)
            .toString(),
        });
      }
      const timingInfo: Malloy.TimingInfo = timer.stop();
      return {
        result: {
          sql: translatedQuery.sql,
          schema,
          connection_name: translatedQuery.connectionName,
          annotations: annotationsOrUndefined(annotations),
          model_annotations: annotationsOrUndefined(modelAnnotations),
          query_timezone: translatedQuery.queryTimezone,
          source_annotations: annotationsOrUndefined(sourceAnnotations),
        },
        default_row_limit_added: translatedQuery.defaultRowLimitAdded,
        timing_info: timingInfo,
      };
    } catch (error) {
      const timingInfo: Malloy.TimingInfo = timer.stop();
      return {
        logs: [
          ...(logs ?? []),
          {
            url: defaultURL,
            severity: 'error',
            message: `Internal compiler error: ${error.message}`,
            range: DEFAULT_LOG_RANGE,
          },
        ],
        timing_info: timingInfo,
      };
    }
  } else {
    return {
      compiler_needs: result.compilerNeeds,
      logs,
      timing_info: timer.stop(),
    };
  }
}

function annotationsOrUndefined(
  annotations: Malloy.Annotation[]
): Malloy.Annotation[] | undefined {
  return annotations.length > 0 ? annotations : undefined;
}
