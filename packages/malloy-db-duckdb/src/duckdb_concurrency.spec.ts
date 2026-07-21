/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {performance} from 'perf_hooks';
import {spawn} from 'child_process';
import {DuckDBInstance} from '@duckdb/node-api';
import {
  DuckDBConnection,
  DuckDBLockTimeoutError,
  DuckDBShareableUnsupportedSQLError,
  DUCKDB_LOCK_TIMEOUT_CODE,
  DUCKDB_SHAREABLE_UNSUPPORTED_SQL_CODE,
} from './duckdb_connection';
import {
  DuckDBAtomicPublicationUnavailableError,
  physicalTargetBrokerSnapshotForTesting,
} from './duckdb_physical_target_broker';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function trackSettlement(promise: Promise<unknown>): () => boolean {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  return () => settled;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForBrokerWaiter(): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (physicalTargetBrokerSnapshotForTesting().waiters > 0) return;
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for a physical-target broker waiter');
}

async function waitForBrokerRelease(): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (physicalTargetBrokerSnapshotForTesting().owners === 0) return;
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for physical-target cleanup retry');
}

describe('DuckDB physical-target concurrency', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'malloy-duckdb-concurrency-')
    );
  });

  afterEach(() => {
    DuckDBConnection.closeAllInstances();
    fs.rmSync(tempRoot, {recursive: true, force: true});
    expect(physicalTargetBrokerSnapshotForTesting()).toEqual({
      paths: 0,
      inodes: 0,
      owners: 0,
      waiters: 0,
    });
  });

  it('drains a complete query before idle detaches the target', async () => {
    const connection = shareableConnection(tempRoot, 'query-idle.duckdb');
    await connection.runSQL('SELECT 1');
    const entered = deferred<void>();
    const resume = deferred<void>();
    const internal = connection as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 42 AS v') {
          entered.resolve();
          await resume.promise;
        }
        return runQuery(sql);
      });

    try {
      const query = connection.runSQL('SELECT 42 AS v');
      await entered.promise;
      const idle = connection.idle();
      const idleSettled = trackSettlement(idle);
      await flushMicrotasks();
      expect(idleSettled()).toBe(false);

      resume.resolve();
      await expect(query).resolves.toMatchObject({rows: [{v: 42}]});
      await expect(idle).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      querySpy.mockRestore();
      resume.resolve();
      await connection.close();
    }
  });

  it('coalesces concurrent idle calls into one physical DETACH', async () => {
    const connection = shareableConnection(tempRoot, 'double-idle.duckdb');
    await connection.runSQL('SELECT 1');
    const internal = connection as unknown as {
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const commands: string[] = [];
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        commands.push(sql);
        await runCommand(sql);
      });

    try {
      await Promise.all([connection.idle(), connection.idle()]);
      expect(commands.filter(sql => sql.startsWith('DETACH '))).toHaveLength(1);
    } finally {
      commandSpy.mockRestore();
      await connection.close();
    }
  });

  it('hands one physical target between independent shareable connections', async () => {
    const databasePath = path.join(tempRoot, 'fifo-handoff.duckdb');
    const first = new DuckDBConnection({
      name: 'first',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'second',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'second_catalog',
    });

    try {
      await first.runSQL('CREATE TABLE handed_off (v INTEGER)');
      await first.runSQL('INSERT INTO handed_off VALUES (7)');
      await expect(
        second.runSQL('SELECT v FROM handed_off')
      ).resolves.toMatchObject({rows: [{v: 7}]});
      await expect(
        first.runSQL('SELECT count(*) AS n FROM handed_off')
      ).resolves.toMatchObject({rows: [{n: '1'}]});
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 1,
        waiters: 0,
      });
    } finally {
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('atomically initializes a valid missing shareable database', async () => {
    const databasePath = path.join(tempRoot, 'atomic-bootstrap.duckdb');
    const connection = new DuckDBConnection({
      name: 'atomic-bootstrap',
      databasePath,
      shareable: true,
    });
    let externalInstance: DuckDBInstance | undefined;

    try {
      await connection.runRawSQL(
        'CREATE TABLE bootstrapped (v INTEGER); INSERT INTO bootstrapped VALUES (7)'
      );
      await connection.idle();

      expect(fs.statSync(databasePath).nlink).toBe(1);
      expect(
        fs
          .readdirSync(tempRoot)
          .filter(name => name.startsWith('.malloy-duckdb-bootstrap-'))
      ).toEqual([]);
      externalInstance = await DuckDBInstance.create(databasePath);
      const externalConnection = await externalInstance.connect();
      try {
        const result = await externalConnection.run(
          'SELECT v FROM bootstrapped'
        );
        await expect(result.getRowObjectsJson()).resolves.toEqual([{v: 7}]);
      } finally {
        externalConnection.disconnectSync();
        externalInstance.closeSync();
        externalInstance = undefined;
      }
    } finally {
      externalInstance?.closeSync();
      await connection.close();
    }
  });

  it('keeps atomic-publication capability failures typed and retryable with a pre-created target', async () => {
    const databasePath = path.join(
      tempRoot,
      'unsupported-atomic-bootstrap.duckdb'
    );
    const connection = new DuckDBConnection({
      name: 'unsupported-atomic-bootstrap',
      databasePath,
      shareable: true,
      shareableLockSafety: 'best-effort',
    });
    const unsupported = Object.assign(new Error('link unsupported'), {
      code: 'EOPNOTSUPP',
    });
    const linkSpy = jest.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw unsupported;
    });

    try {
      const error = await rejectionOf(connection.runSQL('SELECT 1'));
      expect(error).toBeInstanceOf(DuckDBAtomicPublicationUnavailableError);
      expect(error).toMatchObject({
        code: 'MALLOY_DUCKDB_ATOMIC_PUBLICATION_UNAVAILABLE',
        cause: unsupported,
      });
      expect(fs.existsSync(databasePath)).toBe(false);
      expect(
        fs
          .readdirSync(tempRoot)
          .filter(name => name.startsWith('.malloy-duckdb-bootstrap-'))
      ).toEqual([]);
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);

      const precreate = await DuckDBInstance.create(databasePath);
      precreate.closeSync();
      await expect(connection.runSQL('SELECT 2 AS v')).resolves.toMatchObject({
        rows: [{v: 2}],
      });
      expect(linkSpy).toHaveBeenCalledTimes(1);
    } finally {
      linkSpy.mockRestore();
      await connection.close();
    }
  });

  it('cancels missing-target publication before its atomic commit', async () => {
    const databasePath = path.join(tempRoot, 'cancel-bootstrap.duckdb');
    const connection = new DuckDBConnection({
      name: 'cancel-bootstrap',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const createInstance = DuckDBInstance.create.bind(DuckDBInstance);
    const prepared = deferred<void>();
    const resume = deferred<void>();
    const createSpy = jest
      .spyOn(DuckDBInstance, 'create')
      .mockImplementation(async (database, options) => {
        const instance = await createInstance(database, options);
        if (database?.includes('.malloy-duckdb-bootstrap-')) {
          prepared.resolve();
          await resume.promise;
        }
        return instance;
      });

    try {
      const query = connection.runSQL('SELECT 1');
      await prepared.promise;
      const close = connection.close();
      resume.resolve();

      await expect(query).rejects.toThrow(/is closed/);
      await expect(close).resolves.toBeUndefined();
      expect(fs.existsSync(databasePath)).toBe(false);
      expect(
        fs
          .readdirSync(tempRoot)
          .filter(name => name.startsWith('.malloy-duckdb-bootstrap-'))
      ).toEqual([]);
    } finally {
      resume.resolve();
      createSpy.mockRestore();
      await connection.close();
    }
  });

  it('does not start ATTACH after close wins the pre-controller setup window', async () => {
    const databasePath = path.join(tempRoot, 'close-before-attach.duckdb');
    const connection = new DuckDBConnection({
      name: 'close-before-attach',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const attachEntered = deferred<void>();
    const resumeAttach = deferred<void>();
    const internal = connection as unknown as {
      attachIfShareable(): Promise<void>;
    };
    const attach = internal.attachIfShareable.bind(connection);
    const attachSpy = jest
      .spyOn(internal, 'attachIfShareable')
      .mockImplementation(async () => {
        attachEntered.resolve();
        await resumeAttach.promise;
        await attach();
      });

    try {
      const query = connection.runSQL('SELECT 1');
      await attachEntered.promise;
      const close = connection.close();
      resumeAttach.resolve();

      await expect(query).rejects.toThrow(/is closed/);
      await expect(close).resolves.toBeUndefined();
      expect(fs.existsSync(databasePath)).toBe(false);
      expect(physicalTargetBrokerSnapshotForTesting()).toEqual({
        paths: 0,
        inodes: 0,
        owners: 0,
        waiters: 0,
      });
    } finally {
      resumeAttach.resolve();
      attachSpy.mockRestore();
      await connection.close();
    }
  });

  it('quarantines bootstrap native cleanup until a later retry succeeds', async () => {
    const databasePath = path.join(tempRoot, 'bootstrap-close-retry.duckdb');
    const connection = new DuckDBConnection({
      name: 'bootstrap-close-retry',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const createInstance = DuckDBInstance.create.bind(DuckDBInstance);
    let injected = false;
    let stagingCloseSpy: jest.SpyInstance<void, []> | undefined;
    let closeStaging: (() => void) | undefined;
    const createSpy = jest
      .spyOn(DuckDBInstance, 'create')
      .mockImplementation(async (database, options) => {
        const instance = await createInstance(database, options);
        if (!injected && database?.includes('.malloy-duckdb-bootstrap-')) {
          injected = true;
          closeStaging = instance.closeSync.bind(instance);
          stagingCloseSpy = jest
            .spyOn(instance, 'closeSync')
            .mockImplementation(() => {
              throw new Error('injected bootstrap close failure');
            });
        }
        return instance;
      });

    try {
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        /injected bootstrap close failure.*injected bootstrap close failure/
      );
      expect(stagingCloseSpy).toHaveBeenCalledTimes(2);
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 1,
        waiters: 0,
      });
      expect(fs.existsSync(databasePath)).toBe(false);

      stagingCloseSpy?.mockImplementation(closeStaging!);
      await expect(connection.runSQL('SELECT 2 AS v')).resolves.toMatchObject({
        rows: [{v: 2}],
      });
      expect(stagingCloseSpy).toHaveBeenCalledTimes(3);
      expect(fs.existsSync(databasePath)).toBe(true);
    } finally {
      stagingCloseSpy?.mockRestore();
      createSpy.mockRestore();
      await connection.close();
    }
  });

  it('retains the target lease until bootstrap directory cleanup succeeds', async () => {
    const databasePath = path.join(tempRoot, 'bootstrap-rm-retry.duckdb');
    const connection = new DuckDBConnection({
      name: 'bootstrap-rm-retry',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const removeDirectory = fs.rmSync.bind(fs);
    let rejectedBootstrapRemoval = false;
    const rmSpy = jest
      .spyOn(fs, 'rmSync')
      .mockImplementation((target, options) => {
        if (
          !rejectedBootstrapRemoval &&
          String(target).includes('.malloy-duckdb-bootstrap-')
        ) {
          rejectedBootstrapRemoval = true;
          throw new Error('injected bootstrap rm failure');
        }
        removeDirectory(target, options);
      });

    try {
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        'injected bootstrap rm failure'
      );
      expect(fs.existsSync(databasePath)).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 1,
        waiters: 0,
      });
      expect(
        fs
          .readdirSync(tempRoot)
          .filter(name => name.startsWith('.malloy-duckdb-bootstrap-'))
      ).toHaveLength(1);

      await expect(connection.runSQL('SELECT 2 AS v')).resolves.toMatchObject({
        rows: [{v: 2}],
      });
      expect(
        fs
          .readdirSync(tempRoot)
          .filter(name => name.startsWith('.malloy-duckdb-bootstrap-'))
      ).toEqual([]);
    } finally {
      rmSpy.mockImplementation(removeDirectory);
      await connection.close();
      rmSpy.mockRestore();
    }
  });

  it('keeps failed bootstrap directory cleanup retryable through idle', async () => {
    const databasePath = path.join(tempRoot, 'bootstrap-rm-idle.duckdb');
    const connection = new DuckDBConnection({
      name: 'bootstrap-rm-idle',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const removeDirectory = fs.rmSync.bind(fs);
    let bootstrapRemovalAttempts = 0;
    const rmSpy = jest
      .spyOn(fs, 'rmSync')
      .mockImplementation((target, options) => {
        if (
          String(target).includes('.malloy-duckdb-bootstrap-') &&
          bootstrapRemovalAttempts++ < 2
        ) {
          throw new Error(
            `injected bootstrap rm failure ${bootstrapRemovalAttempts}`
          );
        }
        removeDirectory(target, options);
      });

    try {
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        'injected bootstrap rm failure 1'
      );
      await expect(connection.idle()).rejects.toThrow(
        'injected bootstrap rm failure 2'
      );
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 1,
        waiters: 0,
      });

      await expect(connection.idle()).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
      expect(
        fs
          .readdirSync(tempRoot)
          .filter(name => name.startsWith('.malloy-duckdb-bootstrap-'))
      ).toEqual([]);
      await expect(connection.runSQL('SELECT 3 AS v')).resolves.toMatchObject({
        rows: [{v: 3}],
      });
    } finally {
      rmSpy.mockImplementation(removeDirectory);
      await connection.close();
      rmSpy.mockRestore();
    }
  });

  it('retains a shareable primary when connect and immediate close both fail', async () => {
    const primary = await DuckDBInstance.create(':memory:');
    const connectFailure = new Error('injected primary connect failure');
    const connectSpy = jest
      .spyOn(primary, 'connect')
      .mockRejectedValue(connectFailure);
    const closePrimary = primary.closeSync.bind(primary);
    const closeSpy = jest.spyOn(primary, 'closeSync').mockImplementation(() => {
      throw new Error('injected primary close failure');
    });
    const createSpy = jest
      .spyOn(DuckDBInstance, 'create')
      .mockResolvedValueOnce(primary);
    const connection = new DuckDBConnection({
      name: 'primary-init-close-retry',
      databasePath: path.join(tempRoot, 'primary-init-close-retry.duckdb'),
      shareable: true,
    });

    try {
      await connection.connecting;
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        /injected primary connect failure.*injected primary close failure/
      );
      expect(
        (connection as unknown as {ownedInstance: DuckDBInstance | null})
          .ownedInstance
      ).toBe(primary);
      expect(closeSpy).toHaveBeenCalledTimes(1);

      closeSpy.mockImplementation(closePrimary);
      await expect(connection.close()).resolves.toBeUndefined();
      expect(closeSpy).toHaveBeenCalledTimes(2);
    } finally {
      createSpy.mockRestore();
      connectSpy.mockRestore();
      closeSpy.mockImplementation(closePrimary);
      await connection.close();
      closeSpy.mockRestore();
    }
  });

  it('retries a shareable setup after a direct owner closes', async () => {
    const databasePath = path.join(tempRoot, 'direct-conflict.duckdb');
    const direct = new DuckDBConnection({name: 'direct', databasePath});
    const shareable = new DuckDBConnection({
      name: 'shareable',
      databasePath,
      shareable: true,
    });

    try {
      await direct.runSQL('CREATE TABLE owned (v INTEGER)');
      await expect(shareable.runSQL('SELECT * FROM owned')).rejects.toThrow(
        /already owned by non-shareable/
      );
      await direct.close();
      await expect(
        shareable.runSQL('SELECT * FROM owned')
      ).resolves.toMatchObject({rows: []});
    } finally {
      await direct.close();
      await shareable.close();
    }
  });

  it('retries an external DuckDB lock and succeeds after the holder releases it', async () => {
    const databasePath = path.join(tempRoot, 'external-lock-retry.duckdb');
    const bootstrap = await DuckDBInstance.create(databasePath);
    const bootstrapConnection = await bootstrap.connect();
    await bootstrapConnection.run('CREATE TABLE external_owned (v INTEGER)');
    await bootstrapConnection.run('INSERT INTO external_owned VALUES (17)');
    bootstrapConnection.disconnectSync();
    bootstrap.closeSync();

    const child = spawn(
      process.execPath,
      [
        '-e',
        `(async () => {
        const {DuckDBInstance} = require('@duckdb/node-api');
        const instance = await DuckDBInstance.create(${JSON.stringify(databasePath)});
        const connection = await instance.connect();
        if (!process.send) throw new Error('DuckDB lock child has no IPC channel');
        process.send('LOCKED');
        process.once('message', () => {
          connection.disconnectSync();
          instance.closeSync();
          process.send('RELEASED');
        });
      })().catch(error => {
        process.stderr.write(error && error.stack ? error.stack : String(error));
        process.exitCode = 1;
      });`,
      ],
      {stdio: ['ignore', 'pipe', 'pipe', 'ipc']}
    );
    if (!child.stdout || !child.stderr) {
      throw new Error('DuckDB lock child did not expose stdout/stderr pipes');
    }
    const childStdoutPipe = child.stdout;
    const childStderrPipe = child.stderr;
    childStdoutPipe.setEncoding('utf8');
    childStderrPipe.setEncoding('utf8');
    let childStdout = '';
    let childStderr = '';
    let childMessages = '';
    childStdoutPipe.on('data', chunk => {
      childStdout += chunk;
    });
    childStderrPipe.on('data', chunk => {
      childStderr += chunk;
    });
    child.on('message', message => {
      childMessages += `${String(message)}\\n`;
    });
    const childExit = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });

    const connection = shareableConnection(
      tempRoot,
      'external-lock-retry.duckdb'
    );
    const internal = connection as unknown as {
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const conflictObserved = deferred<void>();
    let attachAttempts = 0;
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('ATTACH ')) attachAttempts++;
        try {
          await runCommand(sql);
        } catch (error) {
          if (sql.startsWith('ATTACH ')) conflictObserved.resolve();
          throw error;
        }
      });

    try {
      await waitForText(
        () => childMessages,
        'LOCKED',
        () =>
          `exit=${child.exitCode}; stdout=${childStdout}; stderr=${childStderr}`,
        60_000
      );
      const query = connection.runSQL('SELECT v FROM external_owned');
      const querySettled = trackSettlement(query);
      await Promise.race([
        conflictObserved.promise,
        query.then(
          () => {
            throw new Error(
              'Shareable query completed before observing the external lock conflict'
            );
          },
          error => {
            throw error;
          }
        ),
      ]);
      // The old fixed schedule exhausted all retries in under 0.8s. Keep the
      // external owner alive long enough to prove retry is deadline-based.
      await new Promise<void>(resolve => setTimeout(resolve, 2_000));
      expect(querySettled()).toBe(false);
      child.send('release');
      await expect(childExit).resolves.toBe(0);
      await expect(query).resolves.toMatchObject({rows: [{v: 17}]});
      expect(attachAttempts).toBeGreaterThan(1);
    } finally {
      commandSpy.mockRestore();
      if (child.exitCode === null && child.connected) child.send('release');
      await childExit.catch(() => undefined);
      await connection.close();
    }
  }, 120_000);

  it('aborts a stream waiting in external ATTACH backoff and releases its lease', async () => {
    const databasePath = path.join(tempRoot, 'external-lock-abort.duckdb');
    const bootstrap = await DuckDBInstance.create(databasePath);
    bootstrap.closeSync();
    const connection = new DuckDBConnection({
      name: 'external-lock-abort',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const internal = connection as unknown as {
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const conflictObserved = deferred<void>();
    const conflict = new Error(
      'IO Error: Cannot open file "localized.duckdb": <localized lock error>\n\nFile is already open in node.exe'
    );
    let attachAttempts = 0;
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('ATTACH ')) {
          attachAttempts++;
          conflictObserved.resolve();
          throw conflict;
        }
        await runCommand(sql);
      });
    const abortController = new AbortController();
    const cancellation = new Error('cancel external ATTACH retry');

    try {
      const stream = connection.runSQLStream('SELECT 1', {
        abortSignal: abortController.signal,
      });
      const next = stream.next();
      await conflictObserved.promise;
      abortController.abort(cancellation);

      await expect(next).rejects.toBe(cancellation);
      expect(attachAttempts).toBe(1);
      expect(physicalTargetBrokerSnapshotForTesting()).toEqual({
        paths: 0,
        inodes: 0,
        owners: 0,
        waiters: 0,
      });
    } finally {
      commandSpy.mockRestore();
      await connection.close();
    }
  });

  it('returns a typed error when the external lock deadline expires', async () => {
    const databasePath = path.join(tempRoot, 'external-lock-timeout.duckdb');
    const bootstrap = await DuckDBInstance.create(databasePath);
    bootstrap.closeSync();
    const connection = new DuckDBConnection({
      name: 'external-lock-timeout',
      databasePath,
      shareable: true,
    });
    await connection.connecting;
    const internal = connection as unknown as {
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const conflict = new Error(
      'IO Error: Could not set lock on file because a conflicting lock is held'
    );
    let monotonicTime = 0;
    const clockSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => monotonicTime);
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('ATTACH ')) {
          monotonicTime = 30_001;
          throw conflict;
        }
        await runCommand(sql);
      });

    try {
      const error = await rejectionOf(connection.runSQL('SELECT 1'));
      expect(error).toBeInstanceOf(DuckDBLockTimeoutError);
      expect(error).toMatchObject({
        code: DUCKDB_LOCK_TIMEOUT_CODE,
        cause: conflict,
        attempts: 1,
        elapsedMilliseconds: 30_001,
      });
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 0,
        waiters: 0,
      });
    } finally {
      commandSpy.mockRestore();
      clockSpy.mockRestore();
      await connection.close();
    }
  });

  it('retries a differently configured direct connection after ownership changes', async () => {
    const databasePath = path.join(tempRoot, 'direct-retry.duckdb');
    const first = new DuckDBConnection({name: 'first-direct', databasePath});
    await first.runSQL('CREATE TABLE direct_retry (v INTEGER)');
    const second = new DuckDBConnection({
      name: 'second-direct',
      databasePath,
      threads: 2,
    });

    try {
      await expect(second.runSQL('SELECT * FROM direct_retry')).rejects.toThrow(
        /already owned by non-shareable/
      );
      await first.close();
      await expect(
        second.runSQL('SELECT * FROM direct_retry')
      ).resolves.toMatchObject({rows: []});
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('close actively returns a stream paused at a yielded row', async () => {
    const connection = shareableConnection(tempRoot, 'paused-stream.duckdb');
    try {
      const stream = connection.runSQLStream(
        'SELECT range AS value FROM range(100000)',
        {rowLimit: 100000}
      );
      const first = await stream.next();
      expect(first).toEqual({done: false, value: {value: '0'}});

      await expect(connection.close()).resolves.toBeUndefined();
      await expect(stream.next()).resolves.toEqual({
        done: true,
        value: undefined,
      });
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      await connection.close();
    }
  });

  it('idle actively revokes a stream paused at a yielded row', async () => {
    const connection = shareableConnection(
      tempRoot,
      'paused-stream-idle.duckdb'
    );
    try {
      const stream = connection.runSQLStream(
        'SELECT range AS value FROM range(100000)',
        {rowLimit: 100000}
      );
      await expect(stream.next()).resolves.toEqual({
        done: false,
        value: {value: '0'},
      });

      await expect(connection.idle()).resolves.toBeUndefined();
      await expect(stream.next()).rejects.toThrow(/connection was idled/);
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      await connection.close();
    }
  });

  it('keeps overlapping idle intents until every queued idle reaches the mutex', async () => {
    const connection = shareableConnection(tempRoot, 'overlapping-idle.duckdb');
    await connection.runSQL('SELECT 0');
    const entered = deferred<void>();
    const resume = deferred<void>();
    const internal = connection as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 1 AS active') {
          entered.resolve();
          await resume.promise;
        }
        return runQuery(sql);
      });

    try {
      const active = connection.runSQL('SELECT 1 AS active');
      await entered.promise;
      const firstIdle = connection.idle();
      const stream = connection.runSQLStream('SELECT 2 AS queued_stream', {});
      const queuedNext = stream.next();
      const secondIdle = connection.idle();

      resume.resolve();
      await expect(active).resolves.toMatchObject({rows: [{active: 1}]});
      await expect(firstIdle).resolves.toBeUndefined();
      await expect(queuedNext).rejects.toThrow(/connection was idled/);
      await expect(secondIdle).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      resume.resolve();
      querySpy.mockRestore();
      await connection.close();
    }
  });

  it('revokes a paused stream at a yielded-row safepoint for broker handoff', async () => {
    const databasePath = path.join(tempRoot, 'paused-stream-handoff.duckdb');
    const first = new DuckDBConnection({
      name: 'stream-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'stream-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'stream_waiter_catalog',
    });

    try {
      const stream = first.runSQLStream(
        'SELECT range AS value FROM range(100000)',
        {rowLimit: 100000}
      );
      await expect(stream.next()).resolves.toEqual({
        done: false,
        value: {value: '0'},
      });

      await expect(second.runSQL('SELECT 42 AS v')).resolves.toMatchObject({
        rows: [{v: 42}],
      });
      await expect(stream.next()).rejects.toThrow(
        /revoked at a yielded-row safepoint/
      );
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 1,
        waiters: 0,
      });
    } finally {
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('observes a waiter level before its deferred stream-yield callback', async () => {
    const databasePath = path.join(tempRoot, 'level-stream-handoff.duckdb');
    const first = new DuckDBConnection({
      name: 'level-stream-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'level-stream-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'level_stream_waiter',
    });
    const queuedCallbacks: Array<() => void> = [];
    let queueSpy: jest.SpyInstance | undefined;

    try {
      const stream = first.runSQLStream(
        'SELECT range AS value FROM range(100000)',
        {rowLimit: 100000}
      );
      await expect(stream.next()).resolves.toEqual({
        done: false,
        value: {value: '0'},
      });

      queueSpy = jest
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation(callback => queuedCallbacks.push(callback));
      const peer = second.runSQL('SELECT 42 AS v');
      await waitForBrokerWaiter();

      // requestYield has not run. next() must poll the exact fencing token's
      // level before starting another iterator advancement.
      await expect(stream.next()).rejects.toThrow(/yielded-row safepoint/);
      await expect(peer).resolves.toMatchObject({rows: [{v: 42}]});
    } finally {
      queueSpy?.mockRestore();
      for (const callback of queuedCallbacks) callback();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('does not lose a stream revoke while first ATTACH setup is finishing', async () => {
    const databasePath = path.join(tempRoot, 'stream-setup-window.duckdb');
    const first = new DuckDBConnection({
      name: 'setup-window-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'setup-window-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'setup_window_waiter',
    });
    await Promise.all([
      (first as unknown as {connecting: Promise<void>}).connecting,
      (second as unknown as {connecting: Promise<void>}).connecting,
    ]);
    const setupEntered = deferred<void>();
    const resumeSetup = deferred<void>();
    const internal = first as unknown as {
      useShareableCatalog(catalog: string): Promise<void>;
    };
    const useCatalog = internal.useShareableCatalog.bind(first);
    let blocked = false;
    const useSpy = jest
      .spyOn(internal, 'useShareableCatalog')
      .mockImplementation(async catalog => {
        if (!blocked) {
          blocked = true;
          setupEntered.resolve();
          await resumeSetup.promise;
        }
        await useCatalog(catalog);
      });

    try {
      const stream = first.runSQLStream('SELECT 1 AS value', {});
      const firstRow = stream.next();
      await setupEntered.promise;
      const peer = second.runSQL('SELECT 2 AS peer');
      await waitForBrokerWaiter();

      resumeSetup.resolve();
      await expect(firstRow).resolves.toEqual({
        done: false,
        value: {value: 1},
      });
      await expect(peer).resolves.toMatchObject({rows: [{peer: 2}]});
      await expect(stream.next()).rejects.toThrow(/yielded-row safepoint/);
    } finally {
      resumeSetup.resolve();
      useSpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('rejects concurrent stream advancement so revocation has one safepoint', async () => {
    const connection = shareableConnection(
      tempRoot,
      'concurrent-stream-next.duckdb'
    );
    try {
      const stream = connection.runSQLStream(
        'SELECT range AS value FROM range(100000)',
        {rowLimit: 100000}
      );
      const first = stream.next();
      const concurrent = stream.next();

      await expect(concurrent).rejects.toThrow(/concurrent next\(\) calls/);
      await expect(first).resolves.toEqual({
        done: false,
        value: {value: '0'},
      });
      await expect(stream.return!()).resolves.toEqual({
        done: true,
        value: undefined,
      });
    } finally {
      await connection.close();
    }
  });

  it('treats a broker yield as an admission barrier ahead of local backlog', async () => {
    const databasePath = path.join(tempRoot, 'yield-admission-barrier.duckdb');
    const first = new DuckDBConnection({
      name: 'backlogged-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'physical-target-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'physical_target_waiter',
    });
    await first.runSQL('SELECT 0');
    await (second as unknown as {connecting: Promise<void>}).connecting;
    const entered = deferred<void>();
    const resume = deferred<void>();
    const internal = first as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(first);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 1 AS active') {
          entered.resolve();
          await resume.promise;
        }
        return runQuery(sql);
      });
    const completions: string[] = [];

    try {
      const active = first.runSQL('SELECT 1 AS active');
      await entered.promise;
      const backlog = first.runSQL('SELECT 2 AS backlog').then(result => {
        completions.push('backlog');
        return result;
      });
      const waiter = second.runSQL('SELECT 3 AS waiter').then(result => {
        completions.push('waiter');
        return result;
      });

      await waitForBrokerWaiter();
      resume.resolve();
      await expect(active).resolves.toMatchObject({rows: [{active: 1}]});
      await expect(waiter).resolves.toMatchObject({rows: [{waiter: 3}]});
      await expect(backlog).resolves.toMatchObject({rows: [{backlog: 2}]});
      expect(completions).toEqual(['waiter', 'backlog']);
    } finally {
      resume.resolve();
      querySpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('observes a waiter level before its deferred backlog-yield callback', async () => {
    const databasePath = path.join(tempRoot, 'level-backlog-handoff.duckdb');
    const first = new DuckDBConnection({
      name: 'level-backlog-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'level-backlog-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'level_backlog_waiter',
    });
    await first.runSQL('SELECT 0');
    await (second as unknown as {connecting: Promise<void>}).connecting;
    const entered = deferred<void>();
    const resume = deferred<void>();
    const internal = first as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(first);
    let backlogStarted = false;
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 1 AS active') {
          entered.resolve();
          await resume.promise;
        }
        if (sql === 'SELECT 2 AS backlog') backlogStarted = true;
        return runQuery(sql);
      });
    const queuedCallbacks: Array<() => void> = [];
    let queueSpy: jest.SpyInstance | undefined;

    try {
      const active = first.runSQL('SELECT 1 AS active');
      await entered.promise;
      const backlog = first.runSQL('SELECT 2 AS backlog');
      queueSpy = jest
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation(callback => queuedCallbacks.push(callback));
      const peer = second.runSQL('SELECT 3 AS peer');
      await waitForBrokerWaiter();

      resume.resolve();
      await expect(active).resolves.toMatchObject({rows: [{active: 1}]});
      await expect(peer).resolves.toMatchObject({rows: [{peer: 3}]});
      expect(backlogStarted).toBe(false);

      queueSpy.mockRestore();
      queueSpy = undefined;
      while (queuedCallbacks.length > 0) queuedCallbacks.shift()?.();
      await expect(backlog).resolves.toMatchObject({rows: [{backlog: 2}]});
    } finally {
      resume.resolve();
      queueSpy?.mockRestore();
      for (const callback of queuedCallbacks) callback();
      querySpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('does not carry a stale revoke intent into a queued stream', async () => {
    const databasePath = path.join(tempRoot, 'queued-stream-handoff.duckdb');
    const first = new DuckDBConnection({
      name: 'active-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'waiting-peer',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'waiting_peer',
    });
    await first.runSQL('SELECT 0');
    await (second as unknown as {connecting: Promise<void>}).connecting;
    const entered = deferred<void>();
    const resume = deferred<void>();
    const internal = first as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(first);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 1 AS active') {
          entered.resolve();
          await resume.promise;
        }
        return runQuery(sql);
      });

    try {
      const active = first.runSQL('SELECT 1 AS active');
      await entered.promise;
      const queuedStream = first.runSQLStream('SELECT 2 AS queued_stream', {});
      const queuedNext = queuedStream.next();
      const peer = second.runSQL('SELECT 3 AS peer');

      await waitForBrokerWaiter();
      resume.resolve();
      await expect(active).resolves.toMatchObject({rows: [{active: 1}]});
      await expect(peer).resolves.toMatchObject({rows: [{peer: 3}]});
      await expect(queuedNext).resolves.toEqual({
        done: false,
        value: {queued_stream: 2},
      });
      await expect(queuedStream.return!()).resolves.toEqual({
        done: true,
        value: undefined,
      });
    } finally {
      resume.resolve();
      querySpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('aborting a queued stream does not interrupt the active operation', async () => {
    const connection = shareableConnection(
      tempRoot,
      'queued-stream-abort.duckdb'
    );
    await connection.runSQL('SELECT 1');
    const entered = deferred<void>();
    const resume = deferred<void>();
    const internal = connection as unknown as {
      connection: {interrupt(): void};
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 42 AS v') {
          entered.resolve();
          await resume.promise;
        }
        return runQuery(sql);
      });
    const interruptSpy = jest.spyOn(internal.connection, 'interrupt');

    try {
      const active = connection.runSQL('SELECT 42 AS v');
      await entered.promise;

      const abortController = new AbortController();
      const queued = connection.runSQLStream('SELECT 99 AS v', {
        abortSignal: abortController.signal,
      });
      const queuedNext = queued.next();
      await flushMicrotasks();
      abortController.abort(new Error('cancel queued stream'));

      await expect(queuedNext).rejects.toThrow('cancel queued stream');
      expect(interruptSpy).not.toHaveBeenCalled();
      resume.resolve();
      await expect(active).resolves.toMatchObject({rows: [{v: 42}]});
    } finally {
      resume.resolve();
      interruptSpy.mockRestore();
      querySpy.mockRestore();
      await connection.close();
    }
  });

  it('close removes a connection waiting for a broker lease', async () => {
    const databasePath = path.join(tempRoot, 'close-broker-waiter.duckdb');
    const first = new DuckDBConnection({
      name: 'close-waiter-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'close-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'close_waiter',
    });
    await first.runSQL('SELECT 1');
    const queryEntered = deferred<void>();
    const resumeQuery = deferred<void>();
    const internal = first as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(first);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql === 'SELECT 42 AS held') {
          queryEntered.resolve();
          await resumeQuery.promise;
        }
        return runQuery(sql);
      });

    try {
      const held = first.runSQL('SELECT 42 AS held');
      await queryEntered.promise;
      const query = second.runSQL('SELECT 2 AS value');
      await waitForBrokerWaiter();
      const close = second.close();

      await expect(query).rejects.toThrow(/is closed/);
      await expect(close).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 1,
        waiters: 0,
      });
      resumeQuery.resolve();
      await expect(held).resolves.toMatchObject({
        rows: [{held: 42}],
      });
      await expect(first.runSQL('SELECT 3 AS value')).resolves.toMatchObject({
        rows: [{value: 3}],
      });
    } finally {
      resumeQuery.resolve();
      querySpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('aborting a stream paused at a row releases its lifecycle and target leases', async () => {
    const connection = shareableConnection(
      tempRoot,
      'paused-stream-abort.duckdb'
    );
    const abortController = new AbortController();
    try {
      const stream = connection.runSQLStream(
        'SELECT range AS value FROM range(100000)',
        {rowLimit: 100000, abortSignal: abortController.signal}
      );
      await expect(stream.next()).resolves.toEqual({
        done: false,
        value: {value: '0'},
      });

      abortController.abort(new Error('consumer abandoned stream'));
      await expect(connection.idle()).resolves.toBeUndefined();
      await expect(stream.next()).resolves.toEqual({
        done: true,
        value: undefined,
      });
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      await connection.close();
    }
  });

  it('releases its target lease when catalog discovery fails before ATTACH', async () => {
    const connection = shareableConnection(
      tempRoot,
      'pre-attach-failure.duckdb'
    );
    const internal = connection as unknown as {
      connecting: Promise<void>;
      readDuckDBCatalogsByOID(): Promise<Map<string, string>>;
    };
    await internal.connecting;
    const readCatalogs = internal.readDuckDBCatalogsByOID.bind(connection);
    const catalogsSpy = jest
      .spyOn(internal, 'readDuckDBCatalogsByOID')
      .mockRejectedValueOnce(new Error('injected pre-ATTACH catalog failure'));

    try {
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        'injected pre-ATTACH catalog failure'
      );
      expect(physicalTargetBrokerSnapshotForTesting()).toMatchObject({
        owners: 0,
        waiters: 0,
      });

      catalogsSpy.mockImplementation(readCatalogs);
      await expect(connection.runSQL('SELECT 2 AS v')).resolves.toMatchObject({
        rows: [{v: 2}],
      });
    } finally {
      catalogsSpy.mockRestore();
      await connection.close();
    }
  });

  it('allows dependent multi-statement SQL but rejects lifecycle escape hatches', async () => {
    const connection = shareableConnection(tempRoot, 'sql-fence.duckdb');
    try {
      await connection.runRawSQL(
        'CREATE TABLE multi (v INTEGER); INSERT INTO multi VALUES (9)'
      );
      await expect(
        connection.runSQL('SELECT v FROM multi')
      ).resolves.toMatchObject({rows: [{v: 9}]});
      await expect(
        connection.runRawSQL("SELECT 'DETACH hidden' AS text")
      ).resolves.toMatchObject({rows: [{text: 'DETACH hidden'}]});

      for (const sql of [
        '/* leading comment */ BEGIN TRANSACTION',
        'SELECT 1; DETACH "sql-fence"',
        'PREPARE persistent_plan AS SELECT * FROM multi',
        'EXPLAIN ANALYZE BEGIN TRANSACTION',
        'EXPLAIN /* modifier comment */ ANALYZE BEGIN TRANSACTION',
        'EXPLAIN (FORMAT JSON, ANALYZE false) BEGIN TRANSACTION',
      ]) {
        const error = await rejectionOf(connection.runRawSQL(sql));
        expect(error).toBeInstanceOf(DuckDBShareableUnsupportedSQLError);
        expect(error).toMatchObject({
          code: DUCKDB_SHAREABLE_UNSUPPORTED_SQL_CODE,
        });
        expect((error as Error).message).toMatch(/do not allow/);
      }
      await expect(
        connection.runRawSQL("EXPLAIN SELECT 'ANALYZE' AS harmless")
      ).resolves.toMatchObject({totalRows: expect.any(Number)});
      const native = (
        connection as unknown as {
          connection: {
            extractStatements(sql: string): Promise<{count: number}>;
          };
        }
      ).connection;
      const extractionSpy = jest
        .spyOn(native, 'extractStatements')
        .mockResolvedValue({count: 2});
      try {
        const error = await rejectionOf(connection.runRawSQL('SELECT 1'));
        expect(error).toBeInstanceOf(DuckDBShareableUnsupportedSQLError);
        expect(error).toMatchObject({
          code: DUCKDB_SHAREABLE_UNSUPPORTED_SQL_CODE,
        });
        expect((error as Error).message).toMatch(/classified safely/);
      } finally {
        extractionSpy.mockRestore();
      }
      await expect(
        connection.runSQLWithTemporaryTable!(
          "SELECT 1); ATTACH ':memory:' AS escaped; --",
          tableName => `SELECT * FROM ${tableName}`
        )
      ).rejects.toThrow();

      const consumerError = await rejectionOf(
        connection.runSQLWithTemporaryTable!(
          'SELECT * FROM multi',
          tableName => `ALTER TABLE ${tableName} RENAME TO escaped`
        )
      );
      expect(consumerError).toBeInstanceOf(DuckDBShareableUnsupportedSQLError);
      expect(consumerError).toMatchObject({
        code: DUCKDB_SHAREABLE_UNSUPPORTED_SQL_CODE,
      });
      expect((consumerError as Error).message).toMatch(/read-only SELECT/);
      await expect(
        connection.runSQL(
          "SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name='escaped'"
        )
      ).resolves.toMatchObject({rows: [{n: 0}]});
    } finally {
      await connection.close();
    }
  });

  it('versions manifest snapshots across handoff and scopes atomic TEMP names', async () => {
    const databasePath = path.join(tempRoot, 'generation-cache.duckdb');
    const connection = new DuckDBConnection({
      name: 'generation',
      databasePath,
      shareable: true,
    });
    let externalInstance: DuckDBInstance | undefined;
    try {
      expect(connection.runSQLWithTemporaryTable).toEqual(expect.any(Function));
      await connection.runRawSQL(
        'CREATE TABLE changing (x INTEGER); INSERT INTO changing VALUES (1)'
      );
      const firstSchema = await connection.fetchSchemaForTables(
        {changing: 'changing'},
        {}
      );
      expect(
        firstSchema.schemas['changing'].fields.map(field => field.name)
      ).toEqual(['x']);
      const legacyName = await connection.manifestTemporaryTable(
        'SELECT * FROM changing'
      );
      const scopedNames: string[] = [];
      await Promise.all([
        connection.runSQLWithTemporaryTable!(
          'SELECT * FROM changing',
          tableName => {
            scopedNames.push(tableName);
            return `SELECT * FROM ${tableName}`;
          }
        ),
        connection.runSQLWithTemporaryTable!(
          'SELECT * FROM changing',
          tableName => {
            scopedNames.push(tableName);
            return `SELECT * FROM ${tableName}`;
          }
        ),
      ]);
      expect(new Set(scopedNames).size).toBe(2);
      expect(scopedNames.every(name => /^tts/.test(name))).toBe(true);
      expect(scopedNames).not.toContain(legacyName);
      expect(
        (connection as unknown as {manifestTemporaryTables: Set<string>})
          .manifestTemporaryTables
      ).toEqual(new Set([legacyName]));
      await expect(
        connection.runSQL(`SELECT * FROM ${legacyName}`)
      ).resolves.toMatchObject({rows: [{x: 1}]});

      await connection.idle();
      externalInstance = await DuckDBInstance.create(databasePath);
      const externalConnection = await externalInstance.connect();
      try {
        await externalConnection.run(
          "ALTER TABLE changing ADD COLUMN y VARCHAR DEFAULT 'after'"
        );
      } finally {
        externalConnection.disconnectSync();
        externalInstance.closeSync();
        externalInstance = undefined;
      }

      const secondSchema = await connection.fetchSchemaForTables(
        {changing: 'changing'},
        {}
      );
      expect(
        secondSchema.schemas['changing'].fields.map(field => field.name)
      ).toEqual(['x', 'y']);
      await expect(
        connection.runSQL(`SELECT * FROM ${legacyName}`)
      ).resolves.toMatchObject({rows: [{x: 1}]});
      const freshName = await connection.manifestTemporaryTable(
        'SELECT * FROM changing'
      );
      expect(freshName).not.toBe(legacyName);
      await expect(
        connection.runSQL(`SELECT * FROM ${freshName}`)
      ).resolves.toMatchObject({rows: [{x: 1, y: 'after'}]});
      await expect(
        connection.runSQLWithTemporaryTable!(
          'SELECT * FROM changing',
          tableName => `SELECT * FROM ${tableName}`
        )
      ).resolves.toMatchObject({rows: [{x: 1, y: 'after'}]});
    } finally {
      externalInstance?.closeSync();
      await connection.close();
    }
  });

  it('reuses generation-cached TEMP snapshots and refreshes them after handoff', async () => {
    const databasePath = path.join(
      tempRoot,
      'generation-cached-search-index.duckdb'
    );
    const connection = new DuckDBConnection({
      name: 'generation-cache',
      databasePath,
      shareable: true,
    });
    const internal = connection as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
      manifestTemporaryTables: Set<string>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    const materializedNames: string[] = [];
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        const create =
          /^CREATE OR REPLACE TEMPORARY TABLE (ttc\w+) AS/.exec(sql);
        if (create) materializedNames.push(create[1]);
        return runQuery(sql);
      });
    let externalInstance: DuckDBInstance | undefined;

    const readCached = () =>
      connection.runSQLWithTemporaryTable!(
        'SELECT value FROM changing ORDER BY value',
        tableName => `SELECT * FROM ${tableName} ORDER BY value`,
        {temporaryTableCache: 'connection-generation'}
      );

    try {
      await connection.runRawSQL(
        'CREATE TABLE changing (value INTEGER); INSERT INTO changing VALUES (1)'
      );
      await expect(readCached()).resolves.toMatchObject({rows: [{value: 1}]});
      await expect(readCached()).resolves.toMatchObject({rows: [{value: 1}]});
      expect(materializedNames).toHaveLength(1);
      expect(internal.manifestTemporaryTables).toEqual(
        new Set(materializedNames)
      );

      await connection.idle();
      externalInstance = await DuckDBInstance.create(databasePath);
      const externalConnection = await externalInstance.connect();
      try {
        await externalConnection.run('INSERT INTO changing VALUES (2)');
      } finally {
        externalConnection.disconnectSync();
        externalInstance.closeSync();
        externalInstance = undefined;
      }

      await expect(readCached()).resolves.toMatchObject({
        rows: [{value: 1}, {value: 2}],
      });
      expect(materializedNames).toHaveLength(2);
      expect(new Set(materializedNames).size).toBe(1);
      expect(internal.manifestTemporaryTables.size).toBe(1);
    } finally {
      externalInstance?.closeSync();
      querySpy.mockRestore();
      await connection.close();
    }
  });

  it('keeps manifest TEMP creation and consumption atomic against handoff', async () => {
    const databasePath = path.join(tempRoot, 'manifest-atomic-handoff.duckdb');
    const first = new DuckDBConnection({
      name: 'manifest-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'manifest-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'manifest_waiter',
    });
    await first.runRawSQL(
      'CREATE TABLE source_data (v INTEGER); INSERT INTO source_data VALUES (7)'
    );
    await (second as unknown as {connecting: Promise<void>}).connecting;
    const consumerEntered = deferred<void>();
    const resumeConsumer = deferred<void>();
    const internal = first as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(first);
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (/^SELECT \* FROM tt/.test(sql)) {
          consumerEntered.resolve();
          await resumeConsumer.promise;
        }
        return runQuery(sql);
      });

    try {
      const manifestConsumer = first.runSQLWithTemporaryTable!(
        'SELECT * FROM source_data',
        tableName => `SELECT * FROM ${tableName}`
      );
      await consumerEntered.promise;
      const peer = second.runSQL('SELECT 9 AS peer');
      const peerSettled = trackSettlement(peer);
      await waitForBrokerWaiter();
      await flushMicrotasks();
      expect(peerSettled()).toBe(false);

      resumeConsumer.resolve();
      await expect(manifestConsumer).resolves.toMatchObject({rows: [{v: 7}]});
      await expect(peer).resolves.toMatchObject({rows: [{peer: 9}]});
    } finally {
      resumeConsumer.resolve();
      querySpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('drops a unique scoped TEMP snapshot when its consumer fails', async () => {
    const connection = shareableConnection(
      tempRoot,
      'manifest-consumer-failure.duckdb'
    );
    const internal = connection as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
      manifestTemporaryTables: Set<string>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    let dropAttempts = 0;
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (/^SELECT \* FROM tts/.test(sql)) {
          throw new Error('injected scoped consumer failure');
        }
        if (sql.startsWith('DROP TABLE')) dropAttempts++;
        return runQuery(sql);
      });

    try {
      await expect(
        connection.runSQLWithTemporaryTable!(
          'SELECT 1 AS v',
          tableName => `SELECT * FROM ${tableName}`
        )
      ).rejects.toThrow('injected scoped consumer failure');
      expect(dropAttempts).toBe(1);
      expect(internal.manifestTemporaryTables.size).toBe(0);
    } finally {
      querySpy.mockRestore();
      await connection.close();
    }
  });

  it('drops scoped TEMP when result handling fails after CREATE succeeds', async () => {
    const connection = shareableConnection(
      tempRoot,
      'post-create-result-failure.duckdb'
    );
    await connection.connecting;
    const internal = connection as unknown as {
      manifestTemporaryTables: Set<string>;
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    let createdTable: string | undefined;
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        const create = /^CREATE TEMPORARY TABLE IF NOT EXISTS (\w+)/.exec(sql);
        if (create) {
          createdTable = create[1];
          await runQuery(sql);
          throw new Error('injected post-CREATE result failure');
        }
        return runQuery(sql);
      });

    try {
      await expect(
        connection.runSQLWithTemporaryTable!(
          'SELECT 1 AS value',
          tableName => `SELECT * FROM ${tableName}`
        )
      ).rejects.toThrow('injected post-CREATE result failure');
      expect(createdTable).toBeDefined();
      expect(internal.manifestTemporaryTables.size).toBe(0);
      await expect(
        connection.runSQL(
          `SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name='${createdTable}'`
        )
      ).resolves.toMatchObject({rows: [{n: 0}]});
    } finally {
      querySpy.mockRestore();
      await connection.close();
    }
  });

  it('retains failed scoped TEMP cleanup until terminal close without pinning the file', async () => {
    const connection = shareableConnection(
      tempRoot,
      'manifest-cleanup-failure.duckdb'
    );
    const internal = connection as unknown as {
      runDuckDBQuery(sql: string): Promise<{
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      }>;
      manifestTemporaryTables: Set<string>;
    };
    const runQuery = internal.runDuckDBQuery.bind(connection);
    let dropAttempts = 0;
    const querySpy = jest
      .spyOn(internal, 'runDuckDBQuery')
      .mockImplementation(async sql => {
        if (sql.startsWith('DROP TABLE')) {
          dropAttempts++;
          throw new Error('injected TEMP cleanup failure');
        }
        return runQuery(sql);
      });

    try {
      await expect(
        connection.runSQLWithTemporaryTable!(
          'SELECT 1 AS v',
          tableName => `SELECT * FROM ${tableName}`
        )
      ).rejects.toThrow('injected TEMP cleanup failure');
      expect(dropAttempts).toBe(1);
      expect(internal.manifestTemporaryTables.size).toBe(1);

      await expect(connection.idle()).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
      await expect(connection.runSQL('SELECT 2 AS v')).resolves.toMatchObject({
        rows: [{v: 2}],
      });

      querySpy.mockRestore();
      await expect(connection.close()).resolves.toBeUndefined();
      expect(internal.manifestTemporaryTables.size).toBe(0);
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(/is closed/);
    } finally {
      querySpy.mockRestore();
      await connection.close();
    }
  });

  it('uses database_oid, not a catalog name, as the DETACH postcondition', async () => {
    const connection = shareableConnection(
      tempRoot,
      'oid-postcondition.duckdb'
    );
    await connection.runSQL('SELECT 1');
    const internal = connection as unknown as {
      shareableAttachment: {status: 'attached'; catalog: string; oid: string};
      runDuckDBCommand(sql: string): Promise<void>;
      tryReadDuckDBCatalogsByOID(): Promise<Map<string, string> | undefined>;
    };
    const {oid} = internal.shareableAttachment;
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('DETACH ')) {
          throw new Error('injected DETACH failure');
        }
        await runCommand(sql);
      });
    const catalogsSpy = jest
      .spyOn(internal, 'tryReadDuckDBCatalogsByOID')
      .mockResolvedValue(new Map([[oid, 'renamed_catalog']]));

    try {
      await expect(connection.idle()).rejects.toThrow(
        'injected DETACH failure'
      );
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);
    } finally {
      catalogsSpy.mockRestore();
      commandSpy.mockRestore();
      await connection.close();
    }
  });

  it('quarantines a failed direct disconnect until close retry succeeds', async () => {
    const connection = new DuckDBConnection({
      name: 'direct-close-retry',
      databasePath: path.join(tempRoot, 'direct-close-retry.duckdb'),
    });
    await connection.runSQL('SELECT 1');
    const native = (
      connection as unknown as {connection: {disconnectSync(): void}}
    ).connection;
    const disconnect = native.disconnectSync.bind(native);
    const disconnectSpy = jest
      .spyOn(native, 'disconnectSync')
      .mockImplementationOnce(() => {
        throw new Error('injected disconnect failure');
      });

    await expect(connection.close()).rejects.toThrow(
      'injected disconnect failure'
    );
    expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);

    disconnectSpy.mockImplementation(disconnect);
    await expect(connection.idle()).resolves.toBeUndefined();
    expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    await expect(connection.close()).resolves.toBeUndefined();
    disconnectSpy.mockRestore();
  });

  it('retains a shareable fence when terminal native cleanup fails', async () => {
    const connection = shareableConnection(
      tempRoot,
      'shareable-close-retry.duckdb'
    );
    await connection.runSQL('SELECT 1');
    const internal = connection as unknown as {
      connection: {disconnectSync(): void};
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('DETACH ')) {
          throw new Error('injected DETACH failure');
        }
        await runCommand(sql);
      });
    const disconnect = internal.connection.disconnectSync.bind(
      internal.connection
    );
    const disconnectSpy = jest
      .spyOn(internal.connection, 'disconnectSync')
      .mockImplementationOnce(() => {
        throw new Error('injected native cleanup failure');
      });

    try {
      await expect(connection.close()).rejects.toThrow(
        /injected DETACH failure.*injected native cleanup failure/
      );
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);

      commandSpy.mockImplementation(runCommand);
      disconnectSpy.mockImplementation(disconnect);
      await expect(connection.close()).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      commandSpy.mockRestore();
      disconnectSpy.mockRestore();
      await connection.close();
    }
  });

  it('fast-rejects waiters and retries a quarantined broker-yield cleanup', async () => {
    const databasePath = path.join(
      tempRoot,
      'shareable-yield-cleanup-retry.duckdb'
    );
    const first = new DuckDBConnection({
      name: 'failing-yield-owner',
      databasePath,
      shareable: true,
    });
    const second = new DuckDBConnection({
      name: 'yield-cleanup-waiter',
      databasePath,
      shareable: true,
      shareableAttachAlias: 'yield_cleanup_waiter',
    });
    await first.runSQL('SELECT 1');
    await (second as unknown as {connecting: Promise<void>}).connecting;
    const internal = first as unknown as {
      connection: {disconnectSync(): void};
      ownedInstance: {closeSync(): void};
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(first);
    let detachFailed = false;
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('DETACH ')) {
          detachFailed = true;
          throw new Error('injected broker DETACH failure');
        }
        if (
          detachFailed &&
          sql.startsWith('USE ') &&
          !sql.includes('"memory"."main"')
        ) {
          throw new Error('injected broker restore failure');
        }
        await runCommand(sql);
      });
    const disconnect = internal.connection.disconnectSync.bind(
      internal.connection
    );
    const closeInstance = internal.ownedInstance.closeSync.bind(
      internal.ownedInstance
    );
    const disconnectSpy = jest
      .spyOn(internal.connection, 'disconnectSync')
      .mockImplementation(() => {
        throw new Error('injected broker disconnect failure');
      });
    const closeInstanceSpy = jest
      .spyOn(internal.ownedInstance, 'closeSync')
      .mockImplementation(() => {
        throw new Error('injected broker instance-close failure');
      });

    try {
      await expect(second.runSQL('SELECT 2 AS first_waiter')).rejects.toThrow(
        /could not yield the physical database safely/
      );
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);

      commandSpy.mockImplementation(runCommand);
      disconnectSpy.mockImplementation(disconnect);
      closeInstanceSpy.mockImplementation(closeInstance);

      await expect(second.runSQL('SELECT 3 AS retry_waiter')).rejects.toThrow(
        /awaiting retry of terminal native cleanup/
      );
      await waitForBrokerRelease();
      expect(disconnectSpy).toHaveBeenCalledTimes(2);
      expect(closeInstanceSpy).toHaveBeenCalledTimes(2);
      await expect(second.runSQL('SELECT 4 AS v')).resolves.toMatchObject({
        rows: [{v: 4}],
      });
    } finally {
      commandSpy.mockRestore();
      disconnectSpy.mockRestore();
      closeInstanceSpy.mockRestore();
      await Promise.all([first.close(), second.close()]);
    }
  });

  it('retains a shareable fence when its native instance close fails', async () => {
    const connection = shareableConnection(
      tempRoot,
      'shareable-instance-close-retry.duckdb'
    );
    await connection.runSQL('SELECT 1');
    const internal = connection as unknown as {
      ownedInstance: {closeSync(): void};
      runDuckDBCommand(sql: string): Promise<void>;
    };
    const runCommand = internal.runDuckDBCommand.bind(connection);
    const commandSpy = jest
      .spyOn(internal, 'runDuckDBCommand')
      .mockImplementation(async sql => {
        if (sql.startsWith('DETACH ')) {
          throw new Error('injected DETACH failure');
        }
        await runCommand(sql);
      });
    const closeInstance = internal.ownedInstance.closeSync.bind(
      internal.ownedInstance
    );
    const closeInstanceSpy = jest
      .spyOn(internal.ownedInstance, 'closeSync')
      .mockImplementationOnce(() => {
        throw new Error('injected instance close failure');
      });

    try {
      await expect(connection.close()).rejects.toThrow(
        /injected DETACH failure.*injected instance close failure/
      );
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);

      commandSpy.mockImplementation(runCommand);
      closeInstanceSpy.mockImplementation(closeInstance);
      await expect(connection.close()).resolves.toBeUndefined();
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(0);
    } finally {
      commandSpy.mockRestore();
      closeInstanceSpy.mockRestore();
      await connection.close();
    }
  });
});

function shareableConnection(
  tempRoot: string,
  filename: string
): DuckDBConnection {
  return new DuckDBConnection({
    name: filename,
    databasePath: path.join(tempRoot, filename),
    shareable: true,
  });
}

async function rejectionOf(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error('Expected operation to reject');
}

async function waitForText(
  readOutput: () => string,
  expected: string,
  readDiagnostics: () => string,
  timeoutMilliseconds = 10_000
): Promise<void> {
  const deadline = performance.now() + timeoutMilliseconds;
  while (performance.now() < deadline) {
    if (readOutput().includes(expected)) return;
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  }
  throw new Error(
    `Timed out waiting for child output ${JSON.stringify(expected)}: ${readDiagnostics()}`
  );
}
