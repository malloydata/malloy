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

import { Malloy } from "../../malloy";
import { FilterExpression, Fragment } from "../malloy_types";

export function makeSQLTestSuite(): {
  addTest: (testSQL: string) => number;
  getTestResult: (id: number) => boolean;
  runTestSuite: () => void;
} {
  const collectedTestSQLs: Map<number, string> = new Map();
  const collectedSQLResults: Map<number, boolean> = new Map();

  function addTest(testSQL: string): number {
    const id = collectedTestSQLs.size;
    collectedTestSQLs.set(id, testSQL);
    return id;
  }

  function getTestResult(id: number): boolean {
    const result = collectedSQLResults.get(id);
    if (result === undefined) {
      throw new Error(
        `Expected test ${id} to have been run. Is the \`beforeAll\` running?`
      );
    }
    return result;
  }

  async function getSQLResults(
    tests: Map<number, string>
  ): Promise<Map<number, boolean>> {
    const rows = await Malloy.db.runQuery(
      [...tests.entries()]
        .map(([testID, testSQL]) => {
          return `SELECT ${testID} as id, IF(${testSQL}, 1, 0) as result`;
        })
        .join("\nUNION ALL\n")
    );
    return new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows.map((row: any) => {
        return [row.id as number, row.result === 1];
      })
    );
  }

  async function runTestSuite() {
    const results = await getSQLResults(collectedTestSQLs);
    results.forEach((result, testID) => {
      collectedSQLResults.set(testID, result);
    });
  }

  return { addTest, getTestResult, runTestSuite };
}

export function fStringEq(field: string, value: string): FilterExpression {
  return {
    expression: [{ type: "field", path: field }, `='${value}'`],
    source: `${field}='${value}'`,
  };
}

export function fStringLike(field: string, value: string): FilterExpression {
  return {
    expression: [{ type: "field", path: field }, ` LIKE '${value}'`],
    source: `${field}~'${value}'`,
  };
}

export function fYearEq(field: string, year: number): FilterExpression {
  const yBegin = `'${year}-01-01 00:00:00'`;
  const yEnd = `'${year + 1}-01-01 00:00:00'`;
  const fx: Fragment = { type: "field", path: field };
  return {
    expression: [fx, `>=${yBegin} and `, fx, `<${yEnd}`],
    source: `${field}:@${year}`,
  };
}
