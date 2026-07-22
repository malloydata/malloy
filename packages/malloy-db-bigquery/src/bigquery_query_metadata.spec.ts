/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryOptionsReader} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';

// A fake BigQuery job with just enough surface for createBigQueryJobAndGetResults.
function fakeJob(id = 'job-abc', location = 'US') {
  return {
    id,
    location,
    cancel: () => {},
    getQueryResults: async () => [
      [{n: 1}],
      null,
      {totalRows: '1', totalBytesProcessed: '42', schema: {fields: []}},
    ],
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

describe('db-bigquery queryTags wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('applies per-call labels to createQueryJob', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {queryTags: {labels: {team: 'finance'}}});
    expect(firstJobConfig(spy)['labels']).toEqual({team: 'finance'});
  });

  it('folds applicationName in under the reserved label key', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {
      queryTags: {applicationName: 'my-app', labels: {team: 'finance'}},
    });
    expect(firstJobConfig(spy)['labels']).toEqual({
      team: 'finance',
      application: 'my-app',
    });
  });

  it('transforms labels to BigQuery grammar (lowercase, substitute, drop invalid keys)', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {
      queryTags: {
        labels: {
          'CostCenter': 'Eng Team', // uppercase + space -> lowercased, space -> _
          '2024plan': 'x', // key starts with a digit -> dropped
        },
      },
    });
    expect(firstJobConfig(spy)['labels']).toEqual({costcenter: 'eng_team'});
  });

  it('applies connection-default labels (from queryOptions) to createQueryJob', async () => {
    const {conn, spy} = makeConn({queryTags: {applicationName: 'my-app'}});
    await conn.runSQL('SELECT 1');
    expect(firstJobConfig(spy)['labels']).toEqual({application: 'my-app'});
  });

  it('merges per-call labels over the connection default (per key)', async () => {
    const {conn, spy} = makeConn({
      queryTags: {labels: {app: 'my-app', team: 'default'}},
    });
    await conn.runSQL('SELECT 1', {queryTags: {labels: {team: 'finance'}}});
    expect(firstJobConfig(spy)['labels']).toEqual({
      app: 'my-app',
      team: 'finance',
    });
  });

  it('sets no labels when no tags are present', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1');
    expect(firstJobConfig(spy)['labels']).toBeUndefined();
  });

  it('surfaces the job id/location as runStats.executionId/executionInfo', async () => {
    const {conn} = makeConn();
    const res = await conn.runSQL('SELECT 1');
    expect(res.runStats?.executionId).toBe('job-abc');
    expect(res.runStats?.executionInfo).toEqual({location: 'US'});
  });
});
