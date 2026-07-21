/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {spawnSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {DuckDBInstance} from '@duckdb/node-api';
import {DuckDBCommon} from './duckdb_common';
import {DuckDBConnection} from './duckdb_connection';
import type {SQLSourceRequest, StructDef} from '@malloydata/malloy';
import {makeDigest, mkArrayDef} from '@malloydata/malloy';
import {createTestRuntime, mkTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

/*
 * !IMPORTANT
 *
 * The connection is reused for each test, so if you do not name your tables
 * and keys uniquely for each test you will see cross test interactions.
 */

describe('DuckDBConnection', () => {
  const connection = new DuckDBConnection('duckdb');

  beforeAll(async () => {
    await connection.runSQL('SELECT 1');
    expect(Object.keys(DuckDBConnection.activeDBs).length).toEqual(1);
  });

  afterAll(async () => {
    await connection.close();
    expect(Object.keys(DuckDBConnection.activeDBs).length).toEqual(0);
  });

  describe('schema', () => {
    let runRawSQL: jest.SpyInstance;

    beforeEach(async () => {
      runRawSQL = jest
        .spyOn(DuckDBCommon.prototype, 'runRawSQL')
        .mockResolvedValue({rows: [], totalRows: 0});
    });

    afterEach(() => {
      jest.resetAllMocks();
      runRawSQL.mockRestore();
    });

    it('caches table schema', async () => {
      await connection.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes table schema', async () => {
      await connection.fetchSchemaForTables({'test2': 'table2'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForTables(
        {'test2': 'table2'},
        {refreshTimestamp: Date.now() + 10}
      );
      expect(runRawSQL).toHaveBeenCalledTimes(2);
    });

    it('caches sql schema', async () => {
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes sql schema', async () => {
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
        refreshTimestamp: Date.now() + 10,
      });
      expect(runRawSQL).toHaveBeenCalledTimes(2);
    });

    it('fetches schema for a single-quoted file-path table', async () => {
      await connection.fetchSchemaForTables(
        {'dashed': "'arrests-latest.parquet'"},
        {}
      );
      expect(runRawSQL).toHaveBeenCalledWith(
        "DESCRIBE SELECT * FROM 'arrests-latest.parquet'"
      );
    });

    it('fetches schema for a bare identifier', async () => {
      await connection.fetchSchemaForTables({'plain': 'plain_table'}, {});
      expect(runRawSQL).toHaveBeenCalledWith(
        'DESCRIBE SELECT * FROM plain_table'
      );
    });

    it('fetches schema for a schema-qualified identifier path', async () => {
      await connection.fetchSchemaForTables(
        {'qualified': 'main.qualified_table'},
        {}
      );
      expect(runRawSQL).toHaveBeenCalledWith(
        'DESCRIBE SELECT * FROM main.qualified_table'
      );
    });
  });

  describe('multiple connections', () => {
    it('can open multiple connections with different settings', async () => {
      const connection1 = new DuckDBConnection('duckdb1');
      const connection2 = new DuckDBConnection('duckdb2');

      await connection1.runRawSQL("SET FILE_SEARCH_PATH='/home/user1'");
      await connection1.runRawSQL("SET TimeZone='America/New_York'");
      // Initializing a later non-locked handle must not replay the configured
      // baseline with SET GLOBAL and disturb connection1's session overrides.
      await connection2.runSQL('SELECT 1');
      const retained1 = await connection1.runSQL(
        "SELECT current_setting('FILE_SEARCH_PATH') AS path, current_setting('TimeZone') AS timezone"
      );
      expect(retained1).toEqual({
        rows: [{path: '/home/user1', timezone: 'America/New_York'}],
        totalRows: 1,
      });

      await connection2.runRawSQL("SET FILE_SEARCH_PATH='/home/user2'");
      await connection2.runRawSQL("SET TimeZone='America/Los_Angeles'");

      const val1 = await connection1.runSQL(
        "SELECT current_setting('FILE_SEARCH_PATH') AS val, current_setting('TimeZone') AS timezone"
      );
      const val2 = await connection2.runSQL(
        "SELECT current_setting('FILE_SEARCH_PATH') AS val, current_setting('TimeZone') AS timezone"
      );

      expect(Object.keys(DuckDBConnection.activeDBs).length).toEqual(1);
      expect(
        Object.values(DuckDBConnection.activeDBs)[0].connections.length
      ).toEqual(3);
      expect(val1).toEqual({
        rows: [{val: '/home/user1', timezone: 'America/New_York'}],
        totalRows: 1,
      });
      expect(val2).toEqual({
        rows: [{val: '/home/user2', timezone: 'America/Los_Angeles'}],
        totalRows: 1,
      });

      await connection1.close();
      await connection2.close();
    });

    it('preserves the default alias digest and versions opt-in catalog identities', async () => {
      const databasePath = path.join(os.tmpdir(), 'shareable-digest.duckdb');
      const omitted = new DuckDBConnection({
        name: 'duckdb_digest_omitted',
        databasePath,
        shareable: true,
      });
      const natural = new DuckDBConnection({
        name: 'duckdb_digest_natural',
        databasePath,
        shareable: true,
        shareableAttachAlias: 'auto',
      });
      const legacy = new DuckDBConnection({
        name: 'duckdb_digest_legacy',
        databasePath,
        shareable: true,
        shareableAttachAlias: 'malloy_db',
      });
      const custom = new DuckDBConnection({
        name: 'duckdb_digest_custom',
        databasePath,
        shareable: true,
        shareableAttachAlias: 'custom_catalog',
      });

      try {
        const oldShareableDigest = makeDigest(
          'duckdb',
          databasePath,
          undefined,
          undefined
        );
        expect(omitted.getDigest()).toBe(oldShareableDigest);
        expect(legacy.getDigest()).toBe(oldShareableDigest);
        expect(natural.getDigest()).not.toBe(oldShareableDigest);
        expect(custom.getDigest()).not.toBe(oldShareableDigest);
        expect(custom.getDigest()).not.toBe(natural.getDigest());
      } finally {
        await Promise.all([
          natural.connecting,
          omitted.connecting,
          legacy.connecting,
          custom.connecting,
        ]);
        await Promise.all([
          omitted.close(),
          natural.close(),
          legacy.close(),
          custom.close(),
        ]);
      }
    });
  });

  describe('temporary table compatibility', () => {
    it('keeps deterministic TEMP reuse for direct native connections', async () => {
      const direct = new DuckDBConnection({
        name: 'duckdb_direct_temp_compatibility',
        databasePath: ':memory:',
      });
      try {
        expect(direct.runSQLWithTemporaryTable).toBeUndefined();
        await direct.runSQL('CREATE SEQUENCE direct_materializations START 1');
        const sql =
          "SELECT nextval('direct_materializations')::INTEGER AS value";
        const first = await direct.manifestTemporaryTable(sql);
        const second = await direct.manifestTemporaryTable(sql);

        expect(first).toBe(second);
        expect(first).toMatch(/^tt(?!s)/);
        await expect(
          direct.runSQL(
            "SELECT currval('direct_materializations')::INTEGER AS materializations"
          )
        ).resolves.toMatchObject({rows: [{materializations: 1}]});
      } finally {
        await direct.close();
      }
    });

    it('does not expose scoped TEMP for ineffective in-memory shareable mode', async () => {
      const connection = new DuckDBConnection({
        name: 'duckdb_ineffective_shareable_temp',
        databasePath: ':memory:',
        shareable: true,
      });
      try {
        expect(connection.runSQLWithTemporaryTable).toBeUndefined();
        await expect(connection.runSQL('SELECT 1 AS v')).resolves.toMatchObject(
          {
            rows: [{v: 1}],
          }
        );
      } finally {
        await connection.close();
      }
    });
  });

  describe('idle', () => {
    let tempRoot: string;

    beforeAll(() => {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-duckdb-idle-'));
    });

    afterAll(() => {
      fs.rmSync(tempRoot, {recursive: true, force: true});
    });

    it('idle does NOT release the file lock cross-process (TODO: fix without crashing)', async () => {
      // 0.0.389 attempted this fix via `disconnectSync()` in
      // `detachInstance()`; it caused SIGSEGV / `bad_weak_ptr` from
      // malloy-internal caches retaining weak_ptrs to the destroyed
      // C++ Connection. Reverted in 0.0.390. Proper fix needs cache
      // invalidation coordination (manifest reader is the leading
      // suspect). Until then this test asserts the current (buggy
      // but stable) behavior: another process trying to open the
      // same database path while we hold it idle gets HELD, not FREE.
      const dbPath = path.join(tempRoot, 'idle-release.duckdb');
      const conn = new DuckDBConnection({name: 'duckdb', databasePath: dbPath});
      try {
        await conn.runSQL('SELECT 1');
        await conn.idle();

        // The OS file lock (fcntl) is per-process — opening the same path
        // from the same Node process succeeds even when the lock is held
        // by another DuckDBInstance in this process. To verify the lock
        // is genuinely released to other processes (the actual user
        // scenario: VS Code has the file open, CLI tries to write), we
        // probe from a child process.
        const result = spawnSync(
          process.execPath,
          [
            '-e',
            `(async () => {
              const {DuckDBInstance} = require('@duckdb/node-api');
              try {
                const inst = await DuckDBInstance.create(${JSON.stringify(dbPath)});
                inst.closeSync();
                process.stdout.write('FREE');
              } catch (e) {
                process.stdout.write('HELD: ' + (e && e.message ? e.message.split('\\n')[0] : String(e)));
              }
            })();`,
          ],
          {encoding: 'utf8', timeout: 10000}
        );
        expect(result.stdout.startsWith('HELD')).toBe(true);
      } finally {
        await conn.close();
      }
    });

    it('non-shareable idle does not churn a live shared instance', async () => {
      const dbPath = path.join(tempRoot, 'idle-shared-instance.duckdb');
      // Construct sequentially so the second connection's init() finds
      // and reuses the first's activeDBs entry instead of racing it.
      const a = new DuckDBConnection({name: 'duckdb_a', databasePath: dbPath});
      await a.runSQL('SELECT 1');
      const b = new DuckDBConnection({name: 'duckdb_b', databasePath: dbPath});
      await b.runSQL('SELECT 1');

      try {
        // Find the activeDBs entry these two connections share. The parent
        // describe also has a `:memory:` entry; we want the one for our
        // dbPath. Two connections to the same path share one entry, so
        // looking for `connections.length === 2` reliably picks it out.
        const sharedKey = Object.keys(DuckDBConnection.activeDBs).find(
          k => DuckDBConnection.activeDBs[k].connections.length === 2
        );
        expect(sharedKey).toBeDefined();

        await a.idle();

        // Legacy non-shareable idle cannot safely disconnect a native
        // Connection while higher layers retain native-backed state. It is
        // therefore an explicit no-op: neither the instance nor its two live
        // connections are churned.
        expect(DuckDBConnection.activeDBs[sharedKey!].connections.length).toBe(
          2
        );
        const stillWorks = await b.runSQL('SELECT 99 AS v');
        expect(stillWorks.rows).toEqual([{v: 99}]);

        // a remains the same live connection rather than lazily reattaching.
        const stillLive = await a.runSQL('SELECT 2 AS v');
        expect(stillLive.rows).toEqual([{v: 2}]);
        expect(DuckDBConnection.activeDBs[sharedKey!].connections.length).toBe(
          2
        );
      } finally {
        await a.close();
        await b.close();
      }
    });

    it('non-shareable idle preserves the existing live connection', async () => {
      const dbPath = path.join(tempRoot, 'idle-reattach.duckdb');
      const conn = new DuckDBConnection({name: 'duckdb', databasePath: dbPath});
      try {
        await conn.runSQL('CREATE TABLE t (val INTEGER)');
        await conn.runSQL('INSERT INTO t VALUES (42)');
        const nativeBefore = (conn as unknown as {connection: unknown})
          .connection;
        await conn.idle();
        expect((conn as unknown as {connection: unknown}).connection).toBe(
          nativeBefore
        );
        const result = await conn.runSQL('SELECT val FROM t');
        expect(result.rows).toEqual([{val: 42}]);
      } finally {
        await conn.close();
      }
    });

    it('idle is a no-op for :memory: (state preserved)', async () => {
      const conn = new DuckDBConnection({
        name: 'duckdb_memory_idle',
        databasePath: ':memory:',
      });
      try {
        await conn.runSQL('CREATE TABLE m (val INTEGER)');
        await conn.runSQL('INSERT INTO m VALUES (7)');
        await conn.idle();
        // If idle had run, the in-memory database would have been destroyed
        // and the table would no longer exist. State must survive.
        const result = await conn.runSQL('SELECT val FROM m');
        expect(result.rows).toEqual([{val: 7}]);
      } finally {
        await conn.close();
      }
    });

    it('schema cache survives idle', async () => {
      const dbPath = path.join(tempRoot, 'idle-schema-cache.duckdb');
      const conn = new DuckDBConnection({name: 'duckdb', databasePath: dbPath});
      try {
        await conn.runSQL('CREATE TABLE cached (x INTEGER, y VARCHAR)');
        // Prime the schema cache.
        const first = await conn.fetchSchemaForTables({'cached': 'cached'}, {});
        expect(first.schemas['cached']).toBeDefined();

        const fetchSpy = jest.spyOn(
          DuckDBConnection.prototype,
          'fetchTableSchema'
        );

        await conn.idle();
        // Re-request — should hit the cache and not call fetchTableSchema.
        const second = await conn.fetchSchemaForTables(
          {'cached': 'cached'},
          {}
        );
        expect(second.schemas['cached']).toBeDefined();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
      } finally {
        await conn.close();
      }
    });

    it('close() is terminal — subsequent operations fail with a clear error', async () => {
      const dbPath = path.join(tempRoot, 'close-terminal.duckdb');
      const conn = new DuckDBConnection({name: 'duckdb', databasePath: dbPath});
      await conn.runSQL('SELECT 1');
      await conn.close();
      await expect(conn.runSQL('SELECT 2')).rejects.toThrow(/closed/);
    });

    it('shareable: idle releases the OS file lock cross-process', async () => {
      // The whole point of shareable mode: another process can open the
      // file while this connection is idled. Verified from a child node
      // process because fcntl locks are per-process on POSIX.
      const dbPath = path.join(tempRoot, 'shareable-idle-release.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable',
        databasePath: dbPath,
        shareable: true,
      });
      try {
        await conn.runSQL('CREATE TABLE t (val INTEGER)');
        await conn.runSQL('INSERT INTO t VALUES (1)');
        await conn.idle();
        const result = spawnSync(
          process.execPath,
          [
            '-e',
            `(async () => {
              const {DuckDBInstance} = require('@duckdb/node-api');
              try {
                const inst = await DuckDBInstance.create(${JSON.stringify(dbPath)});
                inst.closeSync();
                process.stdout.write('FREE');
              } catch (e) {
                process.stdout.write('HELD: ' + (e && e.message ? e.message.split('\\n')[0] : String(e)));
              }
            })();`,
          ],
          {encoding: 'utf8', timeout: 10000}
        );
        expect(result.stdout).toBe('FREE');

        // Reattach transparently and the persisted row is still there.
        const round = await conn.runSQL('SELECT val FROM t');
        expect(round.rows).toEqual([{val: 1}]);
      } finally {
        await conn.close();
      }
    });

    it('shareable: setupSQL does NOT replay on wake (in-memory primary persists)', async () => {
      // The in-memory primary survives idle in shareable mode, so user
      // setupSQL with non-idempotent side effects would fail on a second
      // wake if it re-ran. Use a bare `CREATE TABLE` (no OR REPLACE) so
      // any replay would throw "table already exists".
      const dbPath = path.join(tempRoot, 'shareable-setupsql-once.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_setup',
        databasePath: dbPath,
        shareable: true,
        setupSQL: 'CREATE TABLE memory.main.session (n INTEGER)',
      });
      try {
        await conn.runSQL('SELECT 1');
        await conn.idle();
        // If setupSQL replayed, this next runSQL would throw "table
        // already exists" during the wake-time setupOnce.
        const result = await conn.runSQL('SELECT 2 AS v');
        expect(result.rows).toEqual([{v: 2}]);
      } finally {
        await conn.close();
      }
    });

    it('shareable: CREATE TABLE on a fresh connection lands in the attached file, not :memory:', async () => {
      // The cli build path: lookupConnection → conn.runSQL('CREATE TABLE …').
      // No prior runSQL, no idle. The persistence builder expects the table
      // to be written to the attached file so that another process can read
      // it from the file. If `attachIfShareable` were skipped (or somehow the
      // session still had `memory.main` as default), the unqualified CREATE
      // would land in the in-memory primary and the file would stay empty.
      const dbPath = path.join(
        tempRoot,
        'shareable-create-lands-in-file.duckdb'
      );
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_persist',
        databasePath: dbPath,
        shareable: true,
      });
      try {
        // Mirror cli/build.ts createTableFromSelect: DROP IF EXISTS then CREATE.
        await conn.runSQL('DROP TABLE IF EXISTS persisted');
        await conn.runSQL('CREATE TABLE persisted AS SELECT 42 AS v');

        // Assert on the catalog the table actually lives in. The omitted
        // alias retains the historical `malloy_db` catalog identity.
        const where = await conn.runSQL(
          "SELECT database_name FROM duckdb_tables() WHERE table_name='persisted'"
        );
        expect(where.rows).toEqual([{database_name: 'malloy_db'}]);

        // And: after DETACH, the data must actually be in the file. Idle to
        // release the lock, then open the file from a child process and
        // count the rows. If CREATE went to :memory:, the file is empty and
        // this read returns no rows / the table doesn't exist.
        await conn.idle();
        const probe = spawnSync(
          process.execPath,
          [
            '-e',
            `(async () => {
              const {DuckDBInstance} = require('@duckdb/node-api');
              const inst = await DuckDBInstance.create(${JSON.stringify(dbPath)});
              const c = await inst.connect();
              const r = await (await c.run("SELECT v FROM persisted")).getRowObjectsJson();
              process.stdout.write(JSON.stringify(r));
              inst.closeSync();
            })().catch(e => { process.stdout.write('ERR:' + (e && e.message ? e.message.split('\\n')[0] : String(e))); });`,
          ],
          {encoding: 'utf8', timeout: 10000}
        );
        expect(probe.stdout).toBe('[{"v":42}]');
      } finally {
        await conn.close();
      }
    });

    it('shareable: opt-in auto reads natural catalog views (#2984)', async () => {
      const caseRoot = path.join(tempRoot, 'issue-2984');
      fs.mkdirSync(caseRoot, {recursive: true});
      const dbPath = path.join(caseRoot, 'mydb.duckdb');
      await createCatalogQualifiedView(dbPath, 'mydb');

      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_catalog_view',
        databasePath: dbPath,
        shareable: true,
        shareableAttachAlias: 'auto',
        readOnly: true,
      });
      try {
        const schema = await conn.fetchSchemaForTables(
          {'catalog_view': 'marts.t1'},
          {}
        );
        expect(schema.schemas['catalog_view']).toBeDefined();

        const first = await conn.runSQL('SELECT v FROM marts.t1');
        expect(first.rows).toEqual([{v: 42}]);

        await expect(
          conn.runSQL(
            'INSERT INTO sqlmesh__marts.marts__t1__3443228196 VALUES (99)'
          )
        ).rejects.toThrow(/read.?only/i);
        await expect(
          conn.runSQL('SELECT v FROM marts.t1 ORDER BY v')
        ).resolves.toMatchObject({rows: [{v: 42}]});

        const catalogs = await conn.runSQL(
          "SELECT database_name FROM duckdb_databases() WHERE database_name = 'mydb'"
        );
        expect(catalogs.rows).toEqual([{database_name: 'mydb'}]);

        await conn.idle();
        const afterIdle = await conn.runSQL('SELECT v FROM marts.t1');
        expect(afterIdle.rows).toEqual([{v: 42}]);
      } finally {
        await conn.close();
      }
    });

    it('shareable: terminally cleans up when natural catalog discovery fails', async () => {
      const dbPath = path.join(tempRoot, 'shareable-discovery-failure.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_discovery_failure',
        databasePath: dbPath,
        shareable: true,
        shareableAttachAlias: 'auto',
      });
      await conn.connecting;
      const internal = conn as unknown as {
        readDuckDBCatalogsByOID(): Promise<Map<string, string>>;
      };
      const readCatalogs = internal.readDuckDBCatalogsByOID.bind(conn);
      let readCount = 0;
      const discoverySpy = jest
        .spyOn(internal, 'readDuckDBCatalogsByOID')
        .mockImplementation(async () => {
          readCount++;
          if (readCount >= 2) {
            throw new Error('injected catalog discovery failure');
          }
          return readCatalogs();
        });

      try {
        await expect(conn.runSQL('SELECT 1')).rejects.toThrow(
          'injected catalog discovery failure'
        );
        expect(probeDuckDBFile(dbPath)).toBe('FREE');
        await expect(conn.runSQL('SELECT 2')).rejects.toThrow(/closed/);
      } finally {
        discoverySpy.mockRestore();
        await conn.close();
      }
    });

    it('shareable: reconciles and remains retryable when ATTACH executes but its wrapper rejects', async () => {
      const dbPath = path.join(tempRoot, 'shareable-attach-window.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_attach_window',
        databasePath: dbPath,
        shareable: true,
      });
      await conn.connecting;
      const internal = conn as unknown as {
        runDuckDBCommand(sql: string): Promise<void>;
      };
      const runCommand = internal.runDuckDBCommand.bind(conn);
      const commandSpy = jest
        .spyOn(internal, 'runDuckDBCommand')
        .mockImplementationOnce(async sql => {
          expect(sql).toMatch(/^ATTACH /);
          await runCommand(sql);
          throw new Error('injected post-ATTACH wrapper failure');
        });

      try {
        await expect(conn.runSQL('SELECT 1')).rejects.toThrow(
          'injected post-ATTACH wrapper failure'
        );
        expect(probeDuckDBFile(dbPath)).toBe('FREE');
        await expect(conn.runSQL('SELECT 2 AS v')).resolves.toMatchObject({
          rows: [{v: 2}],
        });
      } finally {
        commandSpy.mockRestore();
        await conn.close();
      }
    });

    it('shareable: rolls back ATTACH when selecting the catalog fails', async () => {
      const dbPath = path.join(tempRoot, 'shareable-use-failure.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_use_failure',
        databasePath: dbPath,
        shareable: true,
      });
      await conn.connecting;
      const internal = conn as unknown as {
        useShareableCatalog(catalog: string): Promise<void>;
      };
      const useSpy = jest
        .spyOn(internal, 'useShareableCatalog')
        .mockRejectedValueOnce(new Error('injected USE failure'));

      try {
        await expect(conn.runSQL('SELECT 1')).rejects.toThrow(
          'injected USE failure'
        );
        expect(probeDuckDBFile(dbPath)).toBe('FREE');

        useSpy.mockRestore();
        await conn.idle();
        const retry = await conn.runSQL('SELECT 2 AS v');
        expect(retry.rows).toEqual([{v: 2}]);
      } finally {
        useSpy.mockRestore();
        await conn.close();
      }
    });

    it('shareable: terminally cleans up when ATTACH rollback cannot DETACH', async () => {
      const dbPath = path.join(tempRoot, 'shareable-rollback-failure.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_rollback_failure',
        databasePath: dbPath,
        shareable: true,
      });
      await conn.connecting;
      const internal = conn as unknown as {
        runDuckDBCommand(sql: string): Promise<void>;
        useShareableCatalog(catalog: string): Promise<void>;
      };
      const runCommand = internal.runDuckDBCommand.bind(conn);
      const commandSpy = jest
        .spyOn(internal, 'runDuckDBCommand')
        .mockImplementation(async sql => {
          if (sql.startsWith('DETACH ')) {
            throw new Error('injected rollback DETACH failure');
          }
          await runCommand(sql);
        });
      const useSpy = jest
        .spyOn(internal, 'useShareableCatalog')
        .mockRejectedValueOnce(new Error('injected initial USE failure'));

      try {
        await expect(conn.runSQL('SELECT 1')).rejects.toThrow(
          /injected initial USE failure.*injected rollback DETACH failure/
        );
        expect(probeDuckDBFile(dbPath)).toBe('FREE');
        await expect(conn.runSQL('SELECT 2')).rejects.toThrow(/closed/);
      } finally {
        commandSpy.mockRestore();
        useSpy.mockRestore();
        await conn.close();
      }
    });

    it('shareable: idle surfaces DETACH failure and remains usable after restoring the catalog', async () => {
      const dbPath = path.join(
        tempRoot,
        'shareable-idle-detach-failure.duckdb'
      );
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_idle_detach_failure',
        databasePath: dbPath,
        shareable: true,
      });
      await conn.runSQL('CREATE TABLE retryable (v INTEGER)');
      await conn.runSQL('INSERT INTO retryable VALUES (11)');

      const internal = conn as unknown as {
        runDuckDBCommand(sql: string): Promise<void>;
      };
      const runCommand = internal.runDuckDBCommand.bind(conn);
      let rejectedDetach = false;
      const commandSpy = jest
        .spyOn(internal, 'runDuckDBCommand')
        .mockImplementation(async sql => {
          if (!rejectedDetach && sql.startsWith('DETACH ')) {
            rejectedDetach = true;
            throw new Error('injected idle DETACH failure');
          }
          await runCommand(sql);
        });

      try {
        await expect(conn.idle()).rejects.toThrow(
          'injected idle DETACH failure'
        );
        const afterFailure = await conn.runSQL('SELECT v FROM retryable');
        expect(afterFailure.rows).toEqual([{v: 11}]);

        commandSpy.mockRestore();
        await conn.idle();
        expect(probeDuckDBFile(dbPath)).toBe('FREE');
      } finally {
        commandSpy.mockRestore();
        await conn.close();
      }
    });

    it('shareable: terminally cleans up when DETACH and default-catalog restore both fail', async () => {
      const dbPath = path.join(
        tempRoot,
        'shareable-detach-restore-failure.duckdb'
      );
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_detach_restore_failure',
        databasePath: dbPath,
        shareable: true,
      });
      await conn.runSQL('SELECT 1');

      const internal = conn as unknown as {
        runDuckDBCommand(sql: string): Promise<void>;
      };
      const runCommand = internal.runDuckDBCommand.bind(conn);
      let detachFailed = false;
      const commandSpy = jest
        .spyOn(internal, 'runDuckDBCommand')
        .mockImplementation(async sql => {
          if (sql.startsWith('DETACH ')) {
            detachFailed = true;
            throw new Error('injected terminal DETACH failure');
          }
          if (
            detachFailed &&
            sql.startsWith('USE ') &&
            !sql.includes('"memory"."main"')
          ) {
            throw new Error('injected catalog restore failure');
          }
          await runCommand(sql);
        });

      try {
        await expect(conn.idle()).rejects.toThrow(
          /injected terminal DETACH failure.*injected catalog restore failure/
        );
        expect(probeDuckDBFile(dbPath)).toBe('FREE');
        await expect(conn.runSQL('SELECT 2')).rejects.toThrow(/closed/);
      } finally {
        commandSpy.mockRestore();
        await conn.close();
      }
    });

    it('shareable: close terminally releases the lock after DETACH failure', async () => {
      const dbPath = path.join(
        tempRoot,
        'shareable-close-detach-failure.duckdb'
      );
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_close_detach_failure',
        databasePath: dbPath,
        shareable: true,
      });
      await conn.runSQL('SELECT 1');

      const internal = conn as unknown as {
        runDuckDBCommand(sql: string): Promise<void>;
      };
      const runCommand = internal.runDuckDBCommand.bind(conn);
      const commandSpy = jest
        .spyOn(internal, 'runDuckDBCommand')
        .mockImplementation(async sql => {
          if (sql.startsWith('DETACH ')) {
            throw new Error('injected close DETACH failure');
          }
          await runCommand(sql);
        });

      try {
        await expect(conn.close()).rejects.toThrow(
          'injected close DETACH failure'
        );
        expect(probeDuckDBFile(dbPath)).toBe('FREE');
        await expect(conn.runSQL('SELECT 2')).rejects.toThrow(/closed/);
      } finally {
        commandSpy.mockRestore();
        await conn.close();
      }
    });

    it.each([
      [
        'the legacy alias for a reserved natural name',
        'malloy_db',
        'memory.duckdb',
      ],
      [
        'an injection-looking quoted alias',
        'catalog "quoted"; --',
        'shareable-quoted-alias.duckdb',
      ],
    ])(
      'shareable: supports %s through shareableAttachAlias',
      async (_description, shareableAttachAlias, filename) => {
        const dbPath = path.join(tempRoot, filename);
        const conn = new DuckDBConnection({
          name: `duckdb_${filename}`,
          databasePath: dbPath,
          shareable: true,
          shareableAttachAlias,
        });
        try {
          await conn.runSQL('CREATE TABLE aliased (v INTEGER)');
          await conn.runSQL('INSERT INTO aliased VALUES (7)');
          const where = await conn.runSQL(
            "SELECT database_name FROM duckdb_tables() WHERE table_name='aliased'"
          );
          expect(where.rows).toEqual([{database_name: shareableAttachAlias}]);

          await conn.idle();
          const afterIdle = await conn.runSQL('SELECT v FROM aliased');
          expect(afterIdle.rows).toEqual([{v: 7}]);
        } finally {
          await conn.close();
        }
      }
    );

    it('shareable: reads a persisted view through a quoted custom catalog alias', async () => {
      const shareableAttachAlias = 'catalog "quoted"; --';
      const dbPath = path.join(tempRoot, 'shareable-quoted-view.duckdb');
      await createAliasedCatalogQualifiedView(dbPath, shareableAttachAlias);
      const conn = new DuckDBConnection({
        name: 'duckdb_shareable_quoted_view',
        databasePath: dbPath,
        shareable: true,
        shareableAttachAlias,
        readOnly: true,
      });

      try {
        await expect(
          conn.runSQL('SELECT v FROM marts.t1')
        ).resolves.toMatchObject({rows: [{v: 42}]});
        await conn.idle();
        await expect(
          conn.runSQL('SELECT v FROM marts.t1')
        ).resolves.toMatchObject({rows: [{v: 42}]});
      } finally {
        await conn.close();
      }
    });

    it('shareable: omitted alias preserves historical malloy_db views', async () => {
      const dbPath = path.join(tempRoot, 'historical-malloy-db-view.duckdb');
      await createAliasedCatalogQualifiedView(dbPath, 'malloy_db');
      const conn = new DuckDBConnection({
        name: 'historical_malloy_db_view',
        databasePath: dbPath,
        shareable: true,
        readOnly: true,
      });

      try {
        await expect(
          conn.runSQL('SELECT v FROM marts.t1')
        ).resolves.toMatchObject({rows: [{v: 42}]});
      } finally {
        await conn.close();
      }
    });

    it('non-shareable idle does not replay setupSQL', async () => {
      const dbPath = path.join(tempRoot, 'idle-setupsql.duckdb');
      const conn = new DuckDBConnection({
        name: 'duckdb_idle_setup',
        databasePath: dbPath,
        setupSQL: 'CREATE TABLE setup_once (v INTEGER)',
      });
      try {
        await conn.runSQL('INSERT INTO setup_once VALUES (6)');
        await conn.idle();
        // Replaying this non-idempotent CREATE would fail. Healthy direct
        // idle is a no-op and preserves both the handle and setup state.
        const result = await conn.runSQL('SELECT v FROM setup_once');
        expect(result.rows).toEqual([{v: 6}]);
      } finally {
        await conn.close();
      }
    });
  });

  describe('setupSQL', () => {
    it('runs a single setup statement', async () => {
      const conn = new DuckDBConnection({
        name: 'duckdb_single_setup_test',
        setupSQL: 'CREATE OR REPLACE MACRO add_one(x) AS x + 1',
      });
      try {
        const result = await conn.runSQL('SELECT add_one(41) AS result');
        expect(result.rows[0]['result']).toBe(42);
      } finally {
        await conn.close();
      }
    });

    it('runs multiple setup SQL statements', async () => {
      const conn = new DuckDBConnection({
        name: 'duckdb_multi_setup_test',
        setupSQL:
          'CREATE OR REPLACE MACRO add_one(x) AS x + 1;\nCREATE OR REPLACE MACRO double_it(x) AS x * 2',
      });
      try {
        const result = await conn.runSQL(
          'SELECT add_one(41) AS a, double_it(5) AS b'
        );
        expect(result).toEqual({rows: [{a: 42, b: 10}], totalRows: 1});
      } finally {
        await conn.close();
      }
    });

    it('handles multi-line statements', async () => {
      const conn = new DuckDBConnection({
        name: 'duckdb_multiline_setup_test',
        setupSQL: 'CREATE OR REPLACE MACRO add_values(x, y) AS\n  x + y',
      });
      try {
        const result = await conn.runSQL('SELECT add_values(3, 4) AS result');
        expect(result).toEqual({rows: [{result: 7}], totalRows: 1});
      } finally {
        await conn.close();
      }
    });
  });

  describe('schema parser', () => {
    it('parses arrays', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: ARRAY_SCHEMA});
      expect(structDef.fields[0]).toEqual(
        mkArrayDef({type: 'number', numberType: 'integer'}, 'test')
      );
    });

    it('parses inline', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: INLINE_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'record',
        'join': 'one',
        'fields': [
          {'name': 'a', ...dblType},
          {'name': 'b', ...intTyp},
          {'name': 'c', ...strTyp},
        ],
      });
    });

    it('parses nested', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: NESTED_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'join': 'many',
        'fields': [
          {'name': 'a', 'numberType': 'float', 'type': 'number'},
          {'name': 'b', 'numberType': 'integer', 'type': 'number'},
          {'name': 'c', 'type': 'string'},
        ],
      });
    });
    it('parses struct with sql native field', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: PROFESSOR_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'join': 'many',
        'fields': [
          {'name': 'professor_id', 'type': 'sql native', 'rawType': 'UUID'},
          {'name': 'name', 'type': 'string'},
          {'name': 'age', 'numberType': 'bigint', 'type': 'number'},
          {'name': 'total_sections', 'numberType': 'bigint', 'type': 'number'},
        ],
      });
    });

    it('parses a simple type', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: 'VARCHAR(60)'});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'string',
      });
    });

    it('parses timestamp with time zone', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {
        test: 'TIMESTAMP WITH TIME ZONE',
      });
      expect(structDef.fields[0]).toEqual({
        name: 'test',
        type: 'timestamptz',
      });
    });

    it('parses unknown type', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: 'UUID'});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'sql native',
        'rawType': 'UUID',
      });
    });

    describe('integer type mappings', () => {
      it('maps INTEGER to integer', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'INTEGER'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps SMALLINT to integer', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'SMALLINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps TINYINT to integer', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'TINYINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps BIGINT to bigint', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'BIGINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'bigint',
        });
      });

      it('maps HUGEINT to bigint', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'HUGEINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'bigint',
        });
      });

      it('maps UBIGINT to bigint', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'UBIGINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'bigint',
        });
      });

      it('maps UHUGEINT to bigint', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'UHUGEINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'bigint',
        });
      });

      it('maps FLOAT to float', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'FLOAT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'float',
        });
      });

      it('maps DOUBLE to float', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'DOUBLE'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'float',
        });
      });

      it('maps DECIMAL(10,2) to float', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'DECIMAL(10,2)'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'float',
        });
      });
    });
  });

  /**
   * Tests for reading numeric values through Malloy queries
   */
  describe('numeric value reading', () => {
    const runtime = createTestRuntime(connection);
    const testModel = mkTestModel(runtime, {});

    describe('integer types', () => {
      it.each([
        'TINYINT',
        'SMALLINT',
        'INTEGER',
        'BIGINT',
        'UTINYINT',
        'USMALLINT',
        'UINTEGER',
        'UBIGINT',
        'HUGEINT',
        'UHUGEINT',
      ])('reads %s correctly', async sqlType => {
        await expect(
          `run: duckdb.sql("SELECT 10::${sqlType} as d")`
        ).toMatchResult(testModel, {d: 10});
      });

      it('preserves precision for literal integers > 2^53', async () => {
        const largeInt = BigInt('9007199254740993'); // 2^53 + 1
        await expect(`
        run: duckdb.sql("select 1") -> { select: d is ${largeInt} }
      `).toMatchResult(testModel, {d: largeInt});
      });
    });

    describe('float types', () => {
      it.each(['FLOAT', 'DOUBLE', 'DECIMAL(10,2)'])(
        'reads %s correctly',
        async sqlType => {
          await expect(
            `run: duckdb.sql("SELECT 10.5::${sqlType} as f")`
          ).toMatchResult(testModel, {f: 10.5});
        }
      );
    });
  });
});

async function createCatalogQualifiedView(
  databasePath: string,
  catalog: string
): Promise<void> {
  const instance = await DuckDBInstance.create(databasePath);
  const connection = await instance.connect();
  const quotedCatalog = `"${catalog.replace(/"/g, '""')}"`;
  try {
    await connection.run('CREATE SCHEMA sqlmesh__marts');
    await connection.run(
      'CREATE TABLE sqlmesh__marts.marts__t1__3443228196 (v INTEGER)'
    );
    await connection.run(
      'INSERT INTO sqlmesh__marts.marts__t1__3443228196 VALUES (42)'
    );
    await connection.run('CREATE SCHEMA marts');
    await connection.run(
      `CREATE VIEW marts.t1 AS SELECT * FROM ${quotedCatalog}.sqlmesh__marts.marts__t1__3443228196`
    );
  } finally {
    connection.disconnectSync();
    instance.closeSync();
  }
}

async function createAliasedCatalogQualifiedView(
  databasePath: string,
  catalog: string
): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  const quotedCatalog = `"${catalog.replace(/"/g, '""')}"`;
  const quotedPath = `'${databasePath.replace(/'/g, "''")}'`;
  let attached = false;
  try {
    await connection.run(`ATTACH ${quotedPath} AS ${quotedCatalog}`);
    attached = true;
    await connection.run(`CREATE SCHEMA ${quotedCatalog}.sqlmesh__marts`);
    await connection.run(
      `CREATE TABLE ${quotedCatalog}.sqlmesh__marts.marts__t1__3443228196 (v INTEGER)`
    );
    await connection.run(
      `INSERT INTO ${quotedCatalog}.sqlmesh__marts.marts__t1__3443228196 VALUES (42)`
    );
    await connection.run(`CREATE SCHEMA ${quotedCatalog}.marts`);
    await connection.run(
      `CREATE VIEW ${quotedCatalog}.marts.t1 AS SELECT * FROM ${quotedCatalog}.sqlmesh__marts.marts__t1__3443228196`
    );
  } finally {
    if (attached) await connection.run(`DETACH ${quotedCatalog}`);
    connection.disconnectSync();
    instance.closeSync();
  }
}

function probeDuckDBFile(databasePath: string): string {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `(async () => {
        const {DuckDBInstance} = require('@duckdb/node-api');
        try {
          const instance = await DuckDBInstance.create(${JSON.stringify(databasePath)});
          instance.closeSync();
          process.stdout.write('FREE');
        } catch (error) {
          process.stdout.write('HELD: ' + (error && error.message ? error.message.split('\\n')[0] : String(error)));
        }
      })();`,
    ],
    {encoding: 'utf8', timeout: 10000}
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `DuckDB file probe exited with ${result.signal ?? result.status}: ${result.stderr}`
    );
  }
  return result.stdout;
}

/**
 * Create a basic StructDef for the purpose of passing to
 * DuckDBConnection.fillStructDefFromTypeMap()
 *
 * @returns valid StructDef for testing
 */
const makeStructDef = (): StructDef => {
  return {
    type: 'table',
    name: 'test',
    dialect: 'duckdb',
    tablePath: 'test',
    connection: 'duckdb',
    fields: [],
  };
};

//
// SQL blocks for testing table name detection in
// DuckDBConnection.fetchSchemaForSQLBlock()
//

// Uses string value for table
const SQL_BLOCK_1: SQLSourceRequest = {
  connection: 'duckdb',
  selectStr: `
SELECT
created_at,
sale_price,
inventory_item_id
FROM 'order_items.parquet'
SELECT
id,
product_department,
product_category,
created_at AS inventory_items_created_at
FROM "inventory_items.parquet"
`,
};

// Uses read_parquet() for table
const SQL_BLOCK_2: SQLSourceRequest = {
  connection: 'duckdb',
  selectStr: `
SELECT
created_at,
sale_price,
inventory_item_id
FROM read_parquet('order_items2.parquet', arg='value')
SELECT
id,
product_department,
product_category,
created_at AS inventory_items_created_at
FROM read_parquet("inventory_items2.parquet")
`,
};

//
// Type strings for testing DuckDBConnection.fillStructDefFromTypeMap()
//

// 'integer[]' is array
const ARRAY_SCHEMA = 'integer[]';

// STRUCT(...) is inline
const INLINE_SCHEMA = 'STRUCT(a double, b integer, c varchar(60))';

// STRUCT(....)[] is nested
const NESTED_SCHEMA = 'STRUCT(a double, b integer, c varchar(60))[]';

const intTyp = {type: 'number', numberType: 'integer'};
const strTyp = {type: 'string'};
const dblType = {type: 'number', numberType: 'float'};

const PROFESSOR_SCHEMA =
  'STRUCT(professor_id UUID, "name" VARCHAR, age BIGINT, total_sections BIGINT)[]';
