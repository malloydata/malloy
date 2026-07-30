/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DatabricksConnection} from './databricks_connection';

// A never-settling fetch, used to force the timeout/abort path.
const never = () => new Promise<unknown[]>(() => {});

// Flush enough microtasks that runRawSQL reaches its Promise.race (so the
// timeout timer is registered) before the test advances fake time.
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

// A DatabricksConnection with a stubbed session/operation so runSQL drives the
// real executeRaw timeout+cancel path without a live warehouse. A pre-set
// session short-circuits ensureConnected, so doConnect never runs.
function hermeticConnection(opts: {
  timeoutMs?: number;
  fetchAll: () => Promise<unknown[]>;
}) {
  const cancel = jest.fn(async () => ({}));
  const close = jest.fn(async () => {});
  const operation = {fetchAll: opts.fetchAll, cancel, close};
  const executeStatement = jest.fn(async () => operation);
  const conn = new DatabricksConnection('hermetic', {
    host: '',
    path: '',
    timeoutMs: opts.timeoutMs,
  });
  (conn as unknown as {session: unknown}).session = {executeStatement};
  return {conn, cancel, close, executeStatement};
}

describe('DatabricksConnection timeout + abort', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('cancels the operation and throws when the query exceeds timeoutMs', async () => {
    const {conn, cancel} = hermeticConnection({
      timeoutMs: 1000,
      fetchAll: never,
    });
    const promise = conn.runRawSQL('SELECT 1');
    promise.catch(() => {});
    await flush();
    expect(cancel).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow(
      /did not complete within the configured timeout of 1000ms/
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['unset', undefined],
  ])(
    'resolves a %s timeoutMs to the default (600000ms)',
    async (_label, timeoutMs) => {
      const {conn, cancel} = hermeticConnection({timeoutMs, fetchAll: never});
      const promise = conn.runRawSQL('SELECT 1');
      promise.catch(() => {});
      await flush();
      jest.advanceTimersByTime(599_999);
      await flush();
      expect(cancel).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await expect(promise).rejects.toThrow(
        /did not complete within the configured timeout of 600000ms/
      );
      expect(cancel).toHaveBeenCalledTimes(1);
    }
  );

  it('does not cancel a query that completes within the timeout', async () => {
    const {conn, cancel} = hermeticConnection({
      timeoutMs: 1000,
      fetchAll: async () => [{n: 1}],
    });
    const data = await conn.runRawSQL('SELECT 1');
    expect(data.rows).toEqual([{n: 1}]);
    expect(data.totalRows).toBe(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels the operation when the abort signal fires', async () => {
    const ac = new AbortController();
    const {conn, cancel} = hermeticConnection({
      timeoutMs: 600_000,
      fetchAll: never,
    });
    const promise = conn.runSQL('SELECT 1', {abortSignal: ac.signal});
    promise.catch(() => {});
    await flush();
    ac.abort();
    await expect(promise).rejects.toThrow(/aborted/);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('throws without executing when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const {conn, executeStatement, cancel} = hermeticConnection({
      timeoutMs: 600_000,
      fetchAll: never,
    });
    await expect(
      conn.runSQL('SELECT 1', {abortSignal: ac.signal})
    ).rejects.toThrow(/aborted/);
    expect(executeStatement).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});
