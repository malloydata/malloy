/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection} from './types';

interface Construction {
  readonly generation: number;
  readonly order: number;
  readonly promise: Promise<Connection>;
}

interface ConnectionGroup {
  readonly connection: Connection;
  readonly entries: Array<[string, Construction]>;
}

/**
 * Linearizable lazy construction and lifecycle management for connection
 * lookups. close() advances to a fresh generation (it is intentionally not a
 * terminal operation), while failed cleanup quarantines every alias until a
 * later idle() or close() successfully retries terminal cleanup.
 */
export class ManagedConnectionCache {
  private generation = 0;
  private nextOrder = 0;
  private cache = new Map<string, Construction>();
  private readonly quarantine = new Map<string, Set<Connection>>();
  private readonly quarantinedIdentities = new Set<Connection>();
  private readonly activeIdentities = new Set<Connection>();
  private readonly retiredIdentities = new WeakSet<Connection>();
  private readonly terminallyClosedIdentities = new WeakSet<Connection>();
  private readonly identityOrder = new WeakMap<Connection, number>();
  private lifecycleBarrier: Promise<void> | undefined;
  private closeTask: Promise<void> | undefined;

  /** Retain an object whose out-of-band cleanup failed so close() can retry. */
  retainForCleanup(
    name: string,
    connection: Connection,
    order = this.nextOrder++
  ): void {
    this.recordIdentityOrder(connection, order);
    this.quarantinedIdentities.add(connection);
    this.retiredIdentities.add(connection);
    let connections = this.quarantine.get(name);
    if (!connections) {
      connections = new Set();
      this.quarantine.set(name, connections);
    }
    connections.add(connection);
  }

  async getOrCreate(
    name: string,
    create: () => Promise<Connection>,
    onCreated?: (connection: Connection) => void
  ): Promise<Connection> {
    // Do not insert into a generation after merely awaiting a stale snapshot
    // of the lifecycle barrier. The loop and the cache insertion execute
    // without an intervening await, making admission linearizable with the
    // synchronous cache swap at the start of close().
    while (this.lifecycleBarrier) {
      const barrier = this.lifecycleBarrier;
      try {
        await barrier;
      } catch {
        // Quarantine, rather than the lifecycle error, governs recreation.
      }
    }
    if (this.quarantine.has(name)) {
      throw new Error(
        `Connection "${name}" is quarantined because its previous close did not complete; retry shutdown before recreating it`
      );
    }

    const generation = this.generation;
    let construction = this.cache.get(name);
    if (!construction) {
      const order = this.nextOrder++;
      const promise = Promise.resolve()
        .then(create)
        .then(connection =>
          this.admitCreatedConnection(name, order, connection, onCreated)
        );
      construction = {generation, order, promise};
      const installed = construction;
      this.cache.set(name, construction);
      void promise.catch(() => {
        if (this.cache.get(name) === installed) this.cache.delete(name);
      });
    }

    const connection = await construction.promise;
    if (
      construction.generation !== this.generation ||
      this.cache.get(name) !== construction
    ) {
      await this.waitForLifecycle();
      throw new Error(
        `Connection "${name}" was invalidated while it was being created`
      );
    }
    return connection;
  }

  private async admitCreatedConnection(
    name: string,
    order: number,
    connection: Connection,
    onCreated?: (connection: Connection) => void
  ): Promise<Connection> {
    this.recordIdentityOrder(connection, order);
    if (this.quarantinedIdentities.has(connection)) {
      // Record the newly discovered alias so the same identity remains
      // unavailable through every name until terminal cleanup succeeds.
      this.retainForCleanup(name, connection, order);
      throw new Error(
        `Connection "${name}" resolved to a quarantined connection identity because its previous close did not complete; retry shutdown before recreating it`
      );
    }
    if (this.retiredIdentities.has(connection)) {
      throw new Error(
        `Connection "${name}" resolved to a retired connection identity and cannot be cached again`
      );
    }

    const alreadyActive = this.activeIdentities.has(connection);
    if (onCreated) {
      try {
        onCreated(connection);
      } catch (callbackError) {
        if (alreadyActive) {
          // This identity is already published through another alias. Closing
          // it here would silently invalidate that alias, so reject only this
          // construction and leave the active identity untouched.
          throw callbackError;
        }

        // Publish retirement before awaiting cleanup. A concurrently resolving
        // alias must observe the identity barrier rather than running its hook
        // or racing a second close against this one.
        this.retainForCleanup(name, connection, order);
        try {
          await connection.close();
          this.markTerminallyClosed(connection);
        } catch (cleanupError) {
          throw combinedError(
            [asError(callbackError), asError(cleanupError)],
            'Connection post-creation callback failed and cleanup also failed'
          );
        }
        throw callbackError;
      }
    }

    this.activeIdentities.add(connection);
    return connection;
  }

  idle(): Promise<void> {
    return this.enqueueLifecycle(async () => {
      const entries = [...this.cache.entries()];
      const settled = await settleAll(
        entries.map(([, construction]) => construction.promise)
      );
      const failures: Error[] = [];
      const groups = groupSettledConnections(entries, settled);
      for (const group of groups) {
        try {
          // One Connection identity may be registered under several names.
          // Its lifecycle API is not required to be reentrant, so idle it
          // exactly once. Distinct identities are also processed in their
          // first-seen order to avoid unbounded lifecycle concurrency.
          await group.connection.idle();
        } catch (error) {
          failures.push(asError(error));
          for (const [name, construction] of group.entries) {
            if (this.cache.get(name) === construction) {
              this.cache.delete(name);
            }
            this.retainForCleanup(name, group.connection);
          }
        }
      }
      try {
        // Failed idle is conservatively terminal: evict the object and try
        // close() before admitting a replacement. This same post-settlement
        // sweep also catches quarantine published just before a rejected
        // post-create callback construction settles.
        await this.closeConnections(
          [],
          'Failed to clean up managed connections'
        );
      } catch (error) {
        failures.push(asError(error));
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) {
        throw combinedError(failures, 'Failed to idle managed connections');
      }
    });
  }

  close(): Promise<void> {
    if (this.closeTask) return this.closeTask;

    const retired = this.cache;
    this.cache = new Map();
    this.generation++;
    const task = this.enqueueLifecycle(async () => {
      const entries = [...retired.entries()];
      const settled = await settleAll(
        entries.map(([, construction]) => construction.promise)
      );
      const cleanup = groupSettledConnections(entries, settled);
      // Snapshot quarantine only after every retired construction settles.
      // retainForCleanup() is published before its factory rejects, so this
      // closes the lost-cleanup window. closeConnections() also keeps
      // draining newly published identities between await boundaries.
      await this.closeConnections(
        cleanup,
        'Failed to close managed connections'
      );
    });
    this.closeTask = task;
    void task.then(
      () => {
        if (this.closeTask === task) this.closeTask = undefined;
      },
      () => {
        if (this.closeTask === task) this.closeTask = undefined;
      }
    );
    return task;
  }

  private enqueueLifecycle(operation: () => Promise<void>): Promise<void> {
    const previous = this.lifecycleBarrier;
    const task = (async () => {
      if (previous) {
        try {
          await previous;
        } catch {
          // A later lifecycle request may retry quarantined cleanup.
        }
      }
      await operation();
    })();
    this.lifecycleBarrier = task;
    void task.then(
      () => {
        if (this.lifecycleBarrier === task) this.lifecycleBarrier = undefined;
      },
      () => {
        if (this.lifecycleBarrier === task) this.lifecycleBarrier = undefined;
      }
    );
    return task;
  }

  private async waitForLifecycle(): Promise<void> {
    while (this.lifecycleBarrier) {
      const barrier = this.lifecycleBarrier;
      try {
        await barrier;
      } catch {
        // Quarantine, rather than the lifecycle error, governs recreation.
      }
      if (this.lifecycleBarrier === barrier) return;
    }
  }

  private async closeConnections(
    initial: ConnectionGroup[],
    failureMessage: string
  ): Promise<void> {
    const attempted = new Set<Connection>();
    const failures: Error[] = [];
    const pending = new Map<Connection, Set<string>>();
    for (const group of initial) {
      this.retiredIdentities.add(group.connection);
      pending.set(
        group.connection,
        new Set(group.entries.map(([name]) => name))
      );
    }

    for (;;) {
      for (const [name, connections] of this.quarantine) {
        for (const connection of connections) {
          if (attempted.has(connection)) continue;
          let names = pending.get(connection);
          if (!names) {
            names = new Set();
            pending.set(connection, names);
          }
          names.add(name);
        }
      }
      const batch = [...pending]
        .filter(([connection]) => {
          if (attempted.has(connection)) {
            pending.delete(connection);
            return false;
          }
          attempted.add(connection);
          return true;
        })
        .sort(
          ([left], [right]) =>
            this.identityOrder.get(left)! - this.identityOrder.get(right)!
        );
      pending.clear();
      if (batch.length === 0) break;

      for (const [connection, names] of batch) {
        this.retiredIdentities.add(connection);
        if (this.terminallyClosedIdentities.has(connection)) {
          // A preceding queued lifecycle operation already completed terminal
          // cleanup. Do not require Connection.close() to be idempotent.
          this.activeIdentities.delete(connection);
          this.removeFromQuarantine(connection);
          continue;
        }
        try {
          await connection.close();
          this.markTerminallyClosed(connection);
        } catch (error) {
          for (const name of names) {
            this.retainForCleanup(name, connection);
          }
          failures.push(asError(error));
        }
      }
      // Re-read quarantine after the awaited closes. This is a level-triggered
      // drain: a cleanup published while the batch was running is picked up
      // before the lifecycle barrier opens to a replacement generation.
    }

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw combinedError(failures, failureMessage);
    }
  }

  private removeFromQuarantine(connection: Connection): void {
    this.quarantinedIdentities.delete(connection);
    for (const [name, connections] of this.quarantine) {
      connections.delete(connection);
      if (connections.size === 0) this.quarantine.delete(name);
    }
  }

  private markTerminallyClosed(connection: Connection): void {
    this.retiredIdentities.add(connection);
    this.terminallyClosedIdentities.add(connection);
    this.activeIdentities.delete(connection);
    this.removeFromQuarantine(connection);
  }

  private recordIdentityOrder(connection: Connection, order: number): void {
    const current = this.identityOrder.get(connection);
    if (current === undefined || order < current) {
      this.identityOrder.set(connection, order);
    }
  }
}

function groupSettledConnections(
  entries: Array<[string, Construction]>,
  settled: Array<
    | {status: 'fulfilled'; value: Connection}
    | {status: 'rejected'; reason: unknown}
  >
): ConnectionGroup[] {
  const groups = new Map<Connection, Array<[string, Construction]>>();
  for (let index = 0; index < entries.length; index++) {
    const result = settled[index];
    if (result.status === 'rejected') continue;
    let aliases = groups.get(result.value);
    if (!aliases) {
      aliases = [];
      groups.set(result.value, aliases);
    }
    aliases.push(entries[index]);
  }
  return [...groups].map(([connection, aliases]) => ({
    connection,
    entries: aliases,
  }));
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function settleAll<T>(
  promises: Array<Promise<T>>
): Promise<
  Array<{status: 'fulfilled'; value: T} | {status: 'rejected'; reason: unknown}>
> {
  return Promise.all(
    promises.map(promise =>
      promise.then(
        value => ({status: 'fulfilled' as const, value}),
        reason => ({status: 'rejected' as const, reason})
      )
    )
  );
}

class ManagedConnectionLifecycleError extends Error {
  constructor(
    readonly errors: readonly Error[],
    message: string
  ) {
    super(`${message}: ${errors.map(error => error.message).join('; ')}`);
    this.name = 'ManagedConnectionLifecycleError';
  }
}

function combinedError(errors: Error[], message: string): Error {
  return new ManagedConnectionLifecycleError(errors, message);
}
