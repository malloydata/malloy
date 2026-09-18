/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SQLSourceRequest} from '../lang/translate-response';
import {makeQueryModel, type QueryModel} from './query_model';
import type {SQLPhraseSegment, ModelDef, VirtualMap} from './malloy_types';
import {expandSQLSegments, type CompileQueryCallback} from './sql_compiled';
import {generateHash} from './utils';

/**
 * The translator needs to know the output schema of an SQLSourceDef
 * this will prepare an SQL string suitable to answer that question.
 */
export function getSourceRequest(
  select: SQLPhraseSegment[],
  connection: string,
  partialModel: ModelDef | undefined,
  virtualMap?: VirtualMap
): SQLSourceRequest {
  let queryModel: QueryModel | undefined;
  const compileQuery: CompileQueryCallback = (query, options) => {
    if (!queryModel) {
      if (!partialModel) {
        throw new Error(
          'Internal error: Partial model missing when compiling SQL block'
        );
      }
      queryModel = makeQueryModel(partialModel);
    }
    return queryModel.compileQuery(
      query,
      {...options, defaultRowLimit: undefined, isPartialQuery: true},
      false
    ).sql;
  };
  return {
    connection,
    selectStr: expandSQLSegments(select, {virtualMap}, compileQuery),
  };
}

export function sqlKey(connectionName: string, sql: string): string {
  return `sql://${connectionName}/${generateHash(sql)}`;
}
