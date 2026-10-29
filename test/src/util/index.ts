/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  QueryMaterializer,
  Result,
  Runtime,
  SingleConnectionRuntime,
} from '@malloydata/malloy';
export * from '@malloydata/malloy/test';

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
  runtime: SingleConnectionRuntime,
  cName: string,
  initV?: InitValues
) {
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
