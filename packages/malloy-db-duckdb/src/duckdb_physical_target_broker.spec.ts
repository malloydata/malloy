/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {Worker} from 'worker_threads';
import * as ts from 'typescript';
import {
  acquireDuckDBPhysicalTarget,
  DuckDBAtomicPublicationUnavailableError,
  DuckDBTargetChangedError,
  DuckDBTargetMissingError,
  DuckDBUnsafeFileIdentityError,
  DuckDBUnsafeFilesystemError,
  physicalTargetBrokerSnapshotForTesting,
} from './duckdb_physical_target_broker';
import type {
  DuckDBPhysicalTargetLease,
  DuckDBTargetOwner,
} from './duckdb_physical_target_broker';

describe('DuckDB physical-target broker', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'malloy-duckdb-target-broker-')
    );
  });

  afterEach(() => {
    const snapshot = physicalTargetBrokerSnapshotForTesting();
    fs.rmSync(tempRoot, {recursive: true, force: true});
    expect(snapshot).toEqual({paths: 0, inodes: 0, owners: 0, waiters: 0});
  });

  it('rejects shareable acquisition in a real worker realm', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'duckdb_physical_target_broker.ts'),
      'utf8'
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const worker = new Worker(
      `const {parentPort, workerData} = require('worker_threads');
       const loaded = {exports: {}};
       new Function('require', 'module', 'exports', workerData.compiled)(
         require,
         loaded,
         loaded.exports
       );
       Promise.resolve()
         .then(() => loaded.exports.acquireDuckDBPhysicalTarget(
           workerData.databasePath,
           {identity: {}, mode: 'shareable', description: 'real worker'}
         ))
         .then(
           () => parentPort.postMessage({ok: false}),
           error => parentPort.postMessage({
             ok: true,
             name: error.name,
             code: error.code,
             message: error.message,
           })
         );`,
      {
        eval: true,
        workerData: {
          compiled,
          databasePath: path.join(tempRoot, 'real-worker.duckdb'),
        },
      }
    );

    try {
      const result = await new Promise<{
        ok: boolean;
        name?: string;
        code?: string;
        message?: string;
      }>((resolve, reject) => {
        let receivedMessage = false;
        const timeout = setTimeout(
          () => reject(new Error('Worker did not report its realm result')),
          5_000
        );
        worker.once('message', value => {
          receivedMessage = true;
          clearTimeout(timeout);
          resolve(value);
        });
        worker.once('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
        worker.once('exit', code => {
          if (!receivedMessage) {
            clearTimeout(timeout);
            reject(
              new Error(`Worker exited with code ${code} before reporting`)
            );
          }
        });
      });

      expect(result).toMatchObject({
        ok: true,
        name: 'DuckDBUnsafeExecutionRealmError',
        code: 'MALLOY_DUCKDB_UNSAFE_EXECUTION_REALM',
      });
      expect(result.message).toContain('cannot run in a Node worker thread');
      expect(fs.existsSync(path.join(tempRoot, 'real-worker.duckdb'))).toBe(
        false
      );
    } finally {
      await worker.terminate();
    }
  }, 10_000);

  it('grants one target to waiters in FIFO order', async () => {
    const databasePath = createTarget(tempRoot, 'fifo.duckdb');
    const events: string[] = [];
    let first: DuckDBPhysicalTargetLease | undefined;
    let second: DuckDBPhysicalTargetLease | undefined;
    let third: DuckDBPhysicalTargetLease | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('first', () => events.push('yield:first'))
      );
      const secondPromise = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('second')
      ).then(lease => {
        events.push('grant:second');
        return lease;
      });
      const thirdPromise = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('third')
      ).then(lease => {
        events.push('grant:third');
        return lease;
      });

      await flushMicrotasks();
      expect(events).toEqual(['yield:first']);
      expect(physicalTargetBrokerSnapshotForTesting()).toEqual({
        paths: 1,
        inodes: 1,
        owners: 1,
        waiters: 2,
      });

      first.release();
      second = await secondPromise;
      expect(events).toEqual(['yield:first', 'grant:second']);
      expect(physicalTargetBrokerSnapshotForTesting().waiters).toBe(1);

      // A stale, already-released fencing token must not release its successor.
      first.release();
      expect(second.isHeld).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting().waiters).toBe(1);

      second.release();
      third = await thirdPromise;
      expect(events).toEqual(['yield:first', 'grant:second', 'grant:third']);
      expect(third.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
      if (second?.isHeld) second.release();
      if (third?.isHeld) third.release();
    }
  });

  it('cooperatively asks a shareable owner to yield', async () => {
    const databasePath = createTarget(tempRoot, 'cooperative.duckdb');
    const events: string[] = [];
    let first: DuckDBPhysicalTargetLease | undefined;
    let second: DuckDBPhysicalTargetLease | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('first', () => {
          events.push('yield:first');
          first?.release();
        })
      );

      second = await acquireDuckDBPhysicalTarget(databasePath, owner('second'));

      expect(events).toEqual(['yield:first']);
      expect(first.isHeld).toBe(false);
      expect(second.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
      if (second?.isHeld) second.release();
    }
  });

  it('grants different physical targets independently', async () => {
    const firstPath = createTarget(tempRoot, 'first.duckdb');
    const secondPath = createTarget(tempRoot, 'second.duckdb');
    let first: DuckDBPhysicalTargetLease | undefined;
    let second: DuckDBPhysicalTargetLease | undefined;

    try {
      [first, second] = await Promise.all([
        acquireDuckDBPhysicalTarget(firstPath, owner('first')),
        acquireDuckDBPhysicalTarget(secondPath, owner('second')),
      ]);

      expect(first.isHeld).toBe(true);
      expect(second.isHeld).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting()).toEqual({
        paths: 2,
        inodes: 2,
        owners: 2,
        waiters: 0,
      });
    } finally {
      if (first?.isHeld) first.release();
      if (second?.isHeld) second.release();
    }
  });

  it('rejects a multiply-linked physical target', () => {
    const databasePath = createTarget(tempRoot, 'hardlink-source.duckdb');
    fs.linkSync(databasePath, path.join(tempRoot, 'hardlink-alias.duckdb'));

    expect(() =>
      acquireDuckDBPhysicalTarget(databasePath, owner('hardlink-owner'))
    ).toThrow(DuckDBUnsafeFileIdentityError);
    expect(() =>
      acquireDuckDBPhysicalTarget(databasePath, owner('hardlink-owner'))
    ).toThrow(/has 2 hard links/);
    expect(() =>
      acquireDuckDBPhysicalTarget(databasePath, {
        ...owner('best-effort hardlink owner'),
        shareableLockSafety: 'best-effort',
      })
    ).toThrow(DuckDBUnsafeFileIdentityError);
  });

  it('fails closed when the path is replaced before native open', async () => {
    const databasePath = createTarget(tempRoot, 'replace-before-open.duckdb');
    const displacedPath = path.join(tempRoot, 'displaced-before-open.duckdb');
    let lease: DuckDBPhysicalTargetLease | undefined;

    try {
      lease = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('replace-before-open')
      );
      fs.renameSync(databasePath, displacedPath);
      fs.writeFileSync(databasePath, 'replacement');

      expect(() => lease!.assertSafeBeforeOpen()).toThrow(
        DuckDBTargetChangedError
      );
      expect(lease.isHeld).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);
    } finally {
      if (lease?.isHeld) lease.release();
    }
  });

  it('atomically publishes a prepared file for a missing target', async () => {
    const databasePath = path.join(tempRoot, 'published.duckdb');
    const preparedPath = path.join(tempRoot, 'prepared.duckdb');
    fs.writeFileSync(preparedPath, 'prepared database');
    const lease = await acquireDuckDBPhysicalTarget(
      databasePath,
      owner('publisher')
    );

    try {
      expect(lease.requiresInitialization).toBe(true);
      expect(() => lease.assertSafeBeforeOpen()).toThrow(
        DuckDBTargetMissingError
      );

      lease.publishPreparedTarget(preparedPath);
      expect(fs.existsSync(preparedPath)).toBe(false);
      expect(fs.readFileSync(databasePath, 'utf8')).toBe('prepared database');
      expect(fs.statSync(databasePath).nlink).toBe(1);
      expect(lease.requiresInitialization).toBe(false);
      expect(() => lease.assertSafeBeforeOpen()).not.toThrow();
      lease.confirmOpen();
    } finally {
      if (lease.isHeld) lease.release();
    }
  });

  it('fails publication when an external creator wins the pathname', async () => {
    const databasePath = path.join(tempRoot, 'publication-race.duckdb');
    const preparedPath = path.join(tempRoot, 'publication-race.prepared');
    fs.writeFileSync(preparedPath, 'prepared database');
    const lease = await acquireDuckDBPhysicalTarget(
      databasePath,
      owner('losing publisher')
    );

    try {
      fs.writeFileSync(databasePath, 'external winner');
      expect(() => lease.publishPreparedTarget(preparedPath)).toThrow(
        DuckDBTargetChangedError
      );
      expect(fs.readFileSync(databasePath, 'utf8')).toBe('external winner');
    } finally {
      if (lease.isHeld) lease.release();
    }
  });

  it.each(['strict', 'best-effort'] as const)(
    'returns a typed error instead of weakening atomic publication in %s mode',
    async shareableLockSafety => {
      const databasePath = path.join(
        tempRoot,
        `unsupported-publication-${shareableLockSafety}.duckdb`
      );
      const preparedPath = path.join(
        tempRoot,
        `unsupported-publication-${shareableLockSafety}.prepared`
      );
      fs.writeFileSync(preparedPath, 'prepared database');
      const lease = await acquireDuckDBPhysicalTarget(databasePath, {
        ...owner(`unsupported ${shareableLockSafety}`),
        shareableLockSafety,
      });
      const unsupported = Object.assign(new Error('link unsupported'), {
        code: 'EOPNOTSUPP',
      });
      const linkSpy = jest.spyOn(fs, 'linkSync').mockImplementation(() => {
        throw unsupported;
      });

      try {
        const error = captureError(() =>
          lease.publishPreparedTarget(preparedPath)
        );
        expect(error).toBeInstanceOf(DuckDBAtomicPublicationUnavailableError);
        expect(error).toMatchObject({
          code: 'MALLOY_DUCKDB_ATOMIC_PUBLICATION_UNAVAILABLE',
          cause: unsupported,
        });
        expect(fs.existsSync(databasePath)).toBe(false);
        expect(fs.readFileSync(preparedPath, 'utf8')).toBe('prepared database');
      } finally {
        linkSpy.mockRestore();
        if (lease.isHeld) lease.release();
      }
    }
  );

  it('preserves operational publication errors for caller retry policy', async () => {
    const databasePath = path.join(tempRoot, 'publication-io-error.duckdb');
    const preparedPath = path.join(tempRoot, 'publication-io-error.prepared');
    fs.writeFileSync(preparedPath, 'prepared database');
    const lease = await acquireDuckDBPhysicalTarget(
      databasePath,
      owner('publication I/O failure')
    );
    const ioFailure = Object.assign(new Error('transient I/O failure'), {
      code: 'EIO',
    });
    const linkSpy = jest.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw ioFailure;
    });

    try {
      expect(
        captureError(() => lease.publishPreparedTarget(preparedPath))
      ).toBe(ioFailure);
      expect(fs.existsSync(databasePath)).toBe(false);
      expect(fs.readFileSync(preparedPath, 'utf8')).toBe('prepared database');
    } finally {
      linkSpy.mockRestore();
      if (lease.isHeld) lease.release();
    }
  });

  it('fails closed when an opened target changes physical identity', async () => {
    const databasePath = createTarget(tempRoot, 'replace-after-open.duckdb');
    const displacedPath = path.join(tempRoot, 'displaced-after-open.duckdb');
    let lease: DuckDBPhysicalTargetLease | undefined;

    try {
      lease = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('replace-after-open')
      );
      lease.assertSafeBeforeOpen();
      lease.confirmOpen();

      fs.renameSync(databasePath, displacedPath);
      fs.writeFileSync(databasePath, 'replacement');

      expect(() => lease!.assertUnchanged()).toThrow(DuckDBTargetChangedError);
      expect(lease.isHeld).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting().owners).toBe(1);
    } finally {
      if (lease?.isHeld) lease.release();
    }
  });

  it('requests another yield after a waiter becomes the owner', async () => {
    const databasePath = createTarget(tempRoot, 'waiter-owner.duckdb');
    const events: string[] = [];
    let first: DuckDBPhysicalTargetLease | undefined;
    let second: DuckDBPhysicalTargetLease | undefined;
    let third: DuckDBPhysicalTargetLease | undefined;
    let secondPromise: Promise<DuckDBPhysicalTargetLease> | undefined;
    let thirdPromise: Promise<DuckDBPhysicalTargetLease> | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('first', () => {
          events.push('yield:first');
          first?.release();
        })
      );
      secondPromise = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('second', () => events.push('yield:second'))
      );
      thirdPromise = acquireDuckDBPhysicalTarget(databasePath, owner('third'));

      second = await secondPromise;
      await flushMicrotasks();
      expect(events).toEqual(['yield:first', 'yield:second']);
      expect(second.isHeld).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting().waiters).toBe(1);

      second.release();
      third = await thirdPromise;
      expect(third.isHeld).toBe(true);

      // Releasing either predecessor again cannot release the current owner.
      first.release();
      second.release();
      expect(third.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
      if (second?.isHeld) second.release();
      if (!third && thirdPromise) third = await thirdPromise;
      if (third?.isHeld) third.release();
    }
  });

  it('drops a stale yield microtask instead of revoking a later lease', async () => {
    const databasePath = createTarget(tempRoot, 'stale-yield-epoch.duckdb');
    const yieldCalls: DuckDBPhysicalTargetLease[] = [];
    const recurringOwner: DuckDBTargetOwner = {
      identity: {},
      mode: 'shareable',
      description: 'recurring owner',
      requestYield: lease => yieldCalls.push(lease),
    };
    let first: DuckDBPhysicalTargetLease | undefined;
    let waiter: DuckDBPhysicalTargetLease | undefined;
    let reacquired: DuckDBPhysicalTargetLease | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(databasePath, recurringOwner);
      const waiterPromise = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('intermediate waiter')
      );

      // Release and reacquire before the old requestYield microtask runs. Its
      // owner-record epoch must not be able to act on the new fencing token.
      first.release();
      waiter = await waiterPromise;
      waiter.release();
      reacquired = await acquireDuckDBPhysicalTarget(
        databasePath,
        recurringOwner
      );
      await flushMicrotasks();

      expect(yieldCalls).toEqual([]);
      expect(reacquired.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
      if (waiter?.isHeld) waiter.release();
      if (reacquired?.isHeld) reacquired.release();
    }
  });

  it('fails closed on generic FUSE filesystems in strict mode', () => {
    if (typeof fs.statfsSync !== 'function') return;
    const databasePath = createTarget(tempRoot, 'fuse-target.duckdb');
    const realStatfs = fs.statfsSync.bind(fs);
    const statfsSpy = jest.spyOn(fs, 'statfsSync').mockImplementation(((
      targetPath: fs.PathLike
    ) => {
      const stats = realStatfs(targetPath, {bigint: true});
      return {...stats, type: BigInt(0x65735546)};
    }) as typeof fs.statfsSync);

    try {
      expect(() =>
        acquireDuckDBPhysicalTarget(databasePath, {
          ...owner('strict FUSE owner'),
          shareableLockSafety: 'strict',
        })
      ).toThrow(DuckDBUnsafeFilesystemError);
    } finally {
      statfsSpy.mockRestore();
    }
  });

  it('allows best-effort mode to bypass only the filesystem-type preflight', async () => {
    if (typeof fs.statfsSync !== 'function') return;
    const databasePath = createTarget(tempRoot, 'best-effort-fuse.duckdb');
    const statfsSpy = jest.spyOn(fs, 'statfsSync').mockImplementation(() => {
      throw new Error('best-effort must not run statfs preflight');
    });
    const lease = await acquireDuckDBPhysicalTarget(databasePath, {
      ...owner('best-effort FUSE owner'),
      shareableLockSafety: 'best-effort',
    });

    try {
      expect(() => lease.assertSafeBeforeOpen()).not.toThrow();
      expect(statfsSpy).not.toHaveBeenCalled();
    } finally {
      lease.release();
      statfsSpy.mockRestore();
    }
  });

  it('removes an aborted waiter without disturbing FIFO ownership', async () => {
    const databasePath = createTarget(tempRoot, 'abort-waiter.duckdb');
    const abortController = new AbortController();
    let first: DuckDBPhysicalTargetLease | undefined;
    let third: DuckDBPhysicalTargetLease | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('first', () => undefined)
      );
      const aborted = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('aborted'),
        {signal: abortController.signal}
      );
      const thirdPromise = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('third')
      );

      abortController.abort(new Error('cancelled by connection close'));
      await expect(aborted).rejects.toThrow('cancelled by connection close');
      expect(physicalTargetBrokerSnapshotForTesting().waiters).toBe(1);

      first.release();
      third = await thirdPromise;
      expect(third.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
      if (third?.isHeld) third.release();
    }
  });

  it('cancels a queued yield callback when the final waiter aborts', async () => {
    const databasePath = createTarget(tempRoot, 'abort-last-waiter.duckdb');
    const abortController = new AbortController();
    const yieldCalls: DuckDBPhysicalTargetLease[] = [];
    let first: DuckDBPhysicalTargetLease | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(databasePath, {
        identity: {},
        mode: 'shareable',
        description: 'owner with cancellable yield',
        requestYield: lease => yieldCalls.push(lease),
      });
      const aborted = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('last waiter'),
        {signal: abortController.signal}
      );

      // Abort in the same turn, before requestOwnerYield's microtask runs.
      abortController.abort(new Error('waiter left before yield dispatch'));
      await expect(aborted).rejects.toThrow(
        'waiter left before yield dispatch'
      );
      await flushMicrotasks();

      expect(yieldCalls).toEqual([]);
      expect(first.isHeld).toBe(true);
      expect(physicalTargetBrokerSnapshotForTesting().waiters).toBe(0);
    } finally {
      if (first?.isHeld) first.release();
    }
  });

  it('clears a latched yield demand when its final waiter later aborts', async () => {
    const databasePath = createTarget(tempRoot, 'abort-latched-yield.duckdb');
    const abortController = new AbortController();
    let requestedLease: DuckDBPhysicalTargetLease | undefined;
    let first: DuckDBPhysicalTargetLease | undefined;

    try {
      first = await acquireDuckDBPhysicalTarget(databasePath, {
        identity: {},
        mode: 'shareable',
        description: 'latched-yield owner',
        requestYield: lease => {
          requestedLease = lease;
        },
      });
      const aborted = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('late-aborting waiter'),
        {signal: abortController.signal}
      );
      await flushMicrotasks();

      expect(requestedLease).toBe(first);
      expect(first.isYieldRequested).toBe(true);
      abortController.abort(new Error('late waiter cancellation'));
      await expect(aborted).rejects.toThrow('late waiter cancellation');
      expect(first.isYieldRequested).toBe(false);
      expect(first.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
    }
  });

  it('iteratively drains a large queue invalidated by path replacement', async () => {
    const databasePath = createTarget(tempRoot, 'iterative-drain.duckdb');
    const displacedPath = path.join(tempRoot, 'iterative-drain.old');
    const first = await acquireDuckDBPhysicalTarget(
      databasePath,
      owner('queue owner')
    );
    const waiterCount = 20_000;
    const waiters = Array.from({length: waiterCount}, (_, index) =>
      acquireDuckDBPhysicalTarget(databasePath, owner(`waiter ${index}`)).then(
        lease => lease,
        error => error as unknown
      )
    );

    fs.renameSync(databasePath, displacedPath);
    fs.writeFileSync(databasePath, 'replacement');
    first.release();

    const outcomes = await Promise.all(waiters);
    expect(outcomes).toHaveLength(waiterCount);
    for (const outcome of outcomes) {
      expect(outcome).toBeInstanceOf(DuckDBTargetChangedError);
    }
  });

  it('bounds a cooperative wait with a retryable busy error', async () => {
    jest.useFakeTimers();
    const databasePath = createTarget(tempRoot, 'timeout-waiter.duckdb');
    let first: DuckDBPhysicalTargetLease | undefined;
    try {
      first = await acquireDuckDBPhysicalTarget(
        databasePath,
        owner('long-running owner', () => undefined)
      );
      const timedOut = acquireDuckDBPhysicalTarget(
        databasePath,
        owner('waiter'),
        {timeoutMs: 50}
      );

      jest.advanceTimersByTime(50);
      await expect(timedOut).rejects.toThrow(/long-running owner/);
      expect(physicalTargetBrokerSnapshotForTesting().waiters).toBe(0);
      expect(first.isHeld).toBe(true);
    } finally {
      if (first?.isHeld) first.release();
      jest.useRealTimers();
    }
  });
});

function owner(
  description: string,
  requestYield?: () => void
): DuckDBTargetOwner {
  return {
    identity: {},
    mode: 'shareable',
    description,
    requestYield,
  };
}

function createTarget(tempRoot: string, filename: string): string {
  const databasePath = path.join(tempRoot, filename);
  fs.writeFileSync(databasePath, filename);
  return fs.realpathSync.native(databasePath);
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function captureError(operation: () => void): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error('Expected operation to throw');
}
