/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Job} from '@google-cloud/bigquery';
import {
  getQueryResultsUntilComplete,
  isQueryStillRunningError,
} from './bigquery_connection';

// The BigQuery client throws this exact shape when a getQueryResults call
// returns with the job still running.
function stillRunning(ms = 120000): Error {
  return new Error(`The query did not complete before ${ms}ms`);
}

// A completed result is the [rows, nextQuery, apiResponse] tuple the client
// resolves with; only its identity matters to these tests.
const COMPLETE = [[{n: 1}], null, {jobComplete: true}];

function fakeJob(getQueryResults: jest.Mock): Pick<Job, 'getQueryResults'> {
  return {getQueryResults} as unknown as Pick<Job, 'getQueryResults'>;
}

describe('getQueryResultsUntilComplete', () => {
  it('returns immediately when the job is already complete', async () => {
    const getQueryResults = jest.fn().mockResolvedValue(COMPLETE);
    const out = await getQueryResultsUntilComplete(
      fakeJob(getQueryResults),
      {},
      600_000,
      () => 0
    );
    expect(out).toBe(COMPLETE);
    expect(getQueryResults).toHaveBeenCalledTimes(1);
  });

  it('polls past "still running" timeouts until the job completes', async () => {
    const getQueryResults = jest
      .fn()
      .mockRejectedValueOnce(stillRunning())
      .mockRejectedValueOnce(stillRunning())
      .mockResolvedValue(COMPLETE);
    const out = await getQueryResultsUntilComplete(
      fakeJob(getQueryResults),
      {},
      600_000,
      () => 0 // always within the deadline
    );
    expect(out).toBe(COMPLETE);
    expect(getQueryResults).toHaveBeenCalledTimes(3);
  });

  it('gives up once the deadline passes while the job is still running', async () => {
    const getQueryResults = jest.fn().mockRejectedValue(stillRunning());
    // now() advances 100s each call: startedAt=0, then 100s (within 150s),
    // then 200s (past the deadline) -> throw.
    let calls = 0;
    const now = () => calls++ * 100_000;
    await expect(
      getQueryResultsUntilComplete(fakeJob(getQueryResults), {}, 150_000, now)
    ).rejects.toThrow(/did not complete before/);
    expect(getQueryResults).toHaveBeenCalledTimes(2);
  });

  it('retries a bounded number of times on a transient error, then rethrows', async () => {
    const boom = new Error('transient access denied requesting results');
    const getQueryResults = jest.fn().mockRejectedValue(boom);
    await expect(
      getQueryResultsUntilComplete(
        fakeJob(getQueryResults),
        {},
        600_000,
        () => 0 // always within the deadline
      )
    ).rejects.toThrow('transient access denied');
    // initial attempt + 3 bounded retries
    expect(getQueryResults).toHaveBeenCalledTimes(4);
  });
});

describe('isQueryStillRunningError', () => {
  it('matches the client job-not-complete timeout message', () => {
    expect(isQueryStillRunningError(stillRunning())).toBe(true);
    expect(isQueryStillRunningError(stillRunning(600000))).toBe(true);
  });

  it('does not match unrelated errors or non-errors', () => {
    expect(isQueryStillRunningError(new Error('access denied'))).toBe(false);
    expect(isQueryStillRunningError('did not complete before 1ms')).toBe(false);
    expect(isQueryStillRunningError(undefined)).toBe(false);
  });
});
