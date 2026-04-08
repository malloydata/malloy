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
import {createTestRuntime, mkTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';
import {SnowflakeConnection} from './snowflake_connection';
import {SnowflakeExecutor} from './snowflake_executor';

describe('db:Snowflake', () => {
  const connOptions =
    SnowflakeExecutor.getConnectionOptionsFromEnv() ||
    SnowflakeExecutor.getConnectionOptionsFromToml();
  const conn = new SnowflakeConnection('snowflake', {
    connOptions: connOptions,
    queryOptions: {rowLimit: 1000},
  });
  const runtime = createTestRuntime(conn);

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

  it('discovers variant schema through a view', async () => {
    // Create a view with a variant column, then fetch its schema.
    // This exercises the TABLESAMPLE fallback path — TABLESAMPLE fails
    // on views, so the code should fall back to LIMIT 100.
    const salt = Math.random().toString(36).slice(2, 10);
    const viewName = `malloytest.test_variant_view_${salt}`;
    await conn.runSQL(
      `CREATE OR REPLACE VIEW ${viewName} AS
       SELECT parse_json('{"a": 1, "b": "hello"}') AS data`
    );
    try {
      const schema = await conn.fetchTableSchema(viewName, viewName);
      const dataField = schema.fields.find(f => f.name === 'DATA');
      expect(dataField).toBeDefined();
      // Should have discovered the inner structure, not fallen back to sql native
      expect(dataField!.type).toBe('record');
    } finally {
      await conn.runSQL(`DROP VIEW IF EXISTS ${viewName}`);
    }
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

  it('degrades variant field to sql native when types conflict across rows', async () => {
    // data.foo is a scalar in one row and an object in another.
    // Schema discovery should not throw — foo should degrade to sql native.
    const salt = Math.random().toString(36).slice(2, 10);
    const viewName = `malloytest.test_variant_conflict_${salt}`;
    await conn.runSQL(
      `CREATE OR REPLACE VIEW ${viewName} AS
       SELECT parse_json('{"foo": {"bar": 1}}') AS data
       UNION ALL
       SELECT parse_json('{"foo": "oops"}') AS data`
    );
    try {
      const schema = await conn.fetchTableSchema(viewName, viewName);
      const dataField = schema.fields.find(f => f.name === 'DATA');
      expect(dataField).toBeDefined();
      expect(dataField!.type).toBe('record');
      if (dataField!.type === 'record') {
        const fooField = dataField!.fields.find(f => f.name === 'foo');
        expect(fooField).toEqual({
          type: 'sql native',
          rawType: 'variant',
          name: 'foo',
        });
      }
    } finally {
      await conn.runSQL(`DROP VIEW IF EXISTS ${viewName}`);
    }
  });

  it('degrades nested object inside array when types conflict', async () => {
    // Array analogue of the customer bug: items[*].foo is an object in
    // one row and a scalar in another. foo should degrade to sql native.
    const salt = Math.random().toString(36).slice(2, 10);
    const viewName = `malloytest.test_variant_array_obj_conflict_${salt}`;
    await conn.runSQL(
      `CREATE OR REPLACE VIEW ${viewName} AS
       SELECT parse_json('{"items": [{"foo": {"bar": 1}}]}') AS data
       UNION ALL
       SELECT parse_json('{"items": [{"foo": "oops"}]}') AS data`
    );
    try {
      const schema = await conn.fetchTableSchema(viewName, viewName);
      const dataField = schema.fields.find(f => f.name === 'DATA');
      expect(dataField).toBeDefined();
      expect(dataField!.type).toBe('record');
      if (dataField!.type === 'record') {
        const itemsField = dataField!.fields.find(f => f.name === 'items');
        expect(itemsField).toBeDefined();
        expect(itemsField!.type).toBe('array');
        if (itemsField!.type === 'array') {
          expect(itemsField!.elementTypeDef).toEqual({
            type: 'record_element',
          });
          const fooField = itemsField!.fields.find(f => f.name === 'foo');
          expect(fooField).toEqual({
            type: 'sql native',
            rawType: 'variant',
            name: 'foo',
          });
        }
      }
    } finally {
      await conn.runSQL(`DROP VIEW IF EXISTS ${viewName}`);
    }
  });

  it('degrades when same path is object in one row and array in another', async () => {
    // foo is an object in one row and an array in another.
    // foo should degrade to sql native.
    const salt = Math.random().toString(36).slice(2, 10);
    const viewName = `malloytest.test_variant_obj_array_conflict_${salt}`;
    await conn.runSQL(
      `CREATE OR REPLACE VIEW ${viewName} AS
       SELECT parse_json('{"foo": {"bar": 1}}') AS data
       UNION ALL
       SELECT parse_json('{"foo": [1, 2, 3]}') AS data`
    );
    try {
      const schema = await conn.fetchTableSchema(viewName, viewName);
      const dataField = schema.fields.find(f => f.name === 'DATA');
      expect(dataField).toBeDefined();
      expect(dataField!.type).toBe('record');
      if (dataField!.type === 'record') {
        const fooField = dataField!.fields.find(f => f.name === 'foo');
        expect(fooField).toEqual({
          type: 'sql native',
          rawType: 'variant',
          name: 'foo',
        });
      }
    } finally {
      await conn.runSQL(`DROP VIEW IF EXISTS ${viewName}`);
    }
  });

  it('preserves sibling fields when one field degrades', async () => {
    // foo has conflicting types but stable is consistent.
    // stable should come through normally.
    const salt = Math.random().toString(36).slice(2, 10);
    const viewName = `malloytest.test_variant_sibling_${salt}`;
    await conn.runSQL(
      `CREATE OR REPLACE VIEW ${viewName} AS
       SELECT parse_json('{"foo": {"bar": 1}, "stable": 7}') AS data
       UNION ALL
       SELECT parse_json('{"foo": "oops", "stable": 8}') AS data`
    );
    try {
      const schema = await conn.fetchTableSchema(viewName, viewName);
      const dataField = schema.fields.find(f => f.name === 'DATA');
      expect(dataField).toBeDefined();
      expect(dataField!.type).toBe('record');
      if (dataField!.type === 'record') {
        const fooField = dataField!.fields.find(f => f.name === 'foo');
        expect(fooField).toEqual({
          type: 'sql native',
          rawType: 'variant',
          name: 'foo',
        });
        const stableField = dataField!.fields.find(f => f.name === 'stable');
        expect(stableField).toEqual({
          type: 'number',
          numberType: 'bigint',
          name: 'stable',
        });
      }
    } finally {
      await conn.runSQL(`DROP VIEW IF EXISTS ${viewName}`);
    }
  });
});

/**
 * Tests for reading numeric values through Malloy queries
 */
describe('numeric value reading', () => {
  const connOptions =
    SnowflakeExecutor.getConnectionOptionsFromEnv() ||
    SnowflakeExecutor.getConnectionOptionsFromToml();
  const connection = new SnowflakeConnection('snowflake_numeric_tests', {
    connOptions: connOptions,
    queryOptions: {rowLimit: 1000},
  });
  const runtime = createTestRuntime(connection);
  const testModel = mkTestModel(runtime, {});

  afterAll(async () => {
    await connection.close();
  });

  describe('integer types', () => {
    it.each(['INTEGER', 'BIGINT', 'NUMBER(38,0)'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: snowflake.sql("SELECT 10::${sqlType} as d")`
        ).toMatchResult(testModel, {D: 10});
      }
    );

    it('preserves precision for literal integers > 2^53', async () => {
      const largeInt = BigInt('9007199254740993'); // 2^53 + 1
      await expect(`
        run: snowflake.sql("select 1 as n") -> { select: d is ${largeInt} }
      `).toMatchResult(testModel, {d: largeInt});
    });
  });

  describe('float types', () => {
    it.each(['FLOAT', 'DOUBLE', 'NUMBER(10,2)'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: snowflake.sql("SELECT 10.5::${sqlType} as f")`
        ).toMatchResult(testModel, {F: 10.5});
      }
    );
  });
});
