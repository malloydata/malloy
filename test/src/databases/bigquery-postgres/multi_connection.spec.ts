/* eslint-disable no-console */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import * as malloy from '@malloydata/malloy';
import {EmptyURLReader} from '@malloydata/malloy';
import {BigQueryTestConnection, PostgresTestConnection} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const res = describeIfDatabaseAvailable(['bigquery', 'postgres']);
let [describe] = res;
const [, databases] = res;

// *** NOTE ***
// this is a special case (for now): a test that REQUIRES two databases - bigquery AND postgres
describe =
  databases.filter(d => ['postgres', 'bigquery'].includes(d)).length >= 2
    ? describe
    : describe.skip;

describe('Multi-connection', () => {
  const bqConnection = new BigQueryTestConnection(
    'bigquery',
    {},
    {defaultProject: 'malloy-data'}
  );
  const postgresConnection = new PostgresTestConnection('postgres');
  const files = new EmptyURLReader();

  const connectionMap = new malloy.FixedConnectionMap(
    new Map(
      Object.entries({
        bigquery: bqConnection,
        postgres: postgresConnection,
      })
    ),
    'bigquery'
  );

  const runtime = new malloy.Runtime(files, connectionMap);

  afterAll(async () => {
    await postgresConnection.close();
  });

  const expressionModelText = `
source: bigquery_state_facts is bigquery.table('malloytest.state_facts') extend {
  measure: state_count is count(state)+2
}

source: postgres_aircraft is postgres.table('malloytest.aircraft') extend {
  measure: aircraft_count is count(tail_num)+4
}
`;

  const expressionModel = runtime.loadModel(expressionModelText);

  it('bigquery query', async () => {
    const result = await expressionModel
      .loadQuery(
        `
      run: bigquery_state_facts-> {
        aggregate: state_count
      }
    `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, 'state_count').value).toBe(53);
  });

  it('postgres query', async () => {
    const result = await expressionModel
      .loadQuery(
        `
      run: postgres_aircraft-> {
        aggregate: aircraft_count
      }
    `
      )
      .run();
    expect(result.data.path(0, 'aircraft_count').value).toBe(3603);
  });

  it('postgres raw query', async () => {
    const result = await runtime
      .loadQuery(
        `
      run: postgres.table('malloytest.airports')->{
        group_by:
          version is version!()
        aggregate:
          code_count is count(code)
          airport_count is count()
      }
    `
      )
      .run();
    expect(result.data.path(0, 'airport_count').value).toBe(19793);
    expect(result.data.path(0, 'version').value).toMatch(/Postgre/);
    expect(result.data.path(0, 'code_count').value).toBe(19793);
  });
});
