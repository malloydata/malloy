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
  FetchSchemaOptions,
  MalloyError,
  SQLSourceDef,
} from '@malloydata/malloy';
import {DuckDBDialect, registerDialect} from '@malloydata/malloy';
import {testRuntimeFor} from '../runtimes';
import '../util/db-jest-matchers';
import {DuckDBConnection} from '@malloydata/db-duckdb';

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  'duckdb'
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
  describe.skip = describe;
}

async function getError<T>(promise: Promise<T>): Promise<Error | undefined> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('experimental dialects', () => {
  const duckdbX = 'duckdb_experimental';
  class DuckdbXConnection extends DuckDBConnection {
    name = duckdbX;
    public async festchSchemaFOrSQLSource(
      sqlRef: SQLSourceDef,
      options: FetchSchemaOptions
    ): Promise<
      | {structDef: SQLSourceDef; error?: undefined}
      | {error: string; structDef?: undefined}
    > {
      const result = await super.fetchSchemaForSQLStruct(sqlRef, options);
      if (result.error === undefined) {
        return {structDef: {...result.structDef, dialect: duckdbX}};
      }
      return result;
    }
    get dialectName(): string {
      return duckdbX;
    }
  }

  const connection = new DuckdbXConnection(
    duckdbX,
    'test/data/duckdb/duckdb_test.db'
  );

  class DuckdbXDialect extends DuckDBDialect {
    experimental = true;
    name = duckdbX;
    get dialectName(): string {
      return duckdbX;
    }
  }

  registerDialect(new DuckdbXDialect());
  const runtime = testRuntimeFor(connection);
  runtime.isTestRuntime = false; // Enables checking experimental dialects

  test('generate an error when used without experiment enabled', async () => {
    const error = await getError(
      runtime.getModel(`
        source: s is ${duckdbX}.sql('SELECT 1 as one')
      `)
    );
    expect(error).not.toBeUndefined();
    if (error !== undefined) {
      const problems = (error as MalloyError).problems;
      expect(problems.length).toBe(1);
      expect(problems[0].message).toContain(
        `##! experimental.dialect.${duckdbX}`
      );
    }
  });

  test('does not generate an error when used with experiment enabled', async () => {
    await runtime.getModel(`
      ##! experimental.dialect.${duckdbX}
      source: s is ${duckdbX}.sql('SELECT 1 as one')
    `);
  });

  afterAll(async () => {
    await runtime.connection.close();
    registerDialect(new DuckDBDialect());
  });
});
