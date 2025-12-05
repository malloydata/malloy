/*
 * Copyright 2025 Google LLC
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

import {DatabricksConnection} from './databricks_connection';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['databricks']);

const warehouseId = process.env['DATABRICKS_WAREHOUSE_ID'];
const fullPath = `/sql/1.0/warehouses/${warehouseId}`;

/*
 * !IMPORTANT
 *
 * The connection is reused for each test, so if you do not name your tables
 * and keys uniquely for each test you will see cross test interactions.
 */

describe('DataBricksConnection', () => {
  let connection: DatabricksConnection;

  beforeAll(async () => {
    connection = new DatabricksConnection('databricks', {
        host: process.env['DATABRICKS_HOST'],
        path: fullPath,
        token: process.env['DATABRICKS_TOKEN'],
        name:  'test',
        defaultCatalog:  'samples',
        defaultSchema: 'default',
      });


    await connection.runSQL('SELECT current_catalog(), current_schema()');
  });

  afterAll(async () => {
    await connection.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('can execute select 1', async () => {
    const result = await connection.runSQL('SELECT 1');
    expect(result.rows).toEqual([{1: 1}]);
  });

  it('runs a SQL query', async () => {
    const result = await connection.runSQL('SELECT 1 as t');
    expect(result.rows[0]['t']).toBe(1);
  });

  it('can execute current_catalog and current_schema', async () => {
    const result = await connection.runSQL('SELECT current_catalog(), current_schema()');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['current_catalog()']).toBe('samples');
    expect(result.rows[0]['current_schema()']).toBe('default');
  });

});