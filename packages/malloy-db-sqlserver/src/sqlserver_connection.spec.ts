/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SQLServerConnection, SQLServerExecutor} from '.';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['sqlserver']);

describe('db:SQLServer', () => {
  const connection = new SQLServerConnection(
    'sqlserver',
    SQLServerExecutor.getConnectionOptionsFromEnv()
  );

  afterAll(async () => {
    await connection.close();
  });

  it('runs a SQL query', async () => {
    const res = await connection.runSQL('SELECT 1 AS t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('applies the session setup ahead of a query', async () => {
    const res = await connection.runSQL('SELECT @@DATEFIRST AS df');
    expect(res.rows[0]['df']).toBe(7);
  });

  it('fetches the schema of a SQL block without running it', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {selectStr: 'SELECT 1 AS one', connection: 'sqlserver'},
      {}
    );
    expect(res.error).toBeUndefined();
    expect(res.structDef?.fields[0]).toEqual({
      name: 'one',
      type: 'number',
      numberType: 'integer',
    });
  });

  it('reports a bad SQL block as an error, not a throw', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {selectStr: 'SELECT FROM nowhere WHERE', connection: 'sqlserver'},
      {}
    );
    expect(res.structDef).toBeUndefined();
    expect(res.error).toMatch(/syntax/i);
  });

  it('maps the reported types', async () => {
    const res = await connection.fetchSchemaForSQLStruct(
      {
        selectStr: `
          SELECT
            CAST(1 AS BIT) AS b,
            CAST(1 AS TINYINT) AS i8,
            CAST(1 AS SMALLINT) AS i16,
            CAST(1 AS INT) AS i32,
            CAST(1 AS BIGINT) AS i64,
            CAST(1 AS DECIMAL(10, 0)) AS d10,
            CAST(1 AS DECIMAL(20, 0)) AS d20,
            CAST(1 AS DECIMAL(10, 2)) AS d10_2,
            CAST(1 AS REAL) AS r,
            CAST(1 AS FLOAT) AS f,
            CAST('a' AS VARCHAR(10)) AS vc,
            CAST('a' AS NVARCHAR(MAX)) AS nvc,
            CAST('2021-02-24' AS DATE) AS d,
            CAST('2021-02-24 03:05:06' AS DATETIME2) AS dt2,
            CAST('2021-02-24 03:05:06' AS DATETIME) AS dt,
            CAST('2021-02-24 03:05:06 -06:00' AS DATETIMEOFFSET) AS dto,
            CAST('03:05:06' AS TIME) AS t,
            NEWID() AS uid
        `,
        connection: 'sqlserver',
      },
      {}
    );
    expect(res.error).toBeUndefined();
    const types = Object.fromEntries(
      (res.structDef?.fields ?? []).map(f => [
        f.name,
        'numberType' in f ? `${f.type}:${f.numberType}` : f.type,
      ])
    );
    expect(types).toEqual({
      b: 'boolean',
      i8: 'number:integer',
      i16: 'number:integer',
      i32: 'number:integer',
      i64: 'number:bigint',
      d10: 'number:integer',
      d20: 'number:bigint',
      d10_2: 'number:float',
      r: 'number:float',
      f: 'number:float',
      vc: 'string',
      nvc: 'string',
      d: 'date',
      dt2: 'timestamp',
      dt: 'timestamp',
      dto: 'sql native',
      t: 'sql native',
      uid: 'string',
    });
  });

  it('fetches a table schema through the catalog', async () => {
    const res = await connection.fetchSchemaForTables(
      {sf: 'malloytest.state_facts'},
      {}
    );
    expect(res.errors).toEqual({});
    const names = (res.schemas['sf']?.fields ?? []).map(f => f.name);
    expect(names).toEqual(
      expect.arrayContaining(['state', 'popular_name', 'airport_count'])
    );
  });

  it('fetches a table schema through a quoted path', async () => {
    const res = await connection.fetchSchemaForTables(
      {sf: '"malloytest"."state_facts"'},
      {}
    );
    expect(res.errors).toEqual({});
    expect(res.schemas['sf']?.fields.length).toBeGreaterThan(0);
  });

  it('reports a missing table as an error', async () => {
    const res = await connection.fetchSchemaForTables(
      {nope: 'malloytest.no_such_table'},
      {}
    );
    expect(res.schemas).toEqual({});
    expect(res.errors['nope']).toMatch(/not found/);
  });

  it('keeps bigint precision as a string', async () => {
    const res = await connection.runSQL(
      'SELECT CAST(9007199254740993 AS BIGINT) AS big'
    );
    expect(String(res.rows[0]['big'])).toBe('9007199254740993');
  });

  it('reads datetime2 as a UTC instant', async () => {
    const res = await connection.runSQL(
      "SELECT CAST('2021-02-24 03:05:06' AS DATETIME2) AS dt"
    );
    expect((res.rows[0]['dt'] as Date).toISOString()).toBe(
      '2021-02-24T03:05:06.000Z'
    );
  });

  it('honors rowLimit', async () => {
    const res = await connection.runSQL(
      'SELECT value FROM GENERATE_SERIES(1, 100)',
      {rowLimit: 5}
    );
    expect(res.rows.length).toBe(5);
  });

  it('streams rows and stops at rowLimit', async () => {
    const rows: unknown[] = [];
    for await (const row of connection.runSQLStream(
      'SELECT value FROM GENERATE_SERIES(1, 100)',
      {rowLimit: 3}
    )) {
      rows.push(row);
    }
    expect(rows.length).toBe(3);
  });

  it('manifests a temporary table any pooled connection can read', async () => {
    const name = await connection.manifestTemporaryTable('SELECT 42 AS answer');
    expect(name).toMatch(/^##tt/);
    const res = await connection.runSQL(`SELECT answer FROM ${name}`);
    expect(res.rows[0]['answer']).toBe(42);
  });

  it('has a digest that ignores credentials but not identity', () => {
    const base = SQLServerExecutor.getConnectionOptionsFromEnv();
    const a = new SQLServerConnection('a', base).getDigest();
    const samePrincipal = new SQLServerConnection('b', {
      ...base,
      password: 'other',
    }).getDigest();
    const otherPrincipal = new SQLServerConnection('c', {
      ...base,
      user: 'someone_else',
    }).getDigest();
    expect(samePrincipal).toBe(a);
    expect(otherPrincipal).not.toBe(a);
  });
});
