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

import * as fs from 'fs';
import * as path from 'path';
import {
  FilterExpression,
  Fragment,
  QueryFieldDef,
  IndexFieldDef,
  QueryMaterializer,
  Result,
  Runtime,
  registerDialect,
  ConnectionFactory,
} from '@malloydata/malloy';
import {allDatabases} from '../runtimes';

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

export function fStringEq(field: string, value: string): FilterExpression {
  return {
    expression: [{type: 'field', path: field.split('.')}, `='${value}'`],
    code: `${field}='${value}'`,
    expressionType: 'scalar',
  };
}

export function fStringLike(field: string, value: string): FilterExpression {
  return {
    expression: [{type: 'field', path: field.split('.')}, ` LIKE '${value}'`],
    code: `${field}~'${value}'`,
    expressionType: 'scalar',
  };
}

export function fYearEq(field: string, year: number): FilterExpression {
  const yBegin = `'${year}-01-01 00:00:00'`;
  const yEnd = `'${year + 1}-01-01 00:00:00'`;
  const fx: Fragment = {type: 'field', path: field.split('.')};
  return {
    expression: [fx, `>=${yBegin} and `, fx, `<${yEnd}`],
    code: `${field}:@${year}`,
    expressionType: 'scalar',
  };
}

// load driver/database info from ENV or from databases.json
const externalDrivers: {[id: string]: ConnectionFactory} = {};
const externalDriverLocations = {};

const repoDirectoryPath = path.join(__dirname, '..', '..', '..');
const databasesJSONFile = path.join(repoDirectoryPath, 'databases.json');

let userDefinedTestDatabases: string[] = [];
if (process.env['MALLOY_DATABASES'] || process.env['MALLOY_DATABASE']) {
  const envDatabasesString = (process.env['MALLOY_DATABASES'] ||
    process.env['MALLOY_DATABASE']) as string;

  // add comma-separated names to database list. if name has =/some/path,
  // add name and path to list of external drivers
  userDefinedTestDatabases = userDefinedTestDatabases.concat(
    envDatabasesString
      .split(',')
      .map(dialectName => {
        if (dialectName && dialectName.indexOf('=') !== -1) {
          const [name, location] = dialectName.split('=');
          externalDriverLocations[name] = location;
          return name;
        } else return dialectName;
      })
      .filter(Boolean) // handle "MALLOY_DATABASES=bigquery,", "MALLOY_DATABASE="bigquery,,postgres" etc
  );
} else if (fs.existsSync(databasesJSONFile)) {
  const databasesJSON = JSON.parse(fs.readFileSync(databasesJSONFile, 'utf-8'));
  if (databasesJSON.internal) {
    userDefinedTestDatabases = userDefinedTestDatabases.concat(
      databasesJSON.internal
    );
  }

  if (databasesJSON.external) {
    for (const [name, location] of Object.entries(databasesJSON.external)) {
      userDefinedTestDatabases.push(name);
      externalDriverLocations[name] = location;
    }
  }
}

// load external drivers & register dialects
for (const [dialect, modulePath] of Object.entries<string>(
  externalDriverLocations
)) {
  const absoluteModulePath = path.isAbsolute(modulePath)
    ? modulePath
    : path.join(repoDirectoryPath, modulePath);

  const driver = require(absoluteModulePath);

  if (!driver.connectionFactory)
    throw new Error(`No connectionFactory export from ${dialect}`);

  registerDialect(driver.connectionFactory.dialect);
  externalDrivers[dialect] = driver.connectionFactory as ConnectionFactory;
}

export {externalDrivers, userDefinedTestDatabases};

export function databasesFromEnvironmentOr(
  defaultDatabases: string[]
): string[] {
  return userDefinedTestDatabases.length > 0
    ? userDefinedTestDatabases
    : defaultDatabases;
}

// confirms that one or more of the databases being tested overlaps with the databases a test suite can accept.
// if there is overlap, return a tuple of jest.describe and the dialects to be tested
// if there is no overlap, return a tuple if jest.describe.skip and the dialects to be tested
export function describeIfDatabaseAvailable(
  acceptableDatabases: string[]
): [jest.Describe, string[]] {
  const currentDatabases = databasesFromEnvironmentOr(allDatabases);
  const overlap = acceptableDatabases.filter(d => currentDatabases.includes(d));

  return overlap.length > 0 ? [describe, overlap] : [describe.skip, overlap];
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

export const testIf = (condition: boolean) => {
  return condition ? test : test.skip;
};
