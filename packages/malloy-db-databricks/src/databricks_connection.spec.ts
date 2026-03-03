/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DatabricksConnection} from '.';
import {createTestRuntime, mkTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

const host = process.env['DATABRICKS_HOST'] ?? '';
const token = process.env['DATABRICKS_TOKEN'] ?? '';
const warehouseId = process.env['DATABRICKS_WAREHOUSE_ID'] ?? '';
const path =
  process.env['DATABRICKS_PATH'] ||
  (warehouseId ? `/sql/1.0/warehouses/${warehouseId}` : '');

const dbr_connection = new DatabricksConnection('databricks', {
  host,
  path,
  token,
});

afterAll(async () => {
  await dbr_connection.close();
});

async function schemaFor(selectStr: string) {
  const res = await dbr_connection.fetchSchemaForSQLStruct(
    {selectStr, connection: 'databricks'},
    {}
  );
  if ('error' in res && res.error) {
    throw new Error(res.error);
  }
  return res.structDef!.fields;
}

describe('basic connectivity', () => {
  it('runs SELECT 1', async () => {
    const res = await dbr_connection.runSQL('SELECT 1 as t');
    expect(res.rows[0]['t']).toBe(1);
  });
});

describe('schema recognition — atomic types', () => {
  it.each([
    ['INT', 'integer'],
    ['BIGINT', 'bigint'],
    ['DOUBLE', 'float'],
    ['FLOAT', 'float'],
    ['DECIMAL(10,2)', 'float'],
    ['DECIMAL(18,0)', 'integer'],
  ])('maps %s to number/%s', async (sqlType, numberType) => {
    const fields = await schemaFor(`SELECT CAST(1 AS ${sqlType}) as v`);
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'number',
      numberType,
    });
  });

  it.each(['STRING', 'VARCHAR(100)'])('maps %s to string', async sqlType => {
    const fields = await schemaFor(`SELECT CAST('x' AS ${sqlType}) as v`);
    expect(fields[0]).toEqual({name: 'v', type: 'string'});
  });

  it('maps BOOLEAN to boolean', async () => {
    const fields = await schemaFor('SELECT CAST(true AS BOOLEAN) as v');
    expect(fields[0]).toEqual({name: 'v', type: 'boolean'});
  });

  it('maps DATE to date', async () => {
    const fields = await schemaFor('SELECT CAST(CURRENT_DATE() AS DATE) as v');
    expect(fields[0]).toEqual({name: 'v', type: 'date'});
  });

  it('maps TIMESTAMP to timestamp', async () => {
    const fields = await schemaFor(
      'SELECT CAST(CURRENT_TIMESTAMP() AS TIMESTAMP) as v'
    );
    expect(fields[0]).toEqual({name: 'v', type: 'timestamp'});
  });

  it('maps TIMESTAMP_NTZ to sql native', async () => {
    const fields = await schemaFor(
      'SELECT CAST(CURRENT_TIMESTAMP() AS TIMESTAMP_NTZ) as v'
    );
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'sql native',
      rawType: 'timestamp_ntz',
    });
  });
});

describe('schema recognition — complex types', () => {
  it('parses ARRAY<INT>', async () => {
    const fields = await schemaFor('SELECT ARRAY(1, 2, 3) as v');
    expect(fields[0]).toMatchObject({
      name: 'v',
      type: 'array',
      elementTypeDef: {type: 'number', numberType: 'integer'},
    });
  });

  it('parses STRUCT', async () => {
    const fields = await schemaFor(
      "SELECT NAMED_STRUCT('a', 1.0D, 'b', 2, 'c', 'hello') as v"
    );
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'record',
      join: 'one',
      fields: [
        {name: 'a', type: 'number', numberType: 'float'},
        {name: 'b', type: 'number', numberType: 'integer'},
        {name: 'c', type: 'string'},
      ],
    });
  });

  it('parses ARRAY<STRUCT<...>> (repeated record)', async () => {
    const fields = await schemaFor(
      "SELECT ARRAY(NAMED_STRUCT('a', 1.0D, 'b', 2, 'c', 'hello')) as v"
    );
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'array',
      join: 'many',
      elementTypeDef: {type: 'record_element'},
      fields: [
        {name: 'a', type: 'number', numberType: 'float'},
        {name: 'b', type: 'number', numberType: 'integer'},
        {name: 'c', type: 'string'},
      ],
    });
  });
});

describe('data hydration — atomic types', () => {
  const runtime = createTestRuntime(dbr_connection);
  const testModel = mkTestModel(runtime, {});

  it('reads integer', async () => {
    await expect('run: databricks.sql("SELECT 42 as v")').toMatchResult(
      testModel,
      {v: 42}
    );
  });

  it('reads float', async () => {
    await expect('run: databricks.sql("SELECT 3.14 as v")').toMatchResult(
      testModel,
      {v: 3.14}
    );
  });

  it('reads string', async () => {
    await expect('run: databricks.sql("SELECT \'hello\' as v")').toMatchResult(
      testModel,
      {v: 'hello'}
    );
  });

  it('reads boolean', async () => {
    await expect('run: databricks.sql("SELECT true as v")').toMatchResult(
      testModel,
      {v: true}
    );
  });

  it('reads date', async () => {
    await expect(
      'run: databricks.sql("SELECT DATE \'2024-01-15\' as v")'
    ).toMatchResult(testModel, {v: '2024-01-15T00:00:00.000Z'});
  });

  it('reads timestamp', async () => {
    await expect(
      'run: databricks.sql("SELECT TIMESTAMP \'2024-01-15 10:30:00\' as v")'
    ).toMatchResult(testModel, {v: '2024-01-15T10:30:00.000Z'});
  });
});

describe('data hydration — complex types', () => {
  const runtime = createTestRuntime(dbr_connection);
  const testModel = mkTestModel(runtime, {});

  it('reads array of integers', async () => {
    await expect(
      'run: databricks.sql("SELECT ARRAY(1, 2, 3) as v")'
    ).toMatchResult(testModel, {v: [1, 2, 3]});
  });

  it('reads struct', async () => {
    await expect(
      "run: databricks.sql(\"SELECT NAMED_STRUCT('a', 1.0D, 'b', 'hello') as v\")"
    ).toMatchResult(testModel, {v: {a: 1.0, b: 'hello'}});
  });

  it('reads array of structs', async () => {
    await expect(
      "run: databricks.sql(\"SELECT ARRAY(NAMED_STRUCT('x', 1, 'y', 'a'), NAMED_STRUCT('x', 2, 'y', 'b')) as v\")"
    ).toMatchResult(testModel, {
      v: [
        {x: 1, y: 'a'},
        {x: 2, y: 'b'},
      ],
    });
  });
});
