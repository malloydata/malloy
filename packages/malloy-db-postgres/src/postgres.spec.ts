/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  PooledPostgresConnection,
  PostgresConnection,
} from './postgres_connection';
import crypto from 'crypto';
import net from 'net';
import {Client} from 'pg';
import type {SQLSourceDef} from '@malloydata/malloy';
import * as malloy from '@malloydata/malloy';
import {wrapTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

/*
 * !IMPORTANT
 *
 * The connection is reused for each test, so if you do not name your tables
 * and keys uniquely for each test you will see cross test interactions.
 */

describe('postgres schema caching', () => {
  let connection: PooledPostgresConnection;
  let getTableSchema: jest.SpyInstance;
  let getSQLBlockSchema: jest.SpyInstance;

  const SQL_BLOCK_1: SQLSourceDef = {
    type: 'sql_select',
    name: 'block1',
    dialect: 'postgres',
    connection: 'mock_postgres',
    fields: [],
    selectStr: "SELECT 'block1' AS sql_block1",
  };

  const SQL_BLOCK_2: SQLSourceDef = {
    type: 'sql_select',
    name: 'block2',
    dialect: 'postgres',
    connection: 'mock_postgres',
    fields: [],
    selectStr: "SELECT 'block2' AS sql_block2",
  };

  beforeAll(async () => {
    connection = new PooledPostgresConnection('mock_postgres');
    await connection.runSQL('SELECT 1');
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    getTableSchema = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(PooledPostgresConnection.prototype as any, 'fetchTableSchema')
      .mockResolvedValue({
        type: 'table',
        dialect: 'postgres',
        name: 'name',
        tablePath: 'test',
        connection: 'mock_postgres',
      });

    getSQLBlockSchema = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(PooledPostgresConnection.prototype as any, 'fetchSelectSchema')
      .mockResolvedValue({
        type: 'sql_select',
        dialect: 'postgres',
        name: 'name',
        selectStr: SQL_BLOCK_1.selectStr,
        connection: 'mock_postgres',
        fields: [],
      });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('caches table schema', async () => {
    await connection.fetchSchemaForTables({'test1': 'table1'}, {});
    expect(getTableSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForTables({'test1': 'table1'}, {});
    expect(getTableSchema).toBeCalledTimes(1);
  });

  it('refreshes table schema', async () => {
    await connection.fetchSchemaForTables({'test2': 'table2'}, {});
    expect(getTableSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForTables(
      {'test2': 'table2'},
      {refreshTimestamp: Date.now() + 10}
    );
    expect(getTableSchema).toBeCalledTimes(2);
  });

  it('caches sql schema', async () => {
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
  });

  it('refreshes sql schema', async () => {
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
      refreshTimestamp: Date.now() + 10,
    });
    expect(getSQLBlockSchema).toBeCalledTimes(2);
  });
});

describe('postgres schema reading', () => {
  it('distinguishes time stamp with and without offset', async () => {
    const connection = new PooledPostgresConnection('postgres');
    const schema = await connection.fetchSchemaForSQLStruct(
      {
        connection: 'postgres',
        selectStr:
          'SELECT current_timestamp AS offset_ts, localtimestamp as ts',
      },
      {}
    );
    if (schema.error) {
      throw new Error(`Error fetching schema: ${schema.error}`);
    }
    if (schema.structDef) {
      expect(schema.structDef.fields[0]).toEqual({
        name: 'offset_ts',
        type: 'timestamptz',
      });
      expect(schema.structDef.fields[1]).toEqual({
        name: 'ts',
        type: 'timestamp',
      });
    }
    await connection.close();
  });

  it('parameterizes information_schema lookups for quoted identifiers containing single quotes', async () => {
    const connection = new PooledPostgresConnection('postgres');
    // Postgres quoted identifiers may legitimately contain `'`. Pre-fix, the
    // table value was interpolated into the WHERE clause, producing malformed
    // SQL like `table_name = 'O'Brien'` (Postgres syntax-errors before any
    // rows come back). The parameterized path binds the value, so the lookup
    // simply returns no rows and surfaces as "Unable to read schema."
    const tablePath = 'public."O\'Brien"';
    const result = await connection.fetchTableSchema(tablePath, tablePath);
    expect(typeof result).toBe('string');
    expect(result as string).toMatch(/Unable to read schema/);
    await connection.close();
  });

  it('maps integer types correctly', async () => {
    const connection = new PooledPostgresConnection('postgres');
    const schema = await connection.fetchSchemaForSQLStruct(
      {
        connection: 'postgres',
        selectStr:
          'SELECT 1::smallint AS small_int, 2::integer AS int_val, 3::bigint AS big_int',
      },
      {}
    );
    if (schema.error) {
      throw new Error(`Error fetching schema: ${schema.error}`);
    }
    if (schema.structDef) {
      expect(schema.structDef.fields[0]).toEqual({
        name: 'small_int',
        type: 'number',
        numberType: 'integer',
      });
      expect(schema.structDef.fields[1]).toEqual({
        name: 'int_val',
        type: 'number',
        numberType: 'integer',
      });
      expect(schema.structDef.fields[2]).toEqual({
        name: 'big_int',
        type: 'number',
        numberType: 'bigint',
      });
    }
    await connection.close();
  });
});

/**
 * Tests for reading numeric values through Malloy queries
 */
describe('numeric value reading', () => {
  const connection = new PooledPostgresConnection('postgres');
  const runtime = new malloy.SingleConnectionRuntime({
    urlReader: {readURL: async () => ''},
    connection,
  });
  const testModel = wrapTestModel(runtime, '');

  afterAll(async () => {
    await connection.close();
  });

  describe('integer types', () => {
    it.each(['SMALLINT', 'INTEGER', 'BIGINT'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: postgres.sql("SELECT 10::${sqlType} as d")`
        ).toMatchResult(testModel, {d: 10});
      }
    );
  });

  describe('float types', () => {
    it.each(['REAL', 'DOUBLE PRECISION', 'NUMERIC', 'DECIMAL'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: postgres.sql("SELECT 10.5::${sqlType} as f")`
        ).toMatchResult(testModel, {f: 10.5});
      }
    );
  });
});

describe('connection cleanup on query failure', () => {
  // Each probed connection is tagged with its own `application_name`, so the
  // session counts below are not fooled by unrelated sessions on a shared test
  // database. The connection string is built from the same PG* environment the
  // rest of this file connects with.
  const newAppName = (prefix: string) =>
    `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
  const taggedConnectionString = (appName: string, hostPort?: string) => {
    const e = process.env;
    const auth = `${encodeURIComponent(e['PGUSER'] ?? 'postgres')}:${encodeURIComponent(e['PGPASSWORD'] ?? '')}`;
    const address =
      hostPort ?? `${e['PGHOST'] ?? 'localhost'}:${e['PGPORT'] ?? '5432'}`;
    return `postgresql://${auth}@${address}/${e['PGDATABASE'] ?? 'postgres'}?application_name=${appName}`;
  };

  // runSQL de-JSONs each row as `row.row`, so these queries wrap their result
  // in row_to_json to come back as plain objects.
  const adminSQL = async (sql: string): Promise<number> => {
    const admin = new PooledPostgresConnection('leak_test_admin');
    try {
      const {rows} = await admin.runSQL(
        `SELECT row_to_json(t) AS row FROM (${sql}) t`
      );
      const n = rows[0]?.['n'];
      if (typeof n !== 'number') {
        throw new Error(
          `Expected a numeric n, got ${JSON.stringify(rows[0])} from: ${sql}`
        );
      }
      return n;
    } finally {
      await admin.close();
    }
  };
  const countSessionsByAppName = (appName: string) =>
    adminSQL(
      `SELECT count(*)::integer AS n FROM pg_stat_activity WHERE application_name = '${appName}'`
    );
  // The server removes a closed session from pg_stat_activity asynchronously,
  // so poll until it is gone rather than counting once.
  const expectNoSessions = async (appName: string) => {
    const deadline = Date.now() + 5000;
    let count = await countSessionsByAppName(appName);
    while (count > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
      count = await countSessionsByAppName(appName);
    }
    expect(count).toBe(0);
  };
  const terminateSessionsByAppName = (appName: string) =>
    adminSQL(
      `SELECT count(pg_terminate_backend(pid))::integer AS n FROM pg_stat_activity WHERE application_name = '${appName}'`
    );
  // Reads a value until it satisfies `done` or ten seconds pass, and returns the
  // last value read, so the caller's assertion reports what it saw.
  const pollFor = async <T>(
    read: () => T | Promise<T>,
    done: (value: T) => boolean
  ): Promise<T> => {
    const deadline = Date.now() + 10000;
    let value = await read();
    while (!done(value) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
      value = await read();
    }
    return value;
  };

  const manyRows =
    'SELECT row_to_json(t) AS row FROM (SELECT generate_series(1, 100000) AS n) t';

  it('closes the session when a query fails after connecting (unpooled)', async () => {
    const appName = newAppName('leak_test_unpooled');
    const connection = new PostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    });
    try {
      // The syntax error proves connect() and connectionSetup() succeeded and
      // the query itself failed - the shape of a bad `.sql()` source or a
      // role-permission error, not a connect-time failure.
      await expect(
        connection.runSQL('SELECT this is not valid sql')
      ).rejects.toThrow(/syntax error/);
      await expectNoSessions(appName);
    } finally {
      await connection.close();
    }
  });

  it('closes the session when fetchSelectSchema fails after connecting', async () => {
    const appName = newAppName('leak_test_schema');
    const connection = new PostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    });
    try {
      // fetchSelectSchema has no try/catch of its own around the query, so a
      // SQL error rejects rather than returning an error string.
      await expect(
        connection.fetchSelectSchema({
          connection: 'postgres',
          selectStr: 'not valid sql at all',
        })
      ).rejects.toThrow(/syntax error/);
      await expectNoSessions(appName);
    } finally {
      await connection.close();
    }
  });

  it('closes the session when a stream fails after connecting (unpooled)', async () => {
    const appName = newAppName('leak_test_stream_err');
    const connection = new PostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    });
    try {
      const drain = async () => {
        const rows: unknown[] = [];
        for await (const row of connection.runSQLStream(
          'SELECT this is not valid sql'
        )) {
          rows.push(row);
        }
        return rows;
      };
      await expect(drain()).rejects.toThrow(/syntax error/);
      await expectNoSessions(appName);
    } finally {
      await connection.close();
    }
  });

  it('closes the session when the caller stops reading a stream early (unpooled)', async () => {
    const appName = newAppName('leak_test_stream_stop');
    const connection = new PostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    });
    try {
      let read = 0;
      for await (const _row of connection.runSQLStream(manyRows)) {
        read += 1;
        break;
      }
      expect(read).toBe(1);
      await expectNoSessions(appName);
    } finally {
      await connection.close();
    }
  });

  it('returns promptly from an early stop after the server has dropped the stream (unpooled)', async () => {
    const appName = newAppName('leak_test_stream_dropped');
    const connection = new PostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    });
    try {
      const rows = connection.runSQLStream(manyRows)[Symbol.asyncIterator]();
      expect((await rows.next()).done).toBe(false);
      // The session goes away while the caller is between reads, so the
      // socket is already closed when the caller's early stop closes it.
      expect(await terminateSessionsByAppName(appName)).toBe(1);
      await expectNoSessions(appName);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        rows.return!(undefined).then(
          () => 'returned',
          () => 'returned'
        ),
        new Promise(resolve => {
          timer = setTimeout(() => resolve('hung'), 5000);
        }),
      ]);
      clearTimeout(timer);
      expect(outcome).toBe('returned');
    } finally {
      await connection.close();
    }
  });

  // At 10 ms a row, each 100-row batch the stream fetches takes about a second,
  // which leaves time to drop the session while a fetch is in flight.
  const slowRows =
    'SELECT row_to_json(t) AS row FROM (SELECT n, pg_sleep(0.01) AS s FROM generate_series(1, 1000) AS n) t';

  // An exclusive advisory lock held by a session of its own. The random key
  // keeps concurrent runs from waiting on each other's locks.
  const advisoryLock = () => {
    const holder = new Client({
      connectionString: taggedConnectionString(newAppName('leak_test_locker')),
    });
    const key = crypto.randomInt(1, 2 ** 31);
    return {
      key,
      acquire: async () => {
        await holder.connect();
        await holder.query('SELECT pg_advisory_lock($1)', [key]);
      },
      release: () => holder.end(),
    };
  };
  // Rows past the first 100-row batch wait on the lock. Reading a stream's
  // first row sends the fetch for its second batch, so a stream stopped after
  // one row leaves a fetch on the server that cannot finish, and a session
  // that cannot end, until the lock is released.
  const blockedAfterFirstBatch = (lockKey: number) =>
    `SELECT row_to_json(t) AS row FROM (SELECT n, CASE WHEN n > 100 THEN pg_advisory_xact_lock_shared(${lockKey})::text END AS w FROM generate_series(1, 1000) AS n) t`;

  // Reads until the stream ends, rejects, or goes five seconds without a row.
  const readToOutcome = async (
    rows: AsyncIterator<unknown>
  ): Promise<'ended' | 'stalled' | Error> => {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const step = await Promise.race([
        rows.next().then(
          r => (r.done ? ('ended' as const) : ('row' as const)),
          (e: Error) => e
        ),
        new Promise<'stalled'>(resolve => {
          timer = setTimeout(() => resolve('stalled'), 5000);
        }),
      ]);
      clearTimeout(timer);
      if (step !== 'row') {
        return step;
      }
    }
  };

  const newConnection = (pooled: boolean, appName: string) => {
    const config = {
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    };
    return pooled
      ? new PooledPostgresConnection(config)
      : new PostgresConnection(config);
  };

  for (const pooled of [false, true]) {
    const kind = pooled ? 'pooled' : 'unpooled';

    it(`fails the next read of a stream whose session was dropped between reads (${kind})`, async () => {
      const appName = newAppName(`leak_test_dropped_paused_${kind}`);
      const connection = newConnection(pooled, appName);
      let outcome: 'ended' | 'stalled' | Error = 'stalled';
      try {
        const rows = connection.runSQLStream(manyRows)[Symbol.asyncIterator]();
        expect((await rows.next()).done).toBe(false);
        expect(await terminateSessionsByAppName(appName)).toBe(1);
        await expectNoSessions(appName);
        outcome = await readToOutcome(rows);
        if (!(outcome instanceof Error)) {
          throw new Error(
            `Expected the read to fail, but the stream ${outcome}`
          );
        }
        expect(outcome.message).toMatch(/terminat/i);
      } finally {
        // A stalled stream never returns its pooled client, and pool.end()
        // waits for it, so the close would hang instead of the assertion
        // above reporting the stall.
        if (outcome !== 'stalled') {
          await connection.close();
        }
      }
    });

    it(`fails a stream read that is waiting when its session is dropped (${kind})`, async () => {
      const appName = newAppName(`leak_test_dropped_reading_${kind}`);
      const connection = newConnection(pooled, appName);
      let outcome: 'ended' | 'stalled' | Error = 'stalled';
      try {
        const rows = connection.runSQLStream(slowRows)[Symbol.asyncIterator]();
        expect((await rows.next()).done).toBe(false);
        // The rest of the first batch is already buffered, so this read drains
        // it without waiting on the server and is waiting on the second batch
        // before the terminate below can reach the server.
        const reading = readToOutcome(rows);
        expect(await terminateSessionsByAppName(appName)).toBe(1);
        outcome = await reading;
        if (!(outcome instanceof Error)) {
          throw new Error(
            `Expected the read to fail, but the stream ${outcome}`
          );
        }
        expect(outcome.message).toMatch(/terminat/i);
        await expectNoSessions(appName);
      } finally {
        if (outcome !== 'stalled') {
          await connection.close();
        }
      }
    });
  }

  it('returns every client to the pool after a failed and an abandoned stream (pooled)', async () => {
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(
        newAppName('leak_test_pooled_stream')
      ),
    });
    try {
      const drain = async () => {
        const rows: unknown[] = [];
        for await (const row of connection.runSQLStream(
          'SELECT this is not valid sql'
        )) {
          rows.push(row);
        }
        return rows;
      };
      await expect(drain()).rejects.toThrow(/syntax error/);
      for await (const _row of connection.runSQLStream(manyRows)) {
        break;
      }
      const pool = await connection.getPool();
      // Checked-out clients: anything a stream failed to release.
      expect(pool.totalCount - pool.idleCount).toBe(0);
    } finally {
      // pool.end() waits for every checked-out client, so a leaked one would
      // turn the failed assertion above into a hang. Skip the close in that
      // case and let the assertion be what reports it.
      const pool = await connection.getPool();
      if (pool.totalCount === pool.idleCount) {
        await connection.close();
      }
    }
  });

  // Row 150 divides by zero. It is in the second 100-row batch, which the
  // stream is already fetching when the caller stops after 5 rows.
  const failsInSecondBatch =
    'SELECT row_to_json(t) AS row FROM (SELECT n, 10 / (150 - n) AS x FROM generate_series(1, 1000) AS n) t';

  for (const useRowLimit of [false, true]) {
    const stop = useRowLimit ? 'rowLimit' : 'break';
    it(`does not hand the next query a client still finishing a stopped stream (pooled, ${stop})`, async () => {
      const connection = new PooledPostgresConnection({
        name: 'postgres',
        connectionString: taggedConnectionString(
          newAppName('leak_test_stopped_mid_batch')
        ),
      });
      try {
        let read = 0;
        for await (const _row of connection.runSQLStream(
          failsInSecondBatch,
          useRowLimit ? {rowLimit: 5} : {}
        )) {
          read += 1;
          if (!useRowLimit && read === 5) {
            break;
          }
        }
        expect(read).toBe(5);
        for (const v of [42, 43, 44]) {
          const {rows} = await connection.runSQL(
            `SELECT row_to_json(t) AS row FROM (SELECT ${v} AS v) t`
          );
          expect(rows).toEqual([{v}]);
        }
      } finally {
        const pool = await connection.getPool();
        if (pool.totalCount === pool.idleCount) {
          await connection.close();
        }
      }
    });
  }

  it('ends a stream at rowLimit without reading rows past it (pooled)', async () => {
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(
        newAppName('leak_test_limit_at_batch')
      ),
    });
    try {
      // rowLimit equals the 100-row batch size, so the next row is in the batch
      // that fails at row 150. Stopping at the limit must not wait on it.
      let read = 0;
      for await (const _row of connection.runSQLStream(failsInSecondBatch, {
        rowLimit: 100,
      })) {
        read += 1;
      }
      expect(read).toBe(100);
    } finally {
      await connection.close();
    }
  });

  it('reuses the client of a stream whose rowLimit is its whole result (pooled)', async () => {
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(
        newAppName('leak_test_limit_is_result')
      ),
    });
    try {
      const pool = await connection.getPool();
      let connects = 0;
      pool.on('connect', () => {
        connects += 1;
      });
      for (let i = 0; i < 3; i++) {
        let read = 0;
        for await (const _row of connection.runSQLStream(
          'SELECT row_to_json(t) AS row FROM (SELECT generate_series(1, 10) AS n) t',
          {rowLimit: 10}
        )) {
          read += 1;
        }
        expect(read).toBe(10);
      }
      expect(connects).toBe(1);
    } finally {
      await connection.close();
    }
  });

  it('survives an idle client whose session is dropped, and opens a fresh one (pooled)', async () => {
    const appName = newAppName('leak_test_idle_dropped');
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      connectionString: taggedConnectionString(appName),
    });
    const one = 'SELECT row_to_json(t) AS row FROM (SELECT 1 AS v) t';
    try {
      const pool = await connection.getPool();
      expect((await connection.runSQL(one)).rows).toEqual([{v: 1}]);
      const removed = new Promise<void>(resolve =>
        pool.once('remove', () => resolve())
      );
      expect(await terminateSessionsByAppName(appName)).toBe(1);
      await removed;
      expect((await connection.runSQL(one)).rows).toEqual([{v: 1}]);
    } finally {
      await connection.close();
    }
  });

  describe('abortSignal', () => {
    // The first row waits on a 60 second sleep, so a query that stops within
    // a few seconds of its abort did not wait for the server to finish.
    const sleepsBeforeFirstRow =
      'WITH s AS MATERIALIZED (SELECT pg_sleep(60)) SELECT row_to_json(t) AS row FROM (SELECT n FROM s, generate_series(1, 10) AS n) t';
    const tenRows =
      'SELECT row_to_json(t) AS row FROM (SELECT generate_series(1, 10) AS n) t';
    const abortDeadlineMs = 5000;

    const countSleepingSessions = (appName: string) =>
      adminSQL(
        `SELECT count(*)::integer AS n FROM pg_stat_activity WHERE application_name = '${appName}' AND wait_event = 'PgSleep'`
      );
    const countActiveSessions = (appName: string) =>
      adminSQL(
        `SELECT count(*)::integer AS n FROM pg_stat_activity WHERE application_name = '${appName}' AND state = 'active'`
      );

    // Settles as soon as the operation does, so a rejection is handled from
    // the moment the operation starts rather than when a test gets to it.
    const settled = (op: Promise<unknown>): Promise<'returned' | 'threw'> =>
      op.then(
        (): 'returned' => 'returned',
        (): 'threw' => 'threw'
      );
    const settledWithin = async (
      op: Promise<'returned' | 'threw'>,
      ms: number
    ): Promise<'returned' | 'threw' | 'still running'> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        op,
        new Promise<'still running'>(resolve => {
          timer = setTimeout(() => resolve('still running'), ms);
        }),
      ]);
      clearTimeout(timer);
      return outcome;
    };

    // A local server stands in for Postgres and records every byte the cancel
    // connection sends. It answers an SSLRequest with 'N' (no TLS), so with
    // TLS settings nothing past the SSLRequest may arrive: the CancelRequest
    // must never be sent in plain text.
    const SSL_REQUEST_CODE = 80877103;
    const CANCEL_REQUEST_CODE = 80877102;
    class CancellingConnection extends PostgresConnection {
      public cancelWhenAborted(target: unknown, abortSignal: AbortSignal) {
        return this.cancelOnAbort(target as Client, abortSignal);
      }
    }
    for (const tls of [true, false]) {
      it(`sends its cancel request ${tls ? 'only inside TLS when the connection uses TLS' : 'directly when the connection does not use TLS'}`, async () => {
        let bytes: Buffer[] = [];
        let closed = () => {};
        const socketClosed = new Promise<void>(resolve => {
          closed = resolve;
        });
        const server = net.createServer(socket => {
          socket.on('error', () => {});
          // Postgres closes after a CancelRequest; 'N' refuses TLS.
          socket.once('data', () => (tls ? socket.end('N') : socket.end()));
          socket.on('data', data => bytes.push(data));
          socket.on('close', () => closed());
        });
        await new Promise<void>(resolve =>
          server.listen(0, '127.0.0.1', resolve)
        );
        try {
          const {port} = server.address() as net.AddressInfo;
          const connection = new CancellingConnection({
            name: 'postgres',
            host: '127.0.0.1',
            port,
            ssl: tls ? {rejectUnauthorized: false} : false,
          });
          const controller = new AbortController();
          const target = {processID: 1234, secretKey: 5678};
          connection.cancelWhenAborted(target, controller.signal);
          controller.abort();
          expect(await settledWithin(settled(socketClosed), 5000)).toBe(
            'returned'
          );
          const sent = Buffer.concat(bytes);
          bytes = [];
          if (tls) {
            expect(sent.length).toBe(8);
            expect(sent.readInt32BE(4)).toBe(SSL_REQUEST_CODE);
          } else {
            expect(sent.length).toBe(16);
            expect(sent.readInt32BE(4)).toBe(CANCEL_REQUEST_CODE);
            expect(sent.readInt32BE(8)).toBe(target.processID);
            expect(sent.readInt32BE(12)).toBe(target.secretKey);
          }
        } finally {
          await new Promise(resolve => server.close(resolve));
        }
      });
    }

    // Forwards connections to the test database, and drops them all the way a
    // network failure does: the client's socket closes with no error message
    // from the server first.
    const droppableProxy = async () => {
      const sockets = new Set<net.Socket>();
      const server = net.createServer(downstream => {
        const upstream = net.connect(
          Number(process.env['PGPORT'] ?? '5432'),
          process.env['PGHOST'] ?? 'localhost'
        );
        for (const socket of [downstream, upstream]) {
          sockets.add(socket);
          socket.on('error', () => {});
          socket.on('close', () => sockets.delete(socket));
        }
        downstream.pipe(upstream).pipe(downstream);
      });
      await new Promise<void>(resolve =>
        server.listen(0, '127.0.0.1', resolve)
      );
      return {
        port: (server.address() as net.AddressInfo).port,
        dropAll: () => sockets.forEach(socket => socket.destroy()),
        close: () => new Promise(resolve => server.close(resolve)),
      };
    };

    for (const pooled of [false, true]) {
      const kind = pooled ? 'pooled' : 'unpooled';

      it(`stops a stream aborted before its first row, and its query on the server (${kind})`, async () => {
        const appName = newAppName(`abort_test_stream_${kind}`);
        const connection = newConnection(pooled, appName);
        const controller = new AbortController();
        const rows: unknown[] = [];
        const reading = settled(
          (async () => {
            for await (const row of connection.runSQLStream(
              sleepsBeforeFirstRow,
              {abortSignal: controller.signal}
            )) {
              rows.push(row);
            }
          })()
        );
        try {
          // Abort once the server is running the query, not before it starts.
          expect(
            await pollFor(
              () => countSleepingSessions(appName),
              n => n === 1
            )
          ).toBe(1);
          controller.abort();
          const outcome = await settledWithin(reading, abortDeadlineMs);
          if (outcome === 'still running') {
            throw new Error(
              `Expected the stream to stop within ${abortDeadlineMs} ms of its abort, but it was still waiting on the server`
            );
          }
          expect(rows).toEqual([]);
          expect(
            await pollFor(
              () => countActiveSessions(appName),
              n => n === 0
            )
          ).toBe(0);
        } finally {
          // Ends a query the abort left running, so cleanup does not wait out
          // the sleep.
          await terminateSessionsByAppName(appName);
          await reading;
          await connection.close();
        }
      });

      it(`yields no rows from a stream whose abortSignal is already aborted (${kind})`, async () => {
        const connection = newConnection(
          pooled,
          newAppName(`abort_test_pre_${kind}`)
        );
        const controller = new AbortController();
        controller.abort();
        const rows: unknown[] = [];
        try {
          // Ending and throwing are both a stop; what matters is that no row
          // arrives.
          await settled(
            (async () => {
              for await (const row of connection.runSQLStream(tenRows, {
                abortSignal: controller.signal,
              })) {
                rows.push(row);
              }
            })()
          );
          expect(rows).toEqual([]);
        } finally {
          await connection.close();
        }
      });

      it(`stops the query on the server when a stream is aborted between rows (${kind})`, async () => {
        const appName = newAppName(`abort_test_between_rows_${kind}`);
        const connection = newConnection(pooled, appName);
        const lock = advisoryLock();
        const controller = new AbortController();
        let read = 0;
        let reading: Promise<'returned' | 'threw'> | undefined;
        try {
          await lock.acquire();
          // The fetch for the second batch is on the server, waiting on the
          // lock, by the time the first row arrives, so only a cancel can
          // stop it before the lock is released.
          reading = settled(
            (async () => {
              for await (const _row of connection.runSQLStream(
                blockedAfterFirstBatch(lock.key),
                {abortSignal: controller.signal}
              )) {
                read += 1;
                controller.abort();
              }
            })()
          );
          const outcome = await settledWithin(reading, abortDeadlineMs);
          if (outcome === 'still running') {
            throw new Error(
              `Expected the stream to stop within ${abortDeadlineMs} ms of its abort, but it was still waiting on the server`
            );
          }
          expect(read).toBe(1);
          expect(
            await pollFor(
              () => countActiveSessions(appName),
              n => n === 0
            )
          ).toBe(0);
        } finally {
          await lock.release();
          await reading;
          await connection.close();
        }
      });

      it(`stops runSQL when its abortSignal fires, and its query on the server (${kind})`, async () => {
        const appName = newAppName(`abort_test_runsql_${kind}`);
        const connection = newConnection(pooled, appName);
        const controller = new AbortController();
        const running = settled(
          connection.runSQL(sleepsBeforeFirstRow, {
            abortSignal: controller.signal,
          })
        );
        try {
          expect(
            await pollFor(
              () => countSleepingSessions(appName),
              n => n === 1
            )
          ).toBe(1);
          controller.abort();
          const outcome = await settledWithin(running, abortDeadlineMs);
          if (outcome !== 'threw') {
            throw new Error(
              `Expected runSQL to reject within ${abortDeadlineMs} ms of its abort, but it ${outcome === 'returned' ? 'returned a result' : 'was still waiting on the server'}`
            );
          }
          expect(
            await pollFor(
              () => countActiveSessions(appName),
              n => n === 0
            )
          ).toBe(0);
        } finally {
          // Ends a query the abort left running, so cleanup does not wait out
          // the sleep.
          await terminateSessionsByAppName(appName);
          await running;
          await connection.close();
        }
      });

      it(`rejects runSQL whose abortSignal is already aborted (${kind})`, async () => {
        const connection = newConnection(
          pooled,
          newAppName(`abort_test_pre_runsql_${kind}`)
        );
        const controller = new AbortController();
        controller.abort();
        try {
          await expect(
            connection.runSQL(tenRows, {abortSignal: controller.signal})
          ).rejects.toThrow();
        } finally {
          await connection.close();
        }
      });

      // pg emits 'error' on a client whose socket drops, even while a query
      // runs on it, and pg-pool takes its own listener off a checked-out
      // client. With no listener, that event is an uncaught exception.
      for (const withSignal of [false, true]) {
        it(`fails runSQL whose connection drops while it runs (${kind}, ${withSignal ? 'with' : 'without'} an abortSignal)`, async () => {
          const appName = newAppName(`abort_test_dropped_runsql_${kind}`);
          const proxy = await droppableProxy();
          const config = {
            name: 'postgres',
            connectionString: taggedConnectionString(
              appName,
              `127.0.0.1:${proxy.port}`
            ),
          };
          const connection = pooled
            ? new PooledPostgresConnection(config)
            : new PostgresConnection(config);
          const outcome = connection
            .runSQL(sleepsBeforeFirstRow, {
              abortSignal: withSignal
                ? new AbortController().signal
                : undefined,
            })
            .then(
              () => new Error('Expected runSQL to fail, but it returned rows'),
              (e: Error) => e
            );
          try {
            expect(
              await pollFor(
                () => countSleepingSessions(appName),
                n => n === 1
              )
            ).toBe(1);
            proxy.dropAll();
            expect((await outcome).message).toMatch(/terminated unexpectedly/);
          } finally {
            // The server does not notice the dropped socket during the sleep.
            await terminateSessionsByAppName(appName);
            await outcome;
            await connection.close();
            await proxy.close();
          }
        });
      }
    }
  });
});

describe('setupSQL', () => {
  const uid = crypto.randomBytes(4).toString('hex');

  it('runs a single setup statement', async () => {
    const table = `setup_single_${uid}`;
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      setupSQL: `CREATE TEMP TABLE IF NOT EXISTS ${table} (v int)`,
    });
    try {
      // Query through the pool directly — the acquire hook runs setupSQL,
      // creating the temp table on the same client before our query executes.
      const pool = await connection.getPool();
      const result = await pool.query(
        `SELECT count(*)::integer AS n FROM ${table}`
      );
      expect(result.rows[0].n).toBe(0);
    } finally {
      await connection.close();
    }
  });

  it('runs multiple semicolon-newline-separated statements', async () => {
    const table = `setup_multi_${uid}`;
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      setupSQL: [
        `CREATE TEMP TABLE IF NOT EXISTS ${table} (v int)`,
        `INSERT INTO ${table} VALUES (42)`,
      ].join(';\n'),
    });
    try {
      const pool = await connection.getPool();
      const result = await pool.query(`SELECT v FROM ${table} LIMIT 1`);
      expect(result.rows[0].v).toBe(42);
    } finally {
      await connection.close();
    }
  });

  // A statement must not run without its setup: with `SET ROLE`, it would run
  // as the login user.
  for (const pooled of [false, true]) {
    const kind = pooled ? 'pooled' : 'unpooled';
    it(`fails a query whose setup statement fails, without running it (${kind})`, async () => {
      const config = {
        name: 'postgres',
        setupSQL: `SET ROLE no_such_role_${uid}`,
      };
      const connection = pooled
        ? new PooledPostgresConnection(config)
        : new PostgresConnection(config);
      const whoAmI =
        'SELECT row_to_json(t) AS row FROM (SELECT current_user AS u) t';
      const setupFailed = new RegExp(
        `role "no_such_role_${uid}" does not exist`
      );
      try {
        for (const abortSignal of [undefined, new AbortController().signal]) {
          await expect(
            connection.runSQL(whoAmI, {abortSignal})
          ).rejects.toThrow(setupFailed);
          const rows: unknown[] = [];
          await expect(
            (async () => {
              for await (const row of connection.runSQLStream(whoAmI, {
                abortSignal,
              })) {
                rows.push(row);
              }
            })()
          ).rejects.toThrow(setupFailed);
          expect(rows).toEqual([]);
        }
        if (connection instanceof PooledPostgresConnection) {
          const pool = await connection.getPool();
          // Checked-out clients: anything a failed query did not release.
          expect(pool.totalCount - pool.idleCount).toBe(0);
        }
      } finally {
        await connection.close();
      }
    });
  }

  it('handles multi-line statements', async () => {
    const table = `setup_multiline_${uid}`;
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      setupSQL: `CREATE TEMP TABLE IF NOT EXISTS ${table}\n  (v int)`,
    });
    try {
      const pool = await connection.getPool();
      const result = await pool.query(
        `SELECT count(*)::integer AS n FROM ${table}`
      );
      expect(result.rows[0].n).toBe(0);
    } finally {
      await connection.close();
    }
  });
});
