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

describe('db-bigquery queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('applies per-call job labels to createQueryJob', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1', {
      queryMetadata: {bigquery: {jobLabels: {team: 'finance'}}},
    });
    expect(firstJobConfig(spy)['labels']).toEqual({team: 'finance'});
  });

  it('applies connection-default job labels (from queryOptions) to createQueryJob', async () => {
    const {conn, spy} = makeConn({
      queryMetadata: {bigquery: {jobLabels: {app: 'credible'}}},
    });
    await conn.runSQL('SELECT 1');
    expect(firstJobConfig(spy)['labels']).toEqual({app: 'credible'});
  });

  it('merges per-call labels over the connection default (per key)', async () => {
    const {conn, spy} = makeConn({
      queryMetadata: {
        bigquery: {jobLabels: {app: 'credible', team: 'default'}},
      },
    });
    await conn.runSQL('SELECT 1', {
      queryMetadata: {bigquery: {jobLabels: {team: 'finance'}}},
    });
    expect(firstJobConfig(spy)['labels']).toEqual({
      app: 'credible',
      team: 'finance',
    });
  });

  it('sets no labels when no metadata is present', async () => {
    const {conn, spy} = makeConn();
    await conn.runSQL('SELECT 1');
    expect(firstJobConfig(spy)['labels']).toBeUndefined();
  });

  it('surfaces the job id/location as runStats.executionMetadata.bigquery', async () => {
    const {conn} = makeConn();
    const res = await conn.runSQL('SELECT 1');
    expect(res.runStats?.executionMetadata?.bigquery).toEqual({
      jobId: 'job-abc',
      location: 'US',
    });
  });
});
