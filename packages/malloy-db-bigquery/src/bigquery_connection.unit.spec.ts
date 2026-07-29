/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BigQueryConnection, resolveTimeoutMs} from './bigquery_connection';

describe('resolveTimeoutMs', () => {
  const DEFAULT = 600_000;

  it('falls back when unset, empty, or whitespace-only', () => {
    expect(resolveTimeoutMs(undefined, DEFAULT)).toBe(DEFAULT);
    expect(resolveTimeoutMs('', DEFAULT)).toBe(DEFAULT);
    // Number('   ') is 0, not NaN, so a blank-but-not-empty value must be
    // treated as unset rather than as a fail-fast 0.
    expect(resolveTimeoutMs('   ', DEFAULT)).toBe(DEFAULT);
  });

  it('preserves an explicit "0" (call sites treat 0 as no-timeout)', () => {
    expect(resolveTimeoutMs('0', DEFAULT)).toBe(0);
  });

  it('parses a numeric string, trimming surrounding whitespace', () => {
    expect(resolveTimeoutMs('5000', DEFAULT)).toBe(5000);
    expect(resolveTimeoutMs('  5000  ', DEFAULT)).toBe(5000);
  });

  it('falls back on a non-numeric value', () => {
    expect(resolveTimeoutMs('abc', DEFAULT)).toBe(DEFAULT);
  });
});

// The callback overload yields (err, rows, nextQuery, apiResponse).
type Cb = (
  err: unknown,
  rows: unknown,
  nextQuery: unknown,
  apiResponse: unknown
) => void;
type Step = (cb: Cb) => void;

const stillRunning: Step = cb =>
  cb(new Error('The query did not complete before 120000ms'), null, null, {
    jobComplete: false,
  });
const complete =
  (rows: unknown[] = [{n: 1}]): Step =>
  cb =>
    cb(null, rows, null, {jobComplete: true, totalRows: String(rows.length)});

// A BigQueryConnection with its BigQuery SDK and timeout config stubbed, so
// runSQL drives the real createBigQueryJob -> getQueryResultsUntilComplete seam
// (deadline wiring, and that a jobComplete:false response never surfaces as
// data) without a live warehouse.
function hermeticConnection(steps: Step[], timeoutMs?: string) {
  const conn = new BigQueryConnection('hermetic');
  let i = 0;
  const getQueryResults = jest.fn((_options: unknown, cb: Cb) => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    step(cb);
  });
  const job = {getQueryResults, cancel: jest.fn()};
  const createQueryJob = jest.fn(async (_options: unknown) => [job]);
  (conn as unknown as {bigQuery: unknown}).bigQuery = {createQueryJob};
  (conn as unknown as {config: {timeoutMs?: string}}).config = {timeoutMs};
  return {conn, getQueryResults, createQueryJob};
}

describe('BigQueryConnection.runSQL (hermetic, stubbed job)', () => {
  it('treats config.timeoutMs "0" as no timeout: polls through, omits jobTimeoutMs', async () => {
    // Matches Snowflake: 0 disables the client-side limit. The job is still
    // running on the first poll, so a fail-fast reading would throw here; instead
    // it must keep polling to completion, and must not send jobTimeoutMs: 0.
    const {conn, getQueryResults, createQueryJob} = hermeticConnection(
      [stillRunning, complete([{n: 5}])],
      '0'
    );
    const data = await conn.runSQL('SELECT 1');
    expect(data.rows).toEqual([{n: 5}]);
    expect(getQueryResults).toHaveBeenCalledTimes(2);
    expect(createQueryJob.mock.calls[0][0]).not.toHaveProperty('jobTimeoutMs');
  });

  it('passes a positive timeoutMs through to the job as jobTimeoutMs', async () => {
    const {conn, createQueryJob} = hermeticConnection(
      [complete([{n: 7}])],
      '300000'
    );
    await conn.runSQL('SELECT 1');
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({
      jobTimeoutMs: 300000,
    });
  });

  it('treats a whitespace-only timeoutMs as unset (default), not 0', async () => {
    // Regression guard: if "   " resolved to 0 it would be read as no-timeout and
    // omit jobTimeoutMs; it must fall back to the default (TIMEOUT_MS, 600000ms).
    const {conn, createQueryJob} = hermeticConnection(
      [complete([{n: 1}])],
      '   '
    );
    await conn.runSQL('SELECT 1');
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({
      jobTimeoutMs: 600000,
    });
  });

  it('polls a still-running response rather than returning it as empty data', async () => {
    const {conn, getQueryResults} = hermeticConnection([
      stillRunning,
      complete([{n: 1}, {n: 2}]),
    ]);
    const data = await conn.runSQL('SELECT 1');
    expect(data.rows).toEqual([{n: 1}, {n: 2}]);
    expect(data.totalRows).toBe(2);
    expect(getQueryResults).toHaveBeenCalledTimes(2);
  });
});
