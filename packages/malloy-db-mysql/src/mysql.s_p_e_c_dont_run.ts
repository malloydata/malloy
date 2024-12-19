/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MySQLConnection, MySQLExecutor} from '.';

describe('MySQL Connection', () => {
  let connection: MySQLConnection;

  it('is true', async () => {
    expect(1).toBe(1);
  });

  beforeAll(() => {
    const config = MySQLExecutor.getConnectionOptionsFromEnv();
    connection = new MySQLConnection('mysql', config, {});
  });

  afterAll(() => {
    connection.close();
  });

  it('runs a SQL query', async () => {
    const res = await connection.runSQL('SELECT 1 as t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('fetches schema', async () => {
    const res = await connection.fetchSchemaForTables(
      {
        'malloytest.airports': 'malloytest.airports',
      },
      {}
    );
    expect(res.schemas['malloytest.airports'].dialect).toBe('mysql');
  });

  it('fetches schema for SQL block', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {
        name: 'foo',
        type: 'sql_select',
        selectStr: 'SELECT 1 as one',
        connection: 'mysql',
        fields: [],
        dialect: 'mysql',
      },
      {}
    );
    expect(res.structDef?.fields[0].name).toBe('one');
  });
});
