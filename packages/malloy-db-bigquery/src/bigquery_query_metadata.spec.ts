/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryOptionsReader} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';

// A fake BigQuery job with just enough surface for createBigQueryJobAndGetResults.
// getQueryResults uses the callback overload (err, rows, nextQuery, apiResponse)
// and reports jobComplete so the connector's poll loop settles immediately.
function fakeJob(id = 'job-abc', location = 'US') {
  return {
    id,
    location,
    cancel: () => {},
    getQueryResults: (
      _options: unknown,
      cb: (
        err: unknown,
        rows: unknown,
        nextQuery: unknown,
        apiResponse: unknown
      ) => void
    ) =>
      cb(null, [{n: 1}], null, {
        jobComplete: true,
        totalRows: '1',
        totalBytesProcessed: '42',
        schema: {fields: []},
      }),
  };
}

// Build a connection whose SDK createQueryJob is spied — no network, no creds.
function makeConn(queryOptions?: QueryOptionsReader): {
  conn: BigQueryConnection;
  spy: jest.SpyInstance;
} {
  const conn = new BigQueryConnection('bq', queryOptions, {
    projectId: 'test-proj',
    billingProjectId: 'test-proj',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bq = (conn as any).bigQuery;
  const spy = jest
    .spyOn(bq, 'createQueryJob')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation(async () => [fakeJob()] as any);
  return {conn, spy};
}

// The job-config options passed to the SDK on the first createQueryJob call.
function firstJobConfig(spy: jest.SpyInstance): Record<string, unknown> {
  return spy.mock.calls[0][0] as Record<string, unknown>;
}

describe('db-bigquery queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('applies the per-call property bag to createQueryJob', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {queryMetadata: {team: 'finance'}});
    expect(firstJobConfig(spy)['labels']).toEqual({team: 'finance'});
  });

  it('treats application_name as an ordinary label (BigQuery-transformed)', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {
      queryMetadata: {application_name: 'my-app', team: 'finance'},
    });
    expect(firstJobConfig(spy)['labels']).toEqual({
      application_name: 'my-app',
      team: 'finance',
    });
  });

  it('transforms labels to BigQuery grammar (lowercase, substitute, drop invalid keys)', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {
      queryMetadata: {
        'CostCenter': 'Eng Team', // uppercase + space -> lowercased, space -> _
        '2024plan': 'x', // contract-valid, but BQ needs a leading letter -> dropped
      },
    });
    expect(firstJobConfig(spy)['labels']).toEqual({costcenter: 'eng_team'});
  });

  it('does not inherit metadata from the connection default (queryOptions)', async () => {
    const {conn, spy} = makeConn({queryMetadata: {application_name: 'my-app'}});
    await conn.runSQL('SELECT 1');
    // queryMetadata is per-call only; a queryOptions default is ignored.
    expect(firstJobConfig(spy)['labels']).toBeUndefined();
  });

  it('sets no labels when no metadata is present', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1');
    expect(firstJobConfig(spy)['labels']).toBeUndefined();
  });
});
