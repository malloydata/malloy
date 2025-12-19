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

import * as malloy from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {SnowflakeConnection} from './snowflake_connection';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as fs from 'fs';
import {SnowflakeExecutor} from './snowflake_executor';

const [describe] = describeIfDatabaseAvailable(['snowflake']);

describe('db:Snowflake', () => {
  let conn: SnowflakeConnection;
  let runtime: malloy.Runtime;

  beforeAll(() => {
    const connOptions =
      SnowflakeExecutor.getConnectionOptionsFromEnv() ||
      SnowflakeExecutor.getConnectionOptionsFromToml();
    conn = new SnowflakeConnection('snowflake', {
      connOptions: connOptions,
      queryOptions: {rowLimit: 1000},
    });
    const files = {
      readURL: async (url: URL) => {
        const filePath = fileURLToPath(url);
        return await util.promisify(fs.readFile)(filePath, 'utf8');
      },
    };
    runtime = new malloy.Runtime({
      urlReader: files,
      connection: conn,
    });
  });

  afterAll(async () => {
    await conn.close();
  });

  it('runs a SQL query', async () => {
    const res = await conn.runSQL('SELECT 1 as T');
    expect(malloy.API.rowDataToNumber(res.rows[0]['T'])).toBe(1);
  });

  it('runs a Malloy query', async () => {
    const sql = await runtime
      .loadModel("source: aircraft is snowflake.table('malloytest.aircraft')")
      .loadQuery(
        `run:  aircraft -> {
        where: state is not null
        aggregate: cnt is count()
        group_by:  state}`
      )
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.totalRows).toBe(55);
    let total = 0;
    for (const row of res.rows) {
      total += malloy.API.rowDataToNumber(row['cnt'] ?? 0);
    }
    expect(total).toBe(3540);

    // if we request for a smaller rowLimit we should get fewer rows
    const res_limited = await conn.runSQL(sql, {rowLimit: 10});
    expect(res_limited.totalRows).toBe(10);
  });

  it('runs a Malloy query on an sql source', async () => {
    const sql = await runtime
      .loadModel(
        "source: aircraft is snowflake.sql('SELECT * FROM malloytest.AIRCRAFT')"
      )
      .loadQuery('run:  aircraft -> { aggregate: cnt is count() }')
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.rows.length).toBe(1);
    expect(malloy.API.rowDataToNumber(res.rows[0]['cnt'])).toBe(3599);
  });

  it('runs a Malloy function with overrides', async () => {
    const sql = await runtime
      .loadModel("source: aircraft is snowflake.table('malloytest.aircraft')")
      .loadQuery('run: aircraft -> { select: rand is rand(), limit: 1}')
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.rows[0]['rand']).toBeGreaterThanOrEqual(0);
    expect(res.rows[0]['rand']).toBeLessThanOrEqual(1);
  });

  it('variant parser is not confused by arrays with numbers in name', async () => {
    const x: malloy.SQLSourceDef = {
      type: 'sql_select',
      name: 'one_two_three',
      connection: conn.name,
      dialect: conn.dialectName,
      selectStr: 'SELECT [1,2,3] as one_23',
      fields: [],
    };
    const y = await conn.fetchSelectSchema(x);
    expect(y.fields[0].name).toEqual('ONE_23');
  });

  it('parses all three timestamp types', async () => {
    const x: malloy.SQLSourceDef = {
      type: 'sql_select',
      name: 'three_timestamps',
      connection: conn.name,
      dialect: conn.dialectName,
      selectStr: `
        SELECT
          TO_TIMESTAMP_NTZ('2024-01-01 12:34:56') AS TS_NTZ,
          TO_TIMESTAMP_LTZ('2024-01-01 12:34:56') AS TS_LTZ,
          TO_TIMESTAMP_TZ('2024-01-01 12:34:56 +00:00') AS TS_TZ
      `,
      fields: [],
    };
    const y = await conn.fetchSelectSchema(x);
    expect(y.fields).toEqual([
      {name: 'TS_NTZ', type: 'timestamp'},
      {name: 'TS_LTZ', type: 'sql native', rawType: 'timestamp_ltz'},
      {name: 'TS_TZ', type: 'timestamptz'},
    ]);
  });

  it('maps integer types to bigint', async () => {
    const x: malloy.SQLSourceDef = {
      type: 'sql_select',
      name: 'integer_types',
      connection: conn.name,
      dialect: conn.dialectName,
      selectStr: `
        SELECT
          1::INTEGER AS int_val,
          2::BIGINT AS bigint_val,
          3::NUMBER(38,0) AS number_val
      `,
      fields: [],
    };
    const y = await conn.fetchSelectSchema(x);
    // Snowflake maps all integer types to bigint since NUMBER can hold 38 digits
    expect(y.fields).toEqual([
      {name: 'INT_VAL', type: 'number', numberType: 'bigint'},
      {name: 'BIGINT_VAL', type: 'number', numberType: 'bigint'},
      {name: 'NUMBER_VAL', type: 'number', numberType: 'bigint'},
    ]);
  });
});
