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

import {DatabricksConnection} from './databricks_connection';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['databricks']);

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
        host: process.env['DATABRICKS_HOST'] ?? '',
        path: process.env['DATABRICKS_PATH'] ?? '',
        token: process.env['DATABRICKS_TOKEN'] ?? '',
        name: process.env['DATABRICKS_NAME'] ?? 'test',
        defaultCatalog: process.env['DATABRICKS_CATALOG'] ?? 'samples',
        defaultSchema: process.env['DATABRICKS_SCHEMA'] ?? 'default',
      });


    await connection.runSQL('SELECT 1');
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
});
