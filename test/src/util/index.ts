/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import {
  FilterExpression,
  Fragment,
  Result,
  Runtime,
} from "@malloydata/malloy";

export function fStringEq(field: string, value: string): FilterExpression {
  return {
    expression: [{ type: "field", path: field }, `='${value}'`],
    code: `${field}='${value}'`,
  };
}

export function fStringLike(field: string, value: string): FilterExpression {
  return {
    expression: [{ type: "field", path: field }, ` LIKE '${value}'`],
    code: `${field}~'${value}'`,
  };
}

export function fYearEq(field: string, year: number): FilterExpression {
  const yBegin = `'${year}-01-01 00:00:00'`;
  const yEnd = `'${year + 1}-01-01 00:00:00'`;
  const fx: Fragment = { type: "field", path: field };
  return {
    expression: [fx, `>=${yBegin} and `, fx, `<${yEnd}`],
    code: `${field}:@${year}`,
  };
}

// accepts databases in env, either via comma-separated dialect list (MALLOY_DATABASES=) or a single
// database (MALLOY_DATABASE=). returns either databases defined in env or a default list that was passed.
export function databasesFromEnvironmentOr(
  defaultDatabases: string[]
): string[] {
  return process.env["MALLOY_DATABASES"]
    ? process.env["MALLOY_DATABASES"].split(",")
    : process.env["MALLOY_DATABASE"]
    ? [process.env["MALLOY_DATABASE"]]
    : defaultDatabases;
}

// confirms that one or more of the databases being tested overlaps with the databases a test suite can accept.
// if there is overlap, return a tuple of jest.describe and the dialects to be tested
// if there is no overlap, return a tuple if jest.describe.skip and the dialects to be tested
export function describeIfDatabaseAvailable(
  acceptableDatabases: string[]
): [jest.Describe, string[]] {
  const currentDatabases = databasesFromEnvironmentOr(acceptableDatabases);
  const overlap = acceptableDatabases.filter((d) =>
    currentDatabases.includes(d)
  );

  return overlap.length > 0 ? [describe, overlap] : [describe.skip, overlap];
}

interface InitValues {
  sql?: string;
  malloy?: string;
}

function sqlSafe(str: string): string {
  return str.replace(/'/g, "{single-quote}").replace(/\\/g, "{backslash}");
}
export function mkSqlEqWith(runtime: Runtime, initV?: InitValues) {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  return async function (
    expr: string,
    result: string | boolean | number
  ): Promise<Result> {
    const qExpr = expr.replace(/'/g, "`");
    const sqlV = initV?.sql || "SELECT 1 as one";
    const malloyV = initV?.malloy || "";
    const sourceDef = `
      sql: sqlData is { select: """${sqlV}""" }
      source: basicTypes is from_sql(sqlData) ${malloyV}
    `;
    let query: string;
    if (typeof result == "boolean") {
      const notEq = `concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} to be ${result}')`;
      const varName = result ? "expectTrue" : "expectFalse";
      const whenPick = result
        ? `'=' when ${varName}`
        : `${notEq} when ${varName}`;
      const elsePick = result ? notEq : "'='";
      query = `${sourceDef}
          query: basicTypes
          -> { project: ${varName} is ${expr} }
          -> {
            project: calc is pick ${whenPick} else ${elsePick}
          }`;
    } else if (typeof result === "number") {
      query = `${sourceDef}
          query: basicTypes
          -> {
            project: expect is ${result}
            project: got is ${expr}
          } -> {
            project: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} == ${result}', CHR(10), '    Received: ', got::string)
          }`;
    } else if (expr[0] == "'") {
      // quoted strings
      const resultNoBacks = result.replace(/\\/g, "\\\\");
      const qResult = `'${resultNoBacks.replace(/'/g, "\\'")}'`;
      query = `${sourceDef}
          query: basicTypes
          -> {
            project: expect is ${qResult}
            project: got is ${expr}
          } -> {
            project: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${sqlSafe(
                expr
              )} == ${sqlSafe(result)}', CHR(10), '    Received: ', got::string)
          }`;
    } else {
      const qResult = result.replace(/'/g, "`");
      query = `${sourceDef}
          query: basicTypes
          -> {
            project: expect is ${result}
            project: got is ${expr}
          } -> {
            project: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} == ${qResult}', CHR(10), '    Received: ', got::string)
          }`;
    }
    return runtime.loadQuery(query).run();
  };
}
