/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  FetchSchemaOptions,
  MalloyError,
  SQLSourceDef,
} from '@malloydata/malloy';
import {DuckDBDialect, registerDialect} from '@malloydata/malloy';
import {testRuntimeFor} from '../runtimes';
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

  const connection = new DuckdbXConnection(duckdbX, ':memory:');

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
