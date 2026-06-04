/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SQLSourceRequest} from '../lang/translate-response';
import {makeQueryModel, type QueryModel} from './query_model';
import type {SQLPhraseSegment, ModelDef} from './malloy_types';
import {isSegmentSQL, isSegmentSource} from './malloy_types';
import {generateHash} from './utils';

/**
 * The translator needs to know the output schema of an SQLSourceDef
 * this will prepare an SQL string suitable to answer that question.
 */
export function getSourceRequest(
  select: SQLPhraseSegment[],
  connection: string,
  partialModel: ModelDef | undefined
): SQLSourceRequest {
  let queryModel: QueryModel | undefined = undefined;
  let selectStr = '';
  let parenAlready = false;
  for (const segment of select) {
    if (isSegmentSQL(segment)) {
      selectStr += segment.sql;
      parenAlready = segment.sql.match(/\(\s*$/) !== null;
    } else if (isSegmentSource(segment)) {
      // PersistableSourceDef (sql_select or query_source)
      let compiledSql: string;
      if (segment.type === 'sql_select') {
        compiledSql = segment.selectStr;
      } else {
        // query_source - compile the inner query
        if (!queryModel) {
          if (!partialModel) {
            throw new Error(
              'Internal error: Partial model missing when compiling SQL block'
            );
          }
          queryModel = makeQueryModel(partialModel);
        }
        compiledSql = queryModel.compileQuery(
          segment.query,
          {
            defaultRowLimit: undefined,
            isPartialQuery: true,
          },
          false
        ).sql;
      }
      selectStr += parenAlready ? compiledSql : `(${compiledSql})`;
      parenAlready = false;
    } else {
      // Query segment
      if (!queryModel) {
        if (!partialModel) {
          throw new Error(
            'Internal error: Partial model missing when compiling SQL block'
          );
        }
        queryModel = makeQueryModel(partialModel);
      }
      const compiledSql = queryModel.compileQuery(
        segment,
        {
          defaultRowLimit: undefined,
          isPartialQuery: true,
        },
        false
      ).sql;
      selectStr += parenAlready ? compiledSql : `(${compiledSql})`;
      parenAlready = false;
    }
  }
  return {
    connection,
    selectStr,
  };
}

export function sqlKey(connectionName: string, sql: string): string {
  return `sql://${connectionName}/${generateHash(sql)}`;
}
