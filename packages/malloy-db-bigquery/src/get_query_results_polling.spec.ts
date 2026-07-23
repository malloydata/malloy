/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Job} from '@google-cloud/bigquery';
import {getQueryResultsUntilComplete} from './bigquery_connection';

// The BigQuery client's callback overload yields (err, rows, nextQuery,
// apiResponse). Helpers build the three outcomes the client can produce.
type Cb = (
  err: unknown,
  rows: unknown,
  nextQuery: unknown,
  resp: unknown
) => void;
type Step = (cb: Cb) => void;

// Still running: the client passes a synthetic "did not complete" error AND an
// apiResponse with jobComplete === false. Our code keys off the boolean.
const stillRunning: Step = cb =>
  cb(new Error('The query did not complete before 120000ms'), null, null, {
    jobComplete: false,
  });
const complete =
  (rows: unknown[] = [{n: 1}]): Step =>
  cb =>
    cb(null, rows, null, {jobComplete: true});
const transient =
  (message: string): Step =>
  cb =>
    cb(new Error(message), null, null, undefined);
// A poll that never calls back — simulates the in-flight server-side wait.
const pending: Step = () => {};

// Build a fake job whose getQueryResults plays a scripted sequence of steps
// (the last step repeats if called again).
function scriptedJob(steps: Step[]): {
  job: Pick<Job, 'getQueryResults'>;
  getQueryResults: jest.Mock;
} {
  let i = 0;
  const getQueryResults = jest.fn((_options: unknown, cb: Cb) => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    step(cb);
  });
  return {
    job: {getQueryResults} as unknown as Pick<Job, 'getQueryResults'>,
    getQueryResults,
  };
}

describe('getQueryResultsUntilComplete', () => {
  it('returns immediately when the job is already complete', async () => {
    const {job, getQueryResults} = scriptedJob([complete()]);
    const out = await getQueryResultsUntilComplete(job, {}, 600_000, {
      now: () => 0,
    });
    expect(out[0]).toEqual([{n: 1}]);
    expect(getQueryResults).toHaveBeenCalledTimes(1);
  });

  it('polls past "still running" responses until the job completes', async () => {
    const {job, getQueryResults} = scriptedJob([
      stillRunning,
      stillRunning,
      complete(),
    ]);
    const out = await getQueryResultsUntilComplete(job, {}, 600_000, {
      now: () => 0,
    });
    expect(out[0]).toEqual([{n: 1}]);
    expect(getQueryResults).toHaveBeenCalledTimes(3);
  });

  it('clamps the per-poll timeout to the remaining deadline', async () => {
    const {job, getQueryResults} = scriptedJob([complete()]);
    // Deadline shorter than one poll interval -> first poll asks for the
    // remaining deadline, not the full GET_QUERY_RESULTS_POLL_MS.
    await getQueryResultsUntilComplete(job, {}, 30_000, {now: () => 0});
    expect(getQueryResults.mock.calls[0][0]).toMatchObject({timeoutMs: 30_000});
  });

  it('gives up with an actionable error once the deadline passes', async () => {
    let t = 0;
    const now = () => t;
    const {job, getQueryResults} = scriptedJob([
      cb => {
        t += 100_000; // each poll advances the clock 100s
        stillRunning(cb);
      },
    ]);
    await expect(
      getQueryResultsUntilComplete(job, {}, 150_000, {now})
    ).rejects.toThrow(
      /did not complete within the configured timeout of 150000ms.*timeoutMs/s
    );
    // startedAt=0; polls at t=100s (within 150s) and t=200s (over) -> 2 polls.
    expect(getQueryResults).toHaveBeenCalledTimes(2);
  });

  it('retries a bounded number of times on a transient error, then rethrows', async () => {
    const {job, getQueryResults} = scriptedJob([transient('access denied')]);
    await expect(
      getQueryResultsUntilComplete(job, {}, 600_000, {now: () => 0})
    ).rejects.toThrow('access denied');
    // initial attempt + 3 bounded retries
    expect(getQueryResults).toHaveBeenCalledTimes(4);
  });

  it('does not reset the transient-retry budget across still-running polls', async () => {
    // A still-running poll between each transient error must not refill the
    // 3-retry budget: 4 transient errors total should still exhaust it.
    const {job, getQueryResults} = scriptedJob([
      transient('boom-1'),
      stillRunning,
      transient('boom-2'),
      stillRunning,
      transient('boom-3'),
      stillRunning,
      transient('boom-4'),
    ]);
    await expect(
      getQueryResultsUntilComplete(job, {}, 600_000, {now: () => 0})
    ).rejects.toThrow('boom-4');
    expect(getQueryResults).toHaveBeenCalledTimes(7);
  });

  it('exits promptly when the abort signal fires mid-poll', async () => {
    const ac = new AbortController();
    const {job, getQueryResults} = scriptedJob([pending]); // poll never returns
    const promise = getQueryResultsUntilComplete(job, {}, 600_000, {
      abortSignal: ac.signal,
      now: () => 0,
    });
    ac.abort();
    await expect(promise).rejects.toThrow(/aborted/);
    expect(getQueryResults).toHaveBeenCalledTimes(1);
  });

  it('throws without polling when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const {job, getQueryResults} = scriptedJob([complete()]);
    await expect(
      getQueryResultsUntilComplete(job, {}, 600_000, {
        abortSignal: ac.signal,
        now: () => 0,
      })
    ).rejects.toThrow(/aborted/);
    expect(getQueryResults).not.toHaveBeenCalled();
  });
});
