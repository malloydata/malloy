/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as http from 'http';
import * as https from 'https';
import type {AddressInfo} from 'net';
import {DBSQLClient, connections} from '@databricks/sql';
import {DatabricksConnection, parseProxyUrl} from './databricks_connection';
import {createTestRuntime, mkTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

const host = process.env['DATABRICKS_HOST'] ?? '';
const token = process.env['DATABRICKS_TOKEN'] ?? '';
const defaultCatalog = process.env['DATABRICKS_CATALOG'] ?? '';
const path = process.env['DATABRICKS_PATH'] ?? '';

const dbr_connection = new DatabricksConnection('databricks', {
  host,
  path,
  token,
  defaultCatalog,
  proxy: process.env['DATABRICKS_HTTPS_PROXY'],
});

afterAll(async () => {
  await dbr_connection.close();
});

async function schemaFor(selectStr: string) {
  const res = await dbr_connection.fetchSchemaForSQLStruct(
    {selectStr, connection: 'databricks'},
    {}
  );
  if ('error' in res && res.error) {
    throw new Error(res.error);
  }
  return res.structDef!.fields;
}

describe('basic connectivity', () => {
  it('runs SELECT 1', async () => {
    const res = await dbr_connection.runSQL('SELECT 1 as t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('reads schema of a table', async () => {
    const result = await dbr_connection.fetchTableSchema(
      'alltypes',
      'malloytest.alltypes'
    );
    expect(typeof result).not.toBe('string');
    if (typeof result !== 'string') {
      const fieldNames = result.fields.map(f => f.name);
      expect(fieldNames).toContain('t_int64');
      expect(fieldNames).toContain('string');
      expect(fieldNames).toContain('t_date');
      expect(fieldNames).toContain('t_timestamp');
    }
  });

  it('reads schema of a SQL statement (fetchSchemaForSQLStruct)', async () => {
    const fields = await schemaFor('SELECT * FROM malloytest.alltypes');
    const fieldNames = fields.map(f => f.name);
    expect(fieldNames).toContain('t_int64');
    expect(fieldNames).toContain('string');
    expect(fieldNames).toContain('t_date');
    expect(fieldNames).toContain('t_timestamp');
  });
});

describe('schema recognition — atomic types', () => {
  it.each([
    ['INT', 'integer'],
    ['BIGINT', 'bigint'],
    ['DOUBLE', 'float'],
    ['FLOAT', 'float'],
    ['DECIMAL(10,2)', 'float'],
    ['DECIMAL(18,0)', 'integer'],
  ])('maps %s to number/%s', async (sqlType, numberType) => {
    const fields = await schemaFor(`SELECT CAST(1 AS ${sqlType}) as v`);
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'number',
      numberType,
    });
  });

  it.each(['STRING', 'VARCHAR(100)'])('maps %s to string', async sqlType => {
    const fields = await schemaFor(`SELECT CAST('x' AS ${sqlType}) as v`);
    expect(fields[0]).toEqual({name: 'v', type: 'string'});
  });

  it('maps BOOLEAN to boolean', async () => {
    const fields = await schemaFor('SELECT CAST(true AS BOOLEAN) as v');
    expect(fields[0]).toEqual({name: 'v', type: 'boolean'});
  });

  it('maps DATE to date', async () => {
    const fields = await schemaFor('SELECT CAST(CURRENT_DATE() AS DATE) as v');
    expect(fields[0]).toEqual({name: 'v', type: 'date'});
  });

  it('maps TIMESTAMP to timestamp', async () => {
    const fields = await schemaFor(
      'SELECT CAST(CURRENT_TIMESTAMP() AS TIMESTAMP) as v'
    );
    expect(fields[0]).toEqual({name: 'v', type: 'timestamp'});
  });

  it('maps TIMESTAMP_NTZ to sql native', async () => {
    const fields = await schemaFor(
      'SELECT CAST(CURRENT_TIMESTAMP() AS TIMESTAMP_NTZ) as v'
    );
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'sql native',
      rawType: 'timestamp_ntz',
    });
  });
});

describe('schema recognition — complex types', () => {
  it('parses ARRAY<INT>', async () => {
    const fields = await schemaFor('SELECT ARRAY(1, 2, 3) as v');
    expect(fields[0]).toMatchObject({
      name: 'v',
      type: 'array',
      elementTypeDef: {type: 'number', numberType: 'integer'},
    });
  });

  it('parses STRUCT', async () => {
    const fields = await schemaFor(
      "SELECT NAMED_STRUCT('a', 1.0D, 'b', 2, 'c', 'hello') as v"
    );
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'record',
      join: 'one',
      fields: [
        {name: 'a', type: 'number', numberType: 'float'},
        {name: 'b', type: 'number', numberType: 'integer'},
        {name: 'c', type: 'string'},
      ],
    });
  });

  it('parses ARRAY<STRUCT<...>> (repeated record)', async () => {
    const fields = await schemaFor(
      "SELECT ARRAY(NAMED_STRUCT('a', 1.0D, 'b', 2, 'c', 'hello')) as v"
    );
    expect(fields[0]).toEqual({
      name: 'v',
      type: 'array',
      join: 'many',
      elementTypeDef: {type: 'record_element'},
      fields: [
        {name: 'a', type: 'number', numberType: 'float'},
        {name: 'b', type: 'number', numberType: 'integer'},
        {name: 'c', type: 'string'},
      ],
    });
  });
});

describe('data hydration — atomic types', () => {
  const runtime = createTestRuntime(dbr_connection);
  const testModel = mkTestModel(runtime, {});

  it('reads integer', async () => {
    await expect('run: databricks.sql("SELECT 42 as v")').toMatchResult(
      testModel,
      {v: 42}
    );
  });

  it('reads float', async () => {
    await expect('run: databricks.sql("SELECT 3.14 as v")').toMatchResult(
      testModel,
      {v: 3.14}
    );
  });

  it('reads string', async () => {
    await expect('run: databricks.sql("SELECT \'hello\' as v")').toMatchResult(
      testModel,
      {v: 'hello'}
    );
  });

  it('reads boolean', async () => {
    await expect('run: databricks.sql("SELECT true as v")').toMatchResult(
      testModel,
      {v: true}
    );
  });

  it('reads date', async () => {
    await expect(
      'run: databricks.sql("SELECT DATE \'2024-01-15\' as v")'
    ).toMatchResult(testModel, {v: '2024-01-15T00:00:00.000Z'});
  });

  it('reads timestamp', async () => {
    await expect(
      'run: databricks.sql("SELECT TIMESTAMP \'2024-01-15 10:30:00\' as v")'
    ).toMatchResult(testModel, {v: '2024-01-15T10:30:00.000Z'});
  });
});

describe('data hydration — complex types', () => {
  const runtime = createTestRuntime(dbr_connection);
  const testModel = mkTestModel(runtime, {});

  it('reads array of integers', async () => {
    await expect(
      'run: databricks.sql("SELECT ARRAY(1, 2, 3) as v")'
    ).toMatchResult(testModel, {v: [1, 2, 3]});
  });

  it('reads struct', async () => {
    await expect(
      "run: databricks.sql(\"SELECT NAMED_STRUCT('a', 1.0D, 'b', 'hello') as v\")"
    ).toMatchResult(testModel, {v: {a: 1.0, b: 'hello'}});
  });

  it('reads array of structs', async () => {
    await expect(
      "run: databricks.sql(\"SELECT ARRAY(NAMED_STRUCT('x', 1, 'y', 'a'), NAMED_STRUCT('x', 2, 'y', 'b')) as v\")"
    ).toMatchResult(testModel, {
      v: [
        {x: 1, y: 'a'},
        {x: 2, y: 'b'},
      ],
    });
  });
});

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

  it('leaves credentials percent-encoded for the driver', () => {
    expect(parseProxyUrl('http://us%40er:p%23ss@proxy:8080').auth).toEqual({
      username: 'us%40er',
      password: 'p%23ss',
    });
  });

  it('keeps credentials out of error messages', () => {
    for (const bad of [
      'http://user:s3cret@proxy:99999',
      'ftp://user:s3cret@proxy',
      // An unencoded '/' in the password, and a missing scheme
      'http://user:s3/cret@proxy:3128',
      'user:s3cret@proxy:3128',
    ]) {
      expect(() => parseProxyUrl(bad)).toThrow(/Databricks proxy/);
      expect(() => parseProxyUrl(bad)).not.toThrow(/s3cret/);
    }
  });

  it('rejects a scheme which only an inherited property names', () => {
    expect(() => parseProxyUrl('constructor://proxy:3128')).toThrow(
      /Databricks proxy: unsupported URL/
    );
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
    await expect(conn.test()).rejects.toThrow('stop');
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

describe('proxy credentials reach the proxy intact', () => {
  // Hand the parsed options to the driver's own HttpConnection and capture
  // the Proxy-Authorization header a local CONNECT proxy receives.
  async function proxyAuthorizationFor(userinfo: string): Promise<string> {
    let received = '';
    const proxy = http.createServer();
    proxy.on('connect', (req, socket) => {
      received = String(req.headers['proxy-authorization'] ?? '');
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const {port} = proxy.address() as AddressInfo;
    try {
      const conn = new connections.HttpConnection(
        {
          host: 'workspace.invalid',
          port: 443,
          https: true,
          proxy: parseProxyUrl(`http://${userinfo}@127.0.0.1:${port}`),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {getConfig: () => ({socketTimeout: 5000})} as any
      );
      const agent = await conn.getAgent();
      await new Promise<void>(resolve => {
        https
          .get('https://workspace.invalid/', {agent}, res => {
            res.resume();
            resolve();
          })
          .on('error', () => resolve());
      });
    } finally {
      await new Promise(resolve => proxy.close(resolve));
    }
    return received;
  }

  const basic = (user: string, pass: string) =>
    `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

  it.each([
    ['user:p%23ss', 'user', 'p#ss'],
    ['user:a%2Fb', 'user', 'a/b'],
    ['user:pa%3Fss', 'user', 'pa?ss'],
    ['user:50%25off', 'user', '50%off'],
    ['us%40er:p%3Ass', 'us@er', 'p:ss'],
  ])('sends %s as the decoded credentials', async (userinfo, user, pass) => {
    expect(await proxyAuthorizationFor(userinfo)).toBe(basic(user, pass));
  });
});
