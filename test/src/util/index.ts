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

import type {
  FilterCondition,
  QueryFieldDef,
  IndexFieldDef,
  QueryMaterializer,
  Result,
  Runtime,
  Expr,
} from '@malloydata/malloy';
import {composeSQLExpr} from '@malloydata/malloy';
export * from '@malloydata/malloy/test';

// these two helper functions are here just to make older hand built models
// easier to use in the new world were refs are not strings
export function fToQF(fs: (QueryFieldDef | string)[]): QueryFieldDef[] {
  return fs.map(f =>
    typeof f === 'string' ? {type: 'fieldref', path: f.split('.')} : f
  );
}

export function fToIF(fs: string[]): IndexFieldDef[] {
  return fs.map(f =>
    typeof f === 'string' ? {type: 'fieldref', path: f.split('.')} : f
  );
}

export function fStringEq(field: string, value: string): FilterCondition {
  return {
    node: 'filterCondition',
    e: {
      node: '=',
      kids: {
        left: {node: 'field', path: field.split('.')},
        right: {node: 'stringLiteral', literal: value},
      },
    },
    code: `${field}='${value}'`,
    expressionType: 'scalar',
  };
}

export function fStringLike(field: string, value: string): FilterCondition {
  return {
    node: 'filterCondition',
    e: {
      node: 'like',
      kids: {
        left: {node: 'field', path: field.split('.')},
        right: {node: 'stringLiteral', literal: value},
      },
    },
    code: `${field}~'${value}'`,
    expressionType: 'scalar',
  };
}

export function fYearEq(field: string, year: number): FilterCondition {
  const yBegin = `'${year}-01-01 00:00:00'`;
  const yEnd = `'${year + 1}-01-01 00:00:00'`;
  const fx: Expr = {node: 'field', path: field.split('.')};
  return {
    node: 'filterCondition',
    e: composeSQLExpr([fx, `>=${yBegin} and `, fx, `<${yEnd}`]),
    code: `${field}:@${year}`,
    expressionType: 'scalar',
  };
}

interface InitValues {
  sql?: string;
  malloy?: string;
}

function sqlSafe(str: string): string {
  return str
    .replace(/'/g, '{single-quote}')
    .replace(/\\/g, '{backslash}')
    .replace(/"/g, '{double-quote}');
}

export function mkSqlEqWith(
  runtime: Runtime,
  cName: string,
  initV?: InitValues
) {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  return async function (
    expr: string,
    result: string | boolean | number
  ): Promise<Result> {
    const qExpr = expr.replace(/'/g, '`');
    const sqlV = initV?.sql || 'SELECT 1 as one';
    const malloyV = initV?.malloy || '';
    const sourceDef = `
      source: basicTypes is ${cName}.sql("""${sqlV}""") ${malloyV}
    `;
    let query: string;
    if (typeof result === 'boolean') {
      const notEq = `concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} to be ${result}')`;
      const varName = result ? 'expectTrue' : 'expectFalse';
      const whenPick = result
        ? `'=' when ${varName}`
        : `${notEq} when ${varName}`;
      const elsePick = result ? notEq : "'='";
      query = `${sourceDef}
          run: basicTypes
          -> {
            extend: {dimension: ${varName} is ${expr}}
            select: calc is pick ${whenPick} else ${elsePick}
          }`;
    } else if (typeof result === 'number') {
      query = `${sourceDef}
          run: basicTypes
          -> {
            extend: {
              dimension: expect is ${result}
              dimension: got is ${expr}
            }
            select: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} == ${result}', CHR(10), '    Received: ', got::string)
          }`;
    } else if (expr[0] === "'") {
      // quoted strings
      const resultNoBacks = result.replace(/\\/g, '\\\\');
      const qResult = `'${resultNoBacks.replace(/'/g, "\\'")}'`;
      query = `${sourceDef}
          run: basicTypes
          -> {
            select: expect is ${qResult}
            select: got is ${expr}
          } -> {
            select: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${sqlSafe(
                expr
              )} == ${sqlSafe(result)}', CHR(10), '    Received: ', got::string)
          }`;
    } else {
      const qResult = result.replace(/'/g, '`');
      query = `${sourceDef}
          run: basicTypes
          -> {
            select: expect is ${result}
            select: got is ${expr}
          } -> {
            select: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} == ${qResult}', CHR(10), '    Received: ', got::string)
          }`;
    }

    return runtime.loadQuery(query).run();
  };
}

export async function runQuery(runtime: Runtime, querySrc: string) {
  let query: QueryMaterializer;
  try {
    query = runtime.loadQuery(querySrc);
  } catch (e) {
    throw new Error(`loadQuery failed: ${e.message}`);
  }

  let result: Result;
  try {
    result = await query.run();
  } catch (e) {
    throw new Error(
      `query.run failed: ${e.message}\n` +
        `SQL: ${await query.getSQL()}\n` +
        e.stack
    );
  }

  return result;
}

// TODO (vitor): Not sure... This is pretty hidden away and uses dbName instead of dialect for param
export function booleanResult(value: boolean, dbName: string) {
  if (dbName === 'mysql' || dbName === 'sqlserver') {
    return value ? 1 : 0;
  } else {
    return value;
  }
}

// TODO (vitor): Not sure... This is pretty hidden away and uses dbName instead of dialect for param
export function booleanCode(value: boolean, dbName: string) {
  if (dbName === 'mysql') {
    return value ? '1' : '0';
  } else if (dbName === 'sqlserver') {
    return value ? '1=1' : '1=0';
  } else {
    return value ? 'true' : 'false';
  }
}
