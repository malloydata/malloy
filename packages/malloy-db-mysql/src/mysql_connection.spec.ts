/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MySQLConnection, MySQLExecutor} from '.';
import {createTestRuntime, mkTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

const config = MySQLExecutor.getConnectionOptionsFromEnv();
const hasCredentials = !!config.user;

const describeMySQL = hasCredentials ? describe : describe.skip;

describeMySQL('db:MySQL', () => {
  const connection = new MySQLConnection('mysql', config, {});
  const runtime = createTestRuntime(connection);

  afterAll(async () => {
    await connection.close();
  });

  it('runs a SQL query', async () => {
    const res = await connection.runSQL('SELECT 1 as t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('fetches schema for SQL block', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {
        selectStr: 'SELECT 1 as one',
        connection: 'mysql',
      },
      {}
    );
    expect(res.structDef?.fields[0].name).toBe('one');
  });

  it('maps integer types correctly', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {
        selectStr: `
          SELECT
            CAST(1 AS SIGNED) as signed_int,
            CAST(2 AS UNSIGNED) as unsigned_int
        `,
        connection: 'mysql',
      },
      {}
    );
    expect(res.structDef?.fields[0]).toEqual({
      name: 'signed_int',
      type: 'number',
      numberType: 'bigint',
    });
  });
});

/**
 * Tests for reading numeric values through Malloy queries
 */
describeMySQL('numeric value reading', () => {
  const connection = new MySQLConnection('mysql_numeric_tests', config, {});
  const runtime = createTestRuntime(connection);
  const testModel = mkTestModel(runtime, {});

  afterAll(async () => {
    await connection.close();
  });

  describe('integer types', () => {
    // MySQL infers int for values <= 2^31-1, bigint for larger
    it('reads int correctly', async () => {
      await expect(
        `run: mysql.sql("SELECT 2147483647 as d")`
      ).toMatchResult(testModel, {d: 2147483647});
    });

    it('reads bigint correctly', async () => {
      await expect(
        `run: mysql.sql("SELECT 2147483648 as d")`
      ).toMatchResult(testModel, {d: 2147483648});
    });

    it('preserves precision for literal integers > 2^53', async () => {
      const largeInt = BigInt('9007199254740993'); // 2^53 + 1
      await expect(`
        run: mysql.sql("select 1") -> { select: d is ${largeInt} }
      `).toMatchResult(testModel, {d: largeInt});
    });
  });

  describe('float types', () => {
    it.each(['FLOAT', 'DOUBLE', 'DECIMAL(10,2)'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: mysql.sql("SELECT CAST(10.5 AS ${sqlType}) as f")`
        ).toMatchResult(testModel, {f: 10.5});
      }
    );
  });
});
