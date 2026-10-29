/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  PooledPostgresConnection,
  PostgresConnection,
} from './postgres_connection';
import crypto from 'crypto';
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
  const taggedConnectionString = (appName: string) => {
    const e = process.env;
    const auth = `${encodeURIComponent(e['PGUSER'] ?? 'postgres')}:${encodeURIComponent(e['PGPASSWORD'] ?? '')}`;
    return `postgresql://${auth}@${e['PGHOST'] ?? 'localhost'}:${e['PGPORT'] ?? '5432'}/${e['PGDATABASE'] ?? 'postgres'}?application_name=${appName}`;
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

  for (const pooled of [false, true]) {
    const kind = pooled ? 'pooled' : 'unpooled';
    const newConnection = (appName: string) => {
      const config = {
        name: 'postgres',
        connectionString: taggedConnectionString(appName),
      };
      return pooled
        ? new PooledPostgresConnection(config)
        : new PostgresConnection(config);
    };

    it(`fails the next read of a stream whose session was dropped between reads (${kind})`, async () => {
      const appName = newAppName(`leak_test_dropped_paused_${kind}`);
      const connection = newConnection(appName);
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
      const connection = newConnection(appName);
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
