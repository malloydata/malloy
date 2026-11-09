/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DBSQLClient} from '@databricks/sql';
import {DatabricksConnection, parseProxyUrl} from './databricks_connection';

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

  it('times out even if closing the operation hangs', async () => {
    // close() over an unresponsive connection can hang; the cleanup must not be
    // awaited on the failure path, or it would swallow the timeout.
    const {conn, cancel, close} = hermeticConnection({
      timeoutMs: 1000,
      fetchAll: never,
    });
    close.mockImplementation(() => new Promise<void>(() => {})); // never resolves
    const promise = conn.runRawSQL('SELECT 1');
    promise.catch(() => {});
    await flush();
    jest.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow(
      /did not complete within the configured timeout of 1000ms/
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });

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

describe('parseProxyUrl', () => {
  it('maps an http URL with an explicit port', () => {
    expect(parseProxyUrl('http://127.0.0.1:3128')).toEqual({
      protocol: 'http',
      host: '127.0.0.1',
      port: 3128,
    });
  });

  it('defaults the port from the scheme', () => {
    expect(parseProxyUrl('http://proxy').port).toBe(80);
    expect(parseProxyUrl('https://proxy').port).toBe(443);
    expect(parseProxyUrl('socks5://proxy').port).toBe(1080);
  });

  it('decodes credentials', () => {
    expect(parseProxyUrl('http://us%40er:p%3Ass@proxy:8080').auth).toEqual({
      username: 'us@er',
      password: 'p:ss',
    });
  });

  it('omits auth when the URL has no credentials', () => {
    expect(parseProxyUrl('http://proxy:8080').auth).toBeUndefined();
  });

  it('rejects a URL with no scheme, naming the setting', () => {
    expect(() => parseProxyUrl('127.0.0.1:3128')).toThrow(/Databricks proxy/);
  });

  it('rejects an unsupported scheme', () => {
    expect(() => parseProxyUrl('ftp://proxy:21')).toThrow(
      /Databricks proxy: unsupported URL/
    );
  });

  it('rejects text that is not a URL', () => {
    expect(() => parseProxyUrl('not a url')).toThrow(
      /Databricks proxy: invalid URL/
    );
  });
});

describe('DatabricksConnection proxy option', () => {
  afterEach(() => jest.restoreAllMocks());

  // Capture what doConnect hands the driver, then stop before any network I/O.
  async function connectOptionsFor(proxy?: string) {
    const connect = jest
      .spyOn(DBSQLClient.prototype, 'connect')
      .mockRejectedValue(new Error('stop'));
    const conn = new DatabricksConnection('proxy', {
      host: 'h',
      path: 'p',
      proxy,
    });
    await expect(
      (conn as unknown as {ensureConnected(): Promise<void>}).ensureConnected()
    ).rejects.toThrow('stop');
    return connect.mock.calls[0][0];
  }

  it('passes the configured proxy to the driver', async () => {
    expect((await connectOptionsFor('http://127.0.0.1:3128')).proxy).toEqual({
      protocol: 'http',
      host: '127.0.0.1',
      port: 3128,
    });
  });

  it('passes no proxy when none is configured', async () => {
    expect((await connectOptionsFor()).proxy).toBeUndefined();
  });

  it('throws at construction for a malformed proxy URL', () => {
    expect(
      () =>
        new DatabricksConnection('bad', {host: 'h', path: 'p', proxy: 'nope'})
    ).toThrow(/Databricks proxy/);
  });
});
