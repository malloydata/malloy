/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection} from '../connection/types';
import type {Dialect} from '../dialect';
import type {EventStream} from '../runtime_types';
import type {
  SourceDef,
  ModelDef,
  StructRef,
  Argument,
  PrepareResultOptions,
  CompiledQuery,
  SearchIndexResult,
  Query,
} from './malloy_types';
import type {QueryStruct} from './query_node';
import type {StageWriter} from './stage_writer';

export interface ParentQueryModel {
  model: QueryModel;
}

export interface QueryResults {
  lastStageName: string;
  stageWriter: StageWriter;
  structs: SourceDef[];
  malloy: string;
  connectionName: string;
}

export interface QueryModel {
  dialect: Dialect;
  modelDef: ModelDef | undefined;
  structs: Map<string, QueryStruct>;
  eventStream?: EventStream;
  loadModelFromDef(modelDef: ModelDef): void;
  getStructByName(name: string): QueryStruct;
  getStructFromRef(
    structRef: StructRef,
    sourceArguments: Record<string, Argument> | undefined,
    prepareResultOptions?: PrepareResultOptions | undefined
  ): QueryStruct;
  loadQuery(
    query: Query,
    stageWriter: StageWriter | undefined,
    prepareResultOptions: PrepareResultOptions | undefined,
    emitFinalStage: boolean | undefined,
    isJoinedSubquery: boolean | undefined
  ): QueryResults;
  addDefaultRowLimit(
    query: Query,
    defaultRowLimit?: number
  ): {query: Query; addedDefaultRowLimit?: number};
  compileQuery(
    query: Query,
    prepareResultOptions: PrepareResultOptions | undefined,
    finalize: boolean | undefined
  ): CompiledQuery;
  searchIndex(
    connection: Connection,
    explore: string,
    searchValue: string,
    limit: number,
    searchField: string | undefined
  ): Promise<SearchIndexResult[] | undefined>;
  persistedQueryDigests: Record<string, string>;
}
