/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
