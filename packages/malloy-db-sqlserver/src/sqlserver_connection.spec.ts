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

  // A hundred numbered rows, on any server version
  const hundredRows =
    'SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS value FROM sys.all_objects';
  // The shape the dialect's final stage gives a result row
  const jsonRows = (select: string, from = '') =>
    `SELECT (SELECT ${select} FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) AS "row" ${from}`;

  it('runs a SQL query', async () => {
    const res = await connection.runRawSQL('SELECT 1 AS t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('reads each result row from its JSON document', async () => {
    const res = await connection.runSQL(jsonRows('1 AS t, NULL AS n'));
    expect(res.rows).toEqual([{t: 1, n: null}]);
  });

  it('applies the session setup ahead of a query', async () => {
    const res = await connection.runRawSQL('SELECT @@DATEFIRST AS df');
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
            NEWID() AS uid,
            CAST(1 AS MONEY) AS m,
            CAST(1 AS SMALLMONEY) AS sm,
            CAST(1 AS NUMERIC(12, 3)) AS n12_3,
            CAST('a' AS CHAR(2)) AS c,
            CAST('a' AS NCHAR(2)) AS nc,
            CAST('2021-02-24 03:05:00' AS SMALLDATETIME) AS sdt,
            CAST('a' AS TEXT) AS tx,
            CAST('a' AS NTEXT) AS ntx,
            CAST(1 AS VARBINARY(8)) AS vb,
            CAST('<a/>' AS XML) AS x
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
      dto: 'timestamp',
      t: 'sql native',
      uid: 'string',
      m: 'number:float',
      sm: 'number:float',
      n12_3: 'number:float',
      c: 'string',
      nc: 'string',
      sdt: 'timestamp',
      tx: 'sql native',
      ntx: 'sql native',
      vb: 'sql native',
      x: 'sql native',
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

  it('fetches a table schema from another database', async () => {
    const res = await connection.fetchSchemaForTables(
      {sv: 'master.dbo.spt_values'},
      {}
    );
    expect(res.errors).toEqual({});
    const names = (res.schemas['sv']?.fields ?? []).map(f => f.name);
    expect(names).toEqual(expect.arrayContaining(['name', 'number', 'type']));
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
    const res = await connection.runRawSQL(
      'SELECT CAST(9007199254740993 AS BIGINT) AS big'
    );
    expect(String(res.rows[0]['big'])).toBe('9007199254740993');
  });

  it('reads datetime2 as a UTC instant', async () => {
    const res = await connection.runRawSQL(
      "SELECT CAST('2021-02-24 03:05:06' AS DATETIME2) AS dt"
    );
    expect((res.rows[0]['dt'] as Date).toISOString()).toBe(
      '2021-02-24T03:05:06.000Z'
    );
  });

  it('honors rowLimit', async () => {
    const res = await connection.runSQL(
      jsonRows('g.value AS value', `FROM (${hundredRows}) AS g`),
      {rowLimit: 5}
    );
    expect(res.rows.length).toBe(5);
  });

  it('streams rows and stops at rowLimit', async () => {
    const rows: unknown[] = [];
    for await (const row of connection.runSQLStream(
      jsonRows('g.value AS value', `FROM (${hundredRows}) AS g`),
      {rowLimit: 3}
    )) {
      rows.push(row);
    }
    expect(rows.length).toBe(3);
  });

  it('manifests a temporary table any pooled connection can read', async () => {
    const name = await connection.manifestTemporaryTable('SELECT 42 AS answer');
    expect(name).toMatch(/^tempdb\.dbo\.malloy_tt/);
    const res = await connection.runRawSQL(`SELECT answer FROM ${name}`);
    expect(res.rows[0]['answer']).toBe(42);
  });

  it('connects through a connection string', async () => {
    const e = process.env;
    const trust = e['MSSQL_TRUST_SERVER_CERTIFICATE'] === 'true';
    const viaString = new SQLServerConnection('cs', {
      connectionString: `Server=${e['MSSQL_HOST']},${e['MSSQL_PORT']};Database=${e['MSSQL_DATABASE']};User Id=${e['MSSQL_USER']};Password=${e['MSSQL_PASSWORD']};TrustServerCertificate=${trust}`,
    });
    try {
      const res = await viaString.runRawSQL('SELECT 1 AS one');
      expect(res.rows[0]['one']).toBe(1);
    } finally {
      await viaString.close();
    }
  });

  it('leaves no table behind a query that fails while filling it', async () => {
    const bad = 'SELECT 1 AS a UNION ALL SELECT 1/0';
    await expect(connection.manifestTemporaryTable(bad)).rejects.toThrow(
      /zero/i
    );
    // The second call would return the empty table, had the first kept it
    await expect(connection.manifestTemporaryTable(bad)).rejects.toThrow(
      /zero/i
    );
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
