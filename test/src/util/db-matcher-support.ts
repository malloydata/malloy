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
} from '@malloydata/malloy';
import {API, MalloyError, Dialect} from '@malloydata/malloy';
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

function errInfo(e: {message?: string; stack?: string}) {
  let err = '';
  const trace = e.stack ?? '';
  if (e.message && !trace.includes(e.message)) {
    err = `ERROR: ${e.message}\n`;
  }
  if (e.stack) {
    err += `STACK: ${e.stack}\n`;
  }
  return err;
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
    // Add line numbers, helpful if failure is a compiler error
    const queryText = tq.src
      .split('\n')
      .map((line, index) => `${(index + 1).toString().padStart(4)}: ${line}`)
      .join('\n');
    return {
      fail: {
        pass: false,
        message: () =>
          `Could not prepare query to run:\n${queryText}\n\n${errInfo(e)}`,
      },
    };
  }

  let result: Result;
  try {
    result = await query.run();
  } catch (e) {
    const src = tq.src.replace(/^\n+/m, '').trimEnd();
    let failMsg = `QUERY RUN FAILED:\n${src}`;
    if (e instanceof MalloyError) {
      failMsg = `Error in query compilation\n${errorLogToString(
        tq.src,
        e.problems
      )}`;
    } else {
      try {
        failMsg += `\nSQL: ${await query.getSQL()}\n`;
      } catch (e2) {
        failMsg += '\nSQL FOR QUERY COULD NOT BE COMPUTED\n';
      }
      failMsg += errInfo(e);
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

function lit(d: Dialect, t: string, type: 'timestamp' | 'date'): string {
  const node = Dialect.makeTimeLiteralNode(d, t, undefined, undefined, type);
  return d.exprToSQL({}, node) || '';
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
