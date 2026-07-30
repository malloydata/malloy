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
  job: Pick<Job, 'getQueryResults' | 'cancel'>;
  getQueryResults: jest.Mock;
  cancel: jest.Mock;
} {
  let i = 0;
  const getQueryResults = jest.fn((_options: unknown, cb: Cb) => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    step(cb);
  });
  const cancel = jest.fn(async () => [{}]);
  return {
    job: {getQueryResults, cancel} as unknown as Pick<
      Job,
      'getQueryResults' | 'cancel'
    >,
    getQueryResults,
    cancel,
  };
}

// The loop spaces still-running polls by a minimum interval via wait(); tests
// inject a no-op so they don't sleep real time.
const noWait = async () => {};

describe('getQueryResultsUntilComplete', () => {
  it('returns immediately when the job is already complete', async () => {
    const {job, getQueryResults, cancel} = scriptedJob([complete()]);
    const out = await getQueryResultsUntilComplete(job, {}, 600_000, {
      now: () => 0,
    });
    expect(out[0]).toEqual([{n: 1}]);
    expect(getQueryResults).toHaveBeenCalledTimes(1);
    // No cancel on the happy path.
    expect(cancel).not.toHaveBeenCalled();
  });

  it('polls past "still running" responses until the job completes', async () => {
    const {job, getQueryResults} = scriptedJob([
      stillRunning,
      stillRunning,
      complete(),
    ]);
    const out = await getQueryResultsUntilComplete(job, {}, 600_000, {
      now: () => 0,
      wait: noWait,
    });
    expect(out[0]).toEqual([{n: 1}]);
    expect(getQueryResults).toHaveBeenCalledTimes(3);
  });

  it('waits a minimum interval before re-polling when a poll returns early', async () => {
    // now is constant, so the poll "returned" with no elapsed time; the loop
    // waits the full floor before the next poll.
    const wait = jest.fn(async (_ms: number) => {});
    const {job} = scriptedJob([stillRunning, complete()]);
    await getQueryResultsUntilComplete(job, {}, 600_000, {now: () => 0, wait});
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls[0][0]).toBe(1000);
  });

  it('does not wait when a poll already blocked at least the interval', async () => {
    // The poll advances the clock past the floor, so there is no shortfall.
    let t = 0;
    const wait = jest.fn(async (_ms: number) => {});
    const {job} = scriptedJob([
      cb => {
        t += 2000; // poll blocked 2s, longer than the 1s floor
        stillRunning(cb);
      },
      complete(),
    ]);
    await getQueryResultsUntilComplete(job, {}, 600_000, {now: () => t, wait});
    expect(wait).not.toHaveBeenCalled();
  });

  it('stops promptly when the signal aborts around the inter-poll wait', async () => {
    // Abort before the loop reaches the (real) inter-poll wait: the wait must
    // resolve immediately instead of sleeping the floor, and the loop must then
    // exit rather than issue another poll.
    const ac = new AbortController();
    const {job, getQueryResults} = scriptedJob([stillRunning, complete()]);
    const promise = getQueryResultsUntilComplete(job, {}, 600_000, {
      abortSignal: ac.signal,
      now: () => 0,
    });
    ac.abort();
    const start = Date.now();
    await expect(promise).rejects.toThrow(/aborted/);
    expect(Date.now() - start).toBeLessThan(500);
    expect(getQueryResults).toHaveBeenCalledTimes(1);
  });

  it('clamps the per-poll timeout to the remaining deadline', async () => {
    const {job, getQueryResults} = scriptedJob([complete()]);
    // Deadline shorter than one poll interval -> first poll asks for the
    // remaining deadline, not the full GET_QUERY_RESULTS_POLL_MS.
    await getQueryResultsUntilComplete(job, {}, 30_000, {now: () => 0});
    expect(getQueryResults.mock.calls[0][0]).toMatchObject({timeoutMs: 30_000});
  });

  it('gives up with an actionable error once the deadline passes, cancelling the job', async () => {
    let t = 0;
    const now = () => t;
    const {job, getQueryResults, cancel} = scriptedJob([
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
    // On its own deadline the loop cancels the job rather than leaving it running.
    expect(cancel).toHaveBeenCalledTimes(1);
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
      getQueryResultsUntilComplete(job, {}, 600_000, {
        now: () => 0,
        wait: noWait,
      })
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
