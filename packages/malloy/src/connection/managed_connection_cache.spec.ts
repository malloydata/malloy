/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection} from './types';
import {ManagedConnectionCache} from './managed_connection_cache';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

function mockConnection(name = 'mock'): jest.Mocked<Connection> {
  return {
    name,
    dialectName: 'mock',
    getDigest: jest.fn(() => 'mock-digest'),
    fetchSchemaForTables: jest.fn(),
    fetchSchemaForSQLStruct: jest.fn(),
    runSQL: jest.fn(),
    isPool: jest.fn(() => false),
    canPersist: jest.fn(() => false),
    canStream: jest.fn(() => false),
    close: jest.fn(async () => undefined),
    idle: jest.fn(async () => undefined),
    estimateQueryCost: jest.fn(),
    fetchMetadata: jest.fn(),
    fetchTableMetadata: jest.fn(),
  } as unknown as jest.Mocked<Connection>;
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

async function nextEventLoopTurn(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
}

describe('ManagedConnectionCache', () => {
  it('single-flights 64 concurrent requests for the same name', async () => {
    const cache = new ManagedConnectionCache();
    const construction = deferred<Connection>();
    const connection = mockConnection();
    const factory = jest.fn(() => construction.promise);

    const requests = Array.from({length: 64}, () =>
      cache.getOrCreate('mock', factory)
    );

    await nextEventLoopTurn();
    expect(factory).toHaveBeenCalledTimes(1);

    construction.resolve(connection);
    const results = await Promise.all(requests);

    expect(results).toHaveLength(64);
    for (const result of results) {
      expect(result).toBe(connection);
    }
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('removes a rejected construction so a later request can retry', async () => {
    const cache = new ManagedConnectionCache();
    const firstConstruction = deferred<Connection>();
    const replacement = mockConnection();
    const factory = jest
      .fn<Promise<Connection>, []>()
      .mockImplementationOnce(() => firstConstruction.promise)
      .mockResolvedValueOnce(replacement);

    const first = cache.getOrCreate('mock', factory);
    await nextEventLoopTurn();
    firstConstruction.reject(new Error('injected factory failure'));

    await expect(first).rejects.toThrow('injected factory failure');
    await expect(cache.getOrCreate('mock', factory)).resolves.toBe(replacement);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('does not close an active identity when another alias hook fails', async () => {
    const cache = new ManagedConnectionCache();
    const shared = mockConnection('shared');
    const callbackFailure = new Error('injected alias callback failure');

    await expect(
      cache.getOrCreate(
        'first',
        async () => shared,
        () => undefined
      )
    ).resolves.toBe(shared);
    await expect(
      cache.getOrCreate(
        'second',
        async () => shared,
        () => {
          throw callbackFailure;
        }
      )
    ).rejects.toBe(callbackFailure);

    expect(shared.close).not.toHaveBeenCalled();
    await expect(
      cache.getOrCreate('first', async () => mockConnection('unexpected'))
    ).resolves.toBe(shared);
  });

  it('permanently retires an identity after initial hook cleanup succeeds', async () => {
    const cache = new ManagedConnectionCache();
    const retired = mockConnection('retired');
    const callbackFailure = new Error('injected initial callback failure');

    await expect(
      cache.getOrCreate(
        'first',
        async () => retired,
        () => {
          throw callbackFailure;
        }
      )
    ).rejects.toBe(callbackFailure);
    expect(retired.close).toHaveBeenCalledTimes(1);

    await expect(
      cache.getOrCreate('second', async () => retired)
    ).rejects.toThrow(/retired connection identity/);
    expect(retired.close).toHaveBeenCalledTimes(1);
  });

  it('quarantines aliases while failed-hook cleanup is still pending', async () => {
    const cache = new ManagedConnectionCache();
    const cleanupStarted = deferred<void>();
    const cleanup = deferred<void>();
    const identity = mockConnection('pending-cleanup');
    identity.close.mockImplementation(() => {
      cleanupStarted.resolve();
      return cleanup.promise;
    });
    const callbackFailure = new Error('injected initial callback failure');
    const firstHook = jest.fn(() => {
      throw callbackFailure;
    });
    const firstLookup = cache
      .getOrCreate('first', async () => identity, firstHook)
      .catch(error => error as unknown);

    await cleanupStarted.promise;
    const secondHook = jest.fn();
    await expect(
      cache.getOrCreate('second', async () => identity, secondHook)
    ).rejects.toThrow(/quarantined connection identity/);
    expect(secondHook).not.toHaveBeenCalled();
    expect(identity.close).toHaveBeenCalledTimes(1);

    cleanup.resolve();
    await expect(firstLookup).resolves.toBe(callbackFailure);
    const thirdHook = jest.fn();
    await expect(
      cache.getOrCreate('third', async () => identity, thirdHook)
    ).rejects.toThrow(/retired connection identity/);
    expect(thirdHook).not.toHaveBeenCalled();
    expect(identity.close).toHaveBeenCalledTimes(1);
  });

  it('idle waits for a pending construction and then idles it', async () => {
    const cache = new ManagedConnectionCache();
    const construction = deferred<Connection>();
    const connection = mockConnection();
    const lookup = cache.getOrCreate('mock', () => construction.promise);

    await nextEventLoopTurn();
    const idle = cache.idle();
    const idleSettled = trackSettlement(idle);
    await nextEventLoopTurn();

    expect(idleSettled()).toBe(false);
    expect(connection.idle).not.toHaveBeenCalled();

    construction.resolve(connection);
    await expect(lookup).resolves.toBe(connection);
    await expect(idle).resolves.toBeUndefined();
    expect(connection.idle).toHaveBeenCalledTimes(1);
  });

  it('close invalidates a pending construction and cleans up its late result', async () => {
    const cache = new ManagedConnectionCache();
    const construction = deferred<Connection>();
    const connection = mockConnection();
    const lookup = cache.getOrCreate('mock', () => construction.promise);
    const lookupOutcome = lookup.then(
      value => ({status: 'fulfilled' as const, value}),
      error => ({status: 'rejected' as const, error: error as unknown})
    );

    await nextEventLoopTurn();
    const close = cache.close();
    const closeSettled = trackSettlement(close);
    await nextEventLoopTurn();

    expect(closeSettled()).toBe(false);
    expect(connection.close).not.toHaveBeenCalled();

    construction.resolve(connection);
    await expect(close).resolves.toBeUndefined();
    expect(connection.close).toHaveBeenCalledTimes(1);

    const outcome = await lookupOutcome;
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') {
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toContain(
        'invalidated while it was being created'
      );
    }

    const replacement = mockConnection('replacement');
    await expect(
      cache.getOrCreate('mock', async () => replacement)
    ).resolves.toBe(replacement);
  });

  it('quarantines a failed close and retries cleanup before recreation', async () => {
    const cache = new ManagedConnectionCache();
    const connection = mockConnection();
    const cleanupFailure = new Error('injected cleanup failure');
    connection.close
      .mockRejectedValueOnce(cleanupFailure)
      .mockResolvedValueOnce(undefined);

    await cache.getOrCreate('mock', async () => connection);
    await expect(cache.close()).rejects.toBe(cleanupFailure);
    expect(connection.close).toHaveBeenCalledTimes(1);

    const replacement = mockConnection('replacement');
    const replacementFactory = jest.fn(async () => replacement);
    await expect(cache.getOrCreate('mock', replacementFactory)).rejects.toThrow(
      /Connection "mock" is quarantined/
    );
    expect(replacementFactory).not.toHaveBeenCalled();

    await expect(cache.close()).resolves.toBeUndefined();
    expect(connection.close).toHaveBeenCalledTimes(2);

    await expect(cache.getOrCreate('mock', replacementFactory)).resolves.toBe(
      replacement
    );
    expect(replacementFactory).toHaveBeenCalledTimes(1);
  });

  it('does not miss quarantine published while close waits for construction', async () => {
    const cache = new ManagedConnectionCache();
    const construction = deferred<Connection>();
    const lookup = cache.getOrCreate('mock', () => construction.promise);
    const lookupOutcome = lookup.catch(error => error as unknown);
    const orphan = mockConnection('orphan');
    const cleanupFailure = new Error('late orphan cleanup failure');
    orphan.close
      .mockRejectedValueOnce(cleanupFailure)
      .mockResolvedValueOnce(undefined);

    await nextEventLoopTurn();
    const close = cache.close();
    await nextEventLoopTurn();

    // This is the registry callback failure ordering: publish the object for
    // cleanup, then reject the still-retired construction.
    cache.retainForCleanup('mock', orphan);
    construction.reject(new Error('post-create callback failure'));

    await expect(close).rejects.toBe(cleanupFailure);
    await expect(lookupOutcome).resolves.toBeInstanceOf(Error);
    expect(orphan.close).toHaveBeenCalledTimes(1);

    const replacement = mockConnection('replacement');
    await expect(
      cache.getOrCreate('mock', async () => replacement)
    ).rejects.toThrow(/Connection "mock" is quarantined/);

    await expect(cache.close()).resolves.toBeUndefined();
    expect(orphan.close).toHaveBeenCalledTimes(2);
  });

  it('drains quarantine published while idle waits for construction', async () => {
    const cache = new ManagedConnectionCache();
    const construction = deferred<Connection>();
    const lookup = cache.getOrCreate('mock', () => construction.promise);
    const lookupOutcome = lookup.catch(error => error as unknown);
    const orphan = mockConnection('orphan');

    await nextEventLoopTurn();
    const idle = cache.idle();
    await nextEventLoopTurn();
    cache.retainForCleanup('mock', orphan);
    construction.reject(new Error('post-create callback failure'));

    await expect(idle).resolves.toBeUndefined();
    await expect(lookupOutcome).resolves.toBeInstanceOf(Error);
    expect(orphan.close).toHaveBeenCalledTimes(1);
  });

  it('closes one shared identity once and quarantines every alias', async () => {
    const cache = new ManagedConnectionCache();
    const shared = mockConnection('shared');
    const cleanupFailure = new Error('shared cleanup failure');
    shared.close
      .mockRejectedValueOnce(cleanupFailure)
      .mockResolvedValueOnce(undefined);
    await Promise.all([
      cache.getOrCreate('a', async () => shared),
      cache.getOrCreate('b', async () => shared),
    ]);

    await expect(cache.close()).rejects.toBe(cleanupFailure);
    expect(shared.close).toHaveBeenCalledTimes(1);
    await expect(
      cache.getOrCreate('a', async () => mockConnection('replacement-a'))
    ).rejects.toThrow(/Connection "a" is quarantined/);
    await expect(
      cache.getOrCreate('b', async () => mockConnection('replacement-b'))
    ).rejects.toThrow(/Connection "b" is quarantined/);

    await expect(cache.close()).resolves.toBeUndefined();
    expect(shared.close).toHaveBeenCalledTimes(2);
  });

  it('rejects a quarantined identity returned by a previously unseen alias', async () => {
    const cache = new ManagedConnectionCache();
    const quarantined = mockConnection('quarantined');
    const cleanupFailure = new Error('identity cleanup failure');
    quarantined.close
      .mockRejectedValueOnce(cleanupFailure)
      .mockResolvedValueOnce(undefined);

    await cache.getOrCreate('original', async () => quarantined);
    await expect(cache.close()).rejects.toBe(cleanupFailure);

    const unseenAliasFactory = jest.fn(async () => quarantined);
    await expect(
      cache.getOrCreate('previously-unseen', unseenAliasFactory)
    ).rejects.toThrow(/quarantined connection identity/);
    expect(unseenAliasFactory).toHaveBeenCalledTimes(1);

    const replacementFactory = jest.fn(async () => mockConnection('fresh'));
    await expect(
      cache.getOrCreate('previously-unseen', replacementFactory)
    ).rejects.toThrow(/Connection "previously-unseen" is quarantined/);
    expect(replacementFactory).not.toHaveBeenCalled();

    await expect(cache.close()).resolves.toBeUndefined();
    // Both aliases identify the same object, so the retry still closes it once.
    expect(quarantined.close).toHaveBeenCalledTimes(2);

    await expect(
      cache.getOrCreate('another-new-alias', async () => quarantined)
    ).rejects.toThrow(/retired connection identity/);
    expect(quarantined.close).toHaveBeenCalledTimes(2);
  });

  it('idles distinct identities sequentially in first-seen order', async () => {
    const cache = new ManagedConnectionCache();
    const events: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const connection = (name: string) => {
      const result = mockConnection(name);
      result.idle.mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        events.push(`start:${name}`);
        await nextEventLoopTurn();
        events.push(`finish:${name}`);
        concurrent--;
      });
      return result;
    };
    const first = connection('first');
    const second = connection('second');
    const third = connection('third');
    await Promise.all([
      cache.getOrCreate('a', async () => first),
      cache.getOrCreate('b', async () => second),
      cache.getOrCreate('c', async () => third),
      cache.getOrCreate('also-a', async () => first),
    ]);

    await expect(cache.idle()).resolves.toBeUndefined();

    expect(maxConcurrent).toBe(1);
    expect(events).toEqual([
      'start:first',
      'finish:first',
      'start:second',
      'finish:second',
      'start:third',
      'finish:third',
    ]);
    expect(first.idle).toHaveBeenCalledTimes(1);
  });

  it('closes sequentially and reports failures in first-seen order', async () => {
    const cache = new ManagedConnectionCache();
    const events: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const connection = (name: string, failure?: Error) => {
      const result = mockConnection(name);
      result.close.mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        events.push(`start:${name}`);
        await nextEventLoopTurn();
        events.push(`finish:${name}`);
        concurrent--;
        if (failure) throw failure;
      });
      return result;
    };
    const first = connection('first', new Error('first cleanup failure'));
    const second = connection('second');
    const third = connection('third', new Error('third cleanup failure'));
    await Promise.all([
      cache.getOrCreate('a', async () => first),
      cache.getOrCreate('b', async () => second),
      cache.getOrCreate('c', async () => third),
      cache.getOrCreate('also-a', async () => first),
    ]);

    let closeError: unknown;
    try {
      await cache.close();
    } catch (error) {
      closeError = error;
    }

    expect(maxConcurrent).toBe(1);
    expect(events).toEqual([
      'start:first',
      'finish:first',
      'start:second',
      'finish:second',
      'start:third',
      'finish:third',
    ]);
    expect(closeError).toBeInstanceOf(Error);
    expect((closeError as Error).message).toBe(
      'Failed to close managed connections: first cleanup failure; third cleanup failure'
    );
    expect(first.close).toHaveBeenCalledTimes(1);
  });

  it('orders quarantined cleanup by construction order, not failure timing', async () => {
    const cache = new ManagedConnectionCache();
    const firstConstruction = deferred<Connection>();
    const secondConstruction = deferred<Connection>();
    const events: string[] = [];
    const first = mockConnection('first');
    const second = mockConnection('second');
    const firstRetryFailure = new Error('first retry failure');
    const secondRetryFailure = new Error('second retry failure');
    first.close
      .mockRejectedValueOnce(new Error('first admission cleanup failure'))
      .mockImplementationOnce(async () => {
        events.push('first');
        throw firstRetryFailure;
      });
    second.close
      .mockRejectedValueOnce(new Error('second admission cleanup failure'))
      .mockImplementationOnce(async () => {
        events.push('second');
        throw secondRetryFailure;
      });
    const rejectCallback = () => {
      throw new Error('injected callback failure');
    };

    const firstLookup = cache
      .getOrCreate('first', () => firstConstruction.promise, rejectCallback)
      .catch(error => error as unknown);
    const secondLookup = cache
      .getOrCreate('second', () => secondConstruction.promise, rejectCallback)
      .catch(error => error as unknown);
    secondConstruction.resolve(second);
    await nextEventLoopTurn();
    firstConstruction.resolve(first);
    await Promise.all([firstLookup, secondLookup]);

    let closeError: unknown;
    try {
      await cache.close();
    } catch (error) {
      closeError = error;
    }

    expect(events).toEqual(['first', 'second']);
    expect(closeError).toMatchObject({
      name: 'ManagedConnectionLifecycleError',
      errors: [firstRetryFailure, secondRetryFailure],
    });
  });

  it('idles one shared identity once and evicts every alias on failure', async () => {
    const cache = new ManagedConnectionCache();
    const shared = mockConnection('shared');
    const idleFailure = new Error('shared idle failure');
    shared.idle.mockRejectedValueOnce(idleFailure);
    await Promise.all([
      cache.getOrCreate('a', async () => shared),
      cache.getOrCreate('b', async () => shared),
    ]);

    await expect(cache.idle()).rejects.toBe(idleFailure);
    expect(shared.idle).toHaveBeenCalledTimes(1);
    expect(shared.close).toHaveBeenCalledTimes(1);

    const replacementA = mockConnection('replacement-a');
    const replacementB = mockConnection('replacement-b');
    await expect(
      cache.getOrCreate('a', async () => replacementA)
    ).resolves.toBe(replacementA);
    await expect(
      cache.getOrCreate('b', async () => replacementB)
    ).resolves.toBe(replacementB);
  });

  it('does not admit a replacement until the retired generation is closed', async () => {
    const cache = new ManagedConnectionCache();
    const cleanup = deferred<void>();
    const retired = mockConnection('retired');
    retired.close.mockImplementation(() => cleanup.promise);
    await cache.getOrCreate('mock', async () => retired);

    const close = cache.close();
    const replacement = mockConnection('replacement');
    const replacementFactory = jest.fn(async () => replacement);
    const lookup = cache.getOrCreate('mock', replacementFactory);
    await nextEventLoopTurn();

    expect(retired.close).toHaveBeenCalledTimes(1);
    expect(replacementFactory).not.toHaveBeenCalled();

    cleanup.resolve();
    await close;
    await expect(lookup).resolves.toBe(replacement);
    expect(replacementFactory).toHaveBeenCalledTimes(1);
  });

  it('does not double-close after failed idle cleanup precedes queued close', async () => {
    const cache = new ManagedConnectionCache();
    const idleStarted = deferred<void>();
    const finishIdle = deferred<void>();
    const connection = mockConnection('non-idempotent');
    const idleFailure = new Error('injected idle failure');
    connection.idle.mockImplementation(async () => {
      idleStarted.resolve();
      await finishIdle.promise;
      throw idleFailure;
    });
    connection.close.mockImplementation(async () => {
      if (connection.close.mock.calls.length > 1) {
        throw new Error('duplicate close');
      }
    });
    await cache.getOrCreate('mock', async () => connection);

    const idleResult = cache.idle().catch(error => error as unknown);
    await idleStarted.promise;
    const close = cache.close();
    finishIdle.resolve();

    await expect(idleResult).resolves.toBe(idleFailure);
    await expect(close).resolves.toBeUndefined();
    expect(connection.close).toHaveBeenCalledTimes(1);
    await expect(
      cache.getOrCreate('new-alias', async () => connection)
    ).rejects.toThrow(/retired connection identity/);
  });
});
