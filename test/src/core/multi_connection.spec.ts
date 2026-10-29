/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as malloy from '@malloydata/malloy';
import {EmptyURLReader} from '@malloydata/malloy';
import {DuckDBROTestConnection, PostgresTestConnection} from '../runtimes';
import {describeIfDatabaseAvailable} from '../util';

const [, databases] = describeIfDatabaseAvailable(['duckdb', 'postgres']);

// *** NOTE ***
// this is a special case (for now): a test that REQUIRES two databases - duckdb AND postgres
const describe =
  databases.filter(d => ['postgres', 'duckdb'].includes(d)).length >= 2
    ? globalThis.describe
    : globalThis.describe.skip;

describe('Multi-connection', () => {
  const ddbConnection = new DuckDBROTestConnection(
    'duckdb',
    'test/data/duckdb/duckdb_test.db'
  );
  const postgresConnection = new PostgresTestConnection('postgres');
  const files = new EmptyURLReader();

  const connectionMap = new malloy.FixedConnectionMap(
    new Map(
      Object.entries({
        duckdb: ddbConnection,
        postgres: postgresConnection,
      })
    ),
    'duckdb'
  );

  const runtime = new malloy.Runtime({
    urlReader: files,
    connections: connectionMap,
  });

  afterAll(async () => {
    await postgresConnection.close();
  });

  const expressionModelText = `
source: duckdb_state_facts is duckdb.table('malloytest.state_facts') extend {
  measure: state_count is count(state)+2
}

source: postgres_aircraft is postgres.table('malloytest.aircraft') extend {
  measure: aircraft_count is count(tail_num)+4
}
`;

  const expressionModel = runtime.loadModel(expressionModelText);

  it('duckdb query', async () => {
    const result = await expressionModel
      .loadQuery(
        `
      run: duckdb_state_facts-> {
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
          version is version!string()
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
