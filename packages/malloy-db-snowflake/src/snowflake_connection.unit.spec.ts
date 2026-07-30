/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SnowflakeConnection} from './snowflake_connection';

// TIMEOUT_MS in snowflake_connection.ts (not exported): 10 minutes.
const DEFAULT = 600_000;

// A SnowflakeConnection with a stubbed executor, so runSQL drives the real
// timeout resolution (the configured timeoutMs -> the value handed to
// executor.batch) without a live warehouse. poolMin 0 keeps the underlying
// generic-pool from eagerly opening a connection during construction.
function hermeticConnection(timeoutMs?: number) {
  const conn = new SnowflakeConnection('hermetic', {
    connOptions: {account: 'testaccount'},
    poolOptions: {min: 0, max: 1},
    timeoutMs,
  });
  const batch = jest.fn(async () => [{n: 1}]);
  (conn as unknown as {executor: {batch: jest.Mock}}).executor = {batch};
  return {conn, batch};
}

// runSQL calls executor.batch(sql, options, timeoutMs); the resolved timeout is
// the third argument.
const timeoutArg = (batch: jest.Mock): unknown => batch.mock.calls[0][2];

describe('SnowflakeConnection timeoutMs resolution', () => {
  it('passes a positive timeoutMs through to executor.batch', async () => {
    const {conn, batch} = hermeticConnection(300_000);
    await conn.runSQL('SELECT 1');
    expect(timeoutArg(batch)).toBe(300_000);
  });

  it('resolves a configured 0 to the default, not "wait forever"', async () => {
    // Matches the BigQuery connector: 0 means neither "wait 0ms" nor "wait
    // forever". Previously `?? TIMEOUT_MS` kept the 0, and the executor read a
    // falsy timeout as "no timer" (unbounded).
    const {conn, batch} = hermeticConnection(0);
    await conn.runSQL('SELECT 1');
    expect(timeoutArg(batch)).toBe(DEFAULT);
  });

  it('resolves an unset timeoutMs to the default', async () => {
    const {conn, batch} = hermeticConnection(undefined);
    await conn.runSQL('SELECT 1');
    expect(timeoutArg(batch)).toBe(DEFAULT);
  });

  it('resolves a NaN timeoutMs (blank or non-numeric config) to the default', async () => {
    // A blank or non-numeric connection timeoutMs is parsed to NaN via parseInt
    // in index.ts; that must fall back to the default rather than disabling the
    // timeout.
    const {conn, batch} = hermeticConnection(Number.NaN);
    await conn.runSQL('SELECT 1');
    expect(timeoutArg(batch)).toBe(DEFAULT);
  });

  it('resolves a negative timeoutMs to the default', async () => {
    // A negative value is truthy, so a bare `||` would let it reach the
    // executor's setTimeout(cancel) and abort the statement almost immediately.
    const {conn, batch} = hermeticConnection(-5);
    await conn.runSQL('SELECT 1');
    expect(timeoutArg(batch)).toBe(DEFAULT);
  });

  it('returns the executor rows from runSQL', async () => {
    const {conn} = hermeticConnection(300_000);
    const data = await conn.runSQL('SELECT 1');
    expect(data.rows).toEqual([{n: 1}]);
    expect(data.totalRows).toBe(1);
  });
});
