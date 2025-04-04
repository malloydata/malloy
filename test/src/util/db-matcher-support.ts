/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Result,
  Runtime,
  ModelMaterializer,
  QueryMaterializer,
  LogMessage,
  Dialect,
} from '@malloydata/malloy';
import {API, MalloyError} from '@malloydata/malloy';
import type {Tag} from '@malloydata/malloy-tag';

type JestMatcherResult = {
  pass: boolean;
  message: () => string;
};

export type ExpectedResultRow = Record<string, unknown>;
export type ExpectedResult = ExpectedResultRow | ExpectedResultRow[];
export type TestRunner = Runtime | ModelMaterializer;

export interface TestQuery {
  runner: TestRunner;
  src: string;
}

export function query(runner: TestRunner, querySource: string): TestQuery {
  return {runner, src: querySource};
}

interface QueryRunResult {
  fail: JestMatcherResult;
  result: Result;
  query: QueryMaterializer;
  queryTestTag: Tag;
}

export async function runQuery(
  tq: TestQuery
): Promise<Partial<QueryRunResult>> {
  let query: QueryMaterializer;
  let queryTestTag: Tag | undefined = undefined;
  try {
    query = tq.runner.loadQuery(tq.src);
    const queryTags = (await query.getPreparedQuery()).tagParse().tag;
    queryTestTag = queryTags.tag('test');
  } catch (e) {
    return {
      fail: {
        pass: false,
        message: () =>
          `Could not prepare query to run: ${e.message}\nQuery:\n${tq.src}`,
      },
    };
  }

  let result: Result;
  try {
    result = await query.run();
  } catch (e) {
    let failMsg = `QUERY RUN FAILED: ${tq.src}\nMESSAGE: ${e.message}\n`;
    if (e instanceof MalloyError) {
      failMsg = `Error in query compilation\n${errorLogToString(
        tq.src,
        e.problems
      )}`;
    } else {
      try {
        failMsg += `SQL: ${await query.getSQL()}\n`;
      } catch (e2) {
        failMsg += `SQL FOR FAILING QUERY COULD NOT BE COMPUTED: ${e2.message}\n`;
      }
      failMsg += e.stack;
    }
    return {fail: {pass: false, message: () => failMsg}, query};
  }
  try {
    API.util.wrapResult(result);
  } catch (error) {
    return {
      fail: {
        pass: false,
        message: () =>
          `Result could not be wrapped into new style result: ${error}\n${error.stack}`,
      },
    };
  }
  return {result, queryTestTag, query};
}

function errorLogToString(src: string, msgs: LogMessage[]) {
  let lovely = '';
  let lineNo = 0;
  for (const line of src.split('\n')) {
    lovely += `    | ${line}\n`;
    for (const entry of msgs) {
      if (entry.at) {
        if (entry.at.range.start.line === lineNo) {
          const charFrom = entry.at.range.start.character;
          lovely += `!!!!! ${' '.repeat(charFrom)}^ ${entry.message}\n`;
        }
      }
    }
    lineNo += 1;
  }
  return lovely;
}

type TL = 'timeLiteral';

function lit(d: Dialect, t: string, type: 'timestamp' | 'date'): string {
  const typeDef: {type: 'timestamp' | 'date'} = {type};
  const timeLiteral: TL = 'timeLiteral';
  const n = {
    node: timeLiteral,
    typeDef,
    literal: t,
  };
  return d.sqlLiteralTime({}, n);
}

type SQLDataType = 'string' | 'number' | 'timestamp' | 'date' | 'boolean';
type SQLRow = unknown[];

/**
 * Create source built from the SQL for a series of
 * SELECT ... UNION ALL SELECT statements which returns
 * the passed data. This uses the dialect object to do
 * all the quoting and type translation.
 * @returns '${connectionName}.sql("""SELECT ..."""")'
 */
export function mkSQLSource(
  dialect: Dialect,
  connectioName: string,
  schema: Record<string, SQLDataType>,
  ...dataRows: SQLRow[]
): string {
  const stmts: string[] = [];
  for (const oneRow of dataRows) {
    const outRow: string[] = [];
    let colNum = 0;
    for (const colName of Object.keys(schema)) {
      const val = oneRow[colNum];
      colNum += 1;
      let valStr = `ERROR BAD TYPE FOR ${schema[colName]}: ${typeof val}`;
      if (schema[colName] === 'string' && typeof val === 'string') {
        valStr = dialect.sqlLiteralString(val);
      } else if (schema[colName] === 'number' && typeof val === 'number') {
        valStr = val.toString();
      } else if (schema[colName] === 'boolean' && typeof val === 'boolean') {
        valStr = val.toString();
      } else if (val === null) {
        valStr = 'NULL';
      } else if (schema[colName] === 'timestamp' && typeof val === 'string') {
        valStr = lit(dialect, val, 'timestamp');
      } else if (schema[colName] === 'date' && typeof val === 'string') {
        valStr = lit(dialect, val, 'date');
      }
      outRow.push(
        stmts.length === 0
          ? `${valStr} AS ${dialect.sqlMaybeQuoteIdentifier(colName)}`
          : valStr
      );
    }
    stmts.push(outRow.join(','));
  }
  return `${connectioName}.sql("""SELECT ${stmts.join(
    '\nUNION ALL SELECT '
  )}\n""")`;
}
