/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {QueryQuery} from './query_query';
import type {
  QueryResultDef,
  ModelDef,
  StructRef,
  Argument,
  Given,
  PrepareResultOptions,
  Query,
  SourceDef,
  SearchIndexResult,
  CompiledQuery,
  RefToField,
  TurtleDefPlusFilters,
  TurtleDef,
} from './malloy_types';
import {activeName, isSourceDef} from './malloy_types';
import {StageWriter} from './stage_writer';
import {
  StandardSQLDialect,
  type Dialect,
  type DialectFieldList,
  type FinalStageOrdering,
} from '../dialect';
import type {Connection} from '../connection/types';
import type {ModelRootInterface} from './query_node';
import {QueryStruct, isScalarField} from './query_node';
import type {QueryModel, QueryResults} from './query_model_contract';
import {rowDataToNumber} from '../api/row_data_utils';
import {getDialectFieldList} from './utils';
import {MalloyCompileError} from './malloy_compile_error';

export function makeQueryModel(modelDef: ModelDef | undefined): QueryModel {
  return new QueryModelImpl(modelDef);
}

export class QueryModelImpl implements QueryModel, ModelRootInterface {
  dialect: Dialect = new StandardSQLDialect();
  // dialect: Dialect = new PostgresDialect();
  modelDef: ModelDef | undefined = undefined;
  structs = new Map<string, QueryStruct>();

  get givens(): Record<string, Given> {
    return this.modelDef?.givens ?? {};
  }

  constructor(modelDef: ModelDef | undefined) {
    if (modelDef) {
      this.loadModelFromDef(modelDef);
    }
  }

  loadModelFromDef(modelDef: ModelDef): void {
    this.modelDef = modelDef;
    for (const s of Object.values(this.modelDef.contents)) {
      // Only sources become QueryStructs. query/userType/given are namespace
      // metadata, not queryable, and are skipped.
      if (isSourceDef(s)) {
        this.structs.set(
          activeName(s),
          new QueryStruct(s, undefined, {model: this}, {})
        );
      } else if (
        s.type !== 'query' &&
        s.type !== 'userType' &&
        s.type !== 'given'
      ) {
        throw new Error('Internal Error: Unknown structure type');
      }
    }
  }

  getStructByName(name: string): QueryStruct {
    const s = this.structs.get(name);
    if (s) {
      return s;
    }
    throw new MalloyCompileError(
      `Source '${name}' is not defined in this model.`,
      'compiler-undefined-source',
      undefined
    );
  }

  getStructFromRef(
    structRef: StructRef,
    sourceArguments: Record<string, Argument> | undefined,
    prepareResultOptions?: PrepareResultOptions
  ): QueryStruct {
    prepareResultOptions ??= {};
    if (typeof structRef === 'string') {
      const ret = this.getStructByName(structRef);
      return new QueryStruct(
        ret.structDef,
        sourceArguments ?? ret.sourceArguments,
        ret.parent ? {struct: ret.parent} : {model: this},
        prepareResultOptions
      );
    }
    return new QueryStruct(
      structRef,
      sourceArguments,
      {model: this},
      prepareResultOptions
    );
  }

  loadQuery(
    query: Query,
    stageWriter: StageWriter | undefined,
    prepareResultOptions?: PrepareResultOptions,
    emitFinalStage = false,
    isJoinedSubquery = false
  ): QueryResults {
    const malloy = '';

    const structRef = query.compositeResolvedSourceDef ?? query.structRef;
    const queryStruct = this.getStructFromRef(
      structRef,
      query.sourceArguments,
      prepareResultOptions
    );

    // If this query is being written as part of a SQL block don't use CTE (WITH ...)
    const noCTE =
      prepareResultOptions &&
      prepareResultOptions.isPartialQuery &&
      queryStruct.dialect.name !== 'postgres'; // postgres does weird stuff with final stages that won't work here.

    if (!stageWriter) {
      stageWriter = new StageWriter(!noCTE, undefined);
    }

    const turtleDef: TurtleDefPlusFilters = {
      type: 'turtle',
      name: 'ignoreme',
      pipeline: query.pipeline,
      filterList: query.filterList,
    };

    const q = QueryQuery.makeQuery(
      turtleDef,
      queryStruct,
      stageWriter,
      isJoinedSubquery,
      (name: string) => this.structs.get(name)
    );

    const dialect = q.parent.dialect;
    const finalStage = emitFinalStage && dialect.hasFinalStage;
    const ret = q.generateSQLFromPipeline(
      stageWriter,
      finalStage && dialect.orderByStage === 'final'
    );
    if (finalStage) {
      ret.lastStageName = stageWriter.addStage(
        dialect.sqlFinalStage(
          ret.lastStageName,
          getDialectFieldList(ret.outputStruct, dialect),
          ret.finalOrdering
        )
      );
    }
    // console.log('---', stageWriter.combineStages(true).sql, '---');
    return {
      lastStageName: ret.lastStageName,
      malloy,
      stageWriter,
      structs: [ret.outputStruct],
      connectionName: q.parent.connectionName,
    };
  }

  addDefaultRowLimit(
    query: Query,
    defaultRowLimit?: number
  ): {query: Query; addedDefaultRowLimit?: number} {
    const nope = {query, addedDefaultRowLimit: undefined};
    if (defaultRowLimit === undefined) return nope;
    const lastSegment = query.pipeline[query.pipeline.length - 1];
    if (lastSegment.type === 'raw') return nope;
    if (lastSegment.limit !== undefined) return nope;
    return {
      query: {
        ...query,
        pipeline: [
          ...query.pipeline.slice(0, -1),
          {
            ...lastSegment,
            limit: defaultRowLimit,
          },
        ],
      },
      addedDefaultRowLimit: defaultRowLimit,
    };
  }

  compileQuery(
    query: Query,
    prepareResultOptions?: PrepareResultOptions,
    finalize = true
  ): CompiledQuery {
    const addDefaultRowLimit = this.addDefaultRowLimit(
      query,
      prepareResultOptions?.defaultRowLimit
    );
    query = addDefaultRowLimit.query;
    const addedDefaultRowLimit = addDefaultRowLimit.addedDefaultRowLimit;
    const ret = this.loadQuery(
      query,
      undefined,
      prepareResultOptions,
      finalize,
      false
    );
    const structRef = query.compositeResolvedSourceDef ?? query.structRef;
    const sourceExplore =
      typeof structRef === 'string' ? structRef : activeName(structRef);
    const sourceArguments =
      query.sourceArguments ??
      (typeof structRef === 'string' ? undefined : structRef.arguments);
    // LTNote:  I don't understand why this might be here.  It should have happened in loadQuery...
    if (finalize && this.dialect.hasFinalStage) {
      ret.lastStageName = ret.stageWriter.addStage(
        // note this will be broken on duckDB waiting on a real fix.
        this.dialect.sqlFinalStage(
          ret.lastStageName,
          getDialectFieldList(ret.structs[0], this.dialect)
        )
      );
    }
    return {
      lastStageName: ret.lastStageName,
      malloy: ret.malloy,
      sql: ret.stageWriter.generateSQLStages(),
      structs: ret.structs,
      sourceExplore,
      sourceFilters: query.filterList,
      sourceArguments,
      queryName: query.name,
      connectionName: ret.connectionName,
      annotations: query.annotations,
      queryTimezone: ret.structs[0].queryTimezone,
      defaultRowLimitAdded: addedDefaultRowLimit,
    };
  }

  exploreSearchSQLMap = new Map();

  async searchIndex(
    connection: Connection,
    explore: string,
    searchValue: string,
    limit = 1000,
    searchField: string | undefined = undefined
  ): Promise<SearchIndexResult[] | undefined> {
    if (!connection.canPersist()) {
      return undefined;
    }
    // make a search index if one isn't modelled.
    const struct = this.getStructByName(explore);
    const d = struct.dialect;
    let indexStar: RefToField[] = [];
    for (const [fn, fv] of struct.nameMap) {
      if (isScalarField(fv) && fv.includeInWildcard()) {
        indexStar.push({type: 'fieldref', path: [fn]});
      }
    }
    indexStar = indexStar.sort((a, b) => a.path[0].localeCompare(b.path[0]));
    const indexStruct: QueryResultDef = {
      type: 'query_result',
      name: 'index',
      connection: struct.connectionName,
      dialect: struct.dialect.name,
      fields: [
        {name: 'fieldName', type: 'string'},
        {name: 'fieldPath', type: 'string'},
        {name: 'fieldType', type: 'string'},
        {name: 'weight', type: 'number'},
        {name: 'fieldValue', type: 'string'},
      ],
    };
    const indexQuery: Query = {
      structRef: explore,
      pipeline: [
        {
          type: 'index',
          indexFields: indexStar,
          sample: d.defaultSampling,
          outputStruct: indexStruct,
        },
      ],
    };
    const fieldNameColumn = d.sqlQuoteIdentifier('fieldName');
    const fieldPathColumn = d.sqlQuoteIdentifier('fieldPath');
    const fieldValueColumn = d.sqlQuoteIdentifier('fieldValue');
    const fieldTypeColumn = d.sqlQuoteIdentifier('fieldType');
    const weightColumn = d.sqlQuoteIdentifier('weight');

    // if we've compiled the SQL before use it otherwise
    let sqlPDT = this.exploreSearchSQLMap.get(explore);
    if (sqlPDT === undefined) {
      sqlPDT = this.compileQuery(indexQuery, undefined, false).sql;
      this.exploreSearchSQLMap.set(explore, sqlPDT);
    }

    const matchFirst = `CASE WHEN lower(${fieldValueColumn}) LIKE lower(${d.sqlLiteralString(
      searchValue + '%'
    )}) THEN 1 ELSE 0 END`;
    const orderInFinalStage = d.hasFinalStage && d.orderByStage === 'final';
    const ordering: FinalStageOrdering | undefined = orderInFinalStage
      ? {
          orderBy: [
            {name: 'match_first', dir: 'desc'},
            {name: 'weight', dir: 'desc'},
          ],
          limit,
        }
      : undefined;
    const stageLimit = orderInFinalStage ? undefined : limit;
    let query = `SELECT ${d.sqlSelectLimit(stageLimit)}
              ${fieldNameColumn},
              ${fieldPathColumn},
              ${fieldValueColumn},
              ${fieldTypeColumn},
              ${weightColumn},
              ${matchFirst} as match_first
            FROM  ${await connection.manifestTemporaryTable(sqlPDT)}
            WHERE lower(${fieldValueColumn}) LIKE lower(${d.sqlLiteralString(
              '%' + searchValue + '%'
            )}) ${
              searchField !== undefined
                ? ` AND ${fieldNameColumn} = '` + searchField + "' \n"
                : ''
            }
            ${
              orderInFinalStage
                ? ''
                : `ORDER BY ${matchFirst} DESC, ${weightColumn} DESC`
            }
            ${d.sqlLimit(stageLimit)}
          `;
    if (d.hasFinalStage) {
      const fields: DialectFieldList = [
        ...getDialectFieldList(indexStruct, d),
        {
          typeDef: {type: 'number'},
          sqlExpression: 'match_first',
          rawName: 'match_first',
        },
      ];
      query = `WITH __stage0 AS(\n${query}\n)\n${d.sqlFinalStage(
        '__stage0',
        fields,
        ordering
      )}`;
    }
    const result = await connection.runSQL(query, {
      rowLimit: 1000,
    });
    return result.rows.map(row => ({
      ...row,
      weight: rowDataToNumber(row['weight']),
    })) as unknown as SearchIndexResult[];
  }
}

export function getResultStructDefForQuery(
  model: ModelDef,
  query: Query
): SourceDef {
  const queryModel = makeQueryModel(model);
  const compiled = queryModel.compileQuery(query, undefined, true);
  return compiled.structs[compiled.structs.length - 1];
}

export function getResultStructDefForView(
  source: SourceDef,
  view: TurtleDef
): SourceDef {
  const qs = new QueryStruct(
    source,
    undefined,
    {
      model: makeQueryModel(undefined),
    },
    {}
  );
  const queryQueryQuery = QueryQuery.makeQuery(
    view,
    qs,
    new StageWriter(true, undefined), // stage write indicates we want to get a result.
    false,
    () => undefined
  );
  return queryQueryQuery.getResultStructDef();
}
