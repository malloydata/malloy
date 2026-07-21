/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import path from 'path';
import {isMainThread} from 'worker_threads';

const BROKER_PROTOCOL = 1 as const;
const BROKER_SYMBOL = Symbol.for(
  '@malloydata/db-duckdb/physical-target-broker/v1'
);

export type DuckDBTargetOwnerMode = 'shareable' | 'direct';

export interface DuckDBTargetOwner {
  readonly identity: object;
  readonly mode: DuckDBTargetOwnerMode;
  readonly shareableLockSafety?: 'strict' | 'best-effort';
  readonly description: string;
  readonly requestYield?: (expectedLease: DuckDBPhysicalTargetLease) => void;
}

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly links: bigint;
}

interface OwnerRecord {
  readonly owner: DuckDBTargetOwner;
  yieldRequested: boolean;
  yieldEpoch: number;
  lease?: DuckDBPhysicalTargetLease;
}

interface Waiter {
  readonly owner: DuckDBTargetOwner;
  readonly databasePath: string;
  readonly resolve: (lease: DuckDBPhysicalTargetLease) => void;
  readonly reject: (error: Error) => void;
  active: boolean;
  cleanup?: () => void;
}

interface TargetSlot {
  readonly paths: Set<string>;
  inodeKey?: string;
  owner?: OwnerRecord;
  readonly waiters: Waiter[];
}

interface BrokerState {
  readonly protocol: typeof BROKER_PROTOCOL;
  readonly byPath: Map<string, TargetSlot>;
  readonly byInode: Map<string, TargetSlot>;
}

export class DuckDBPhysicalTargetBusyError extends Error {
  constructor(databasePath: string, holder: string) {
    super(
      `DuckDB database "${databasePath}" is already owned by ${holder}; ` +
        'close that connection before opening the same physical file with an incompatible configuration'
    );
    this.name = 'DuckDBPhysicalTargetBusyError';
  }
}

export class DuckDBUnsafeFileIdentityError extends Error {
  constructor(databasePath: string, links: bigint) {
    super(
      `DuckDB database "${databasePath}" has ${links.toString()} hard links. ` +
        'Malloy refuses to open multiply-linked DuckDB files because DuckDB derives WAL paths from the pathname while POSIX record locks belong to the inode'
    );
    this.name = 'DuckDBUnsafeFileIdentityError';
  }
}

export class DuckDBUnsafeFilesystemError extends Error {
  constructor(databasePath: string) {
    super(
      `DuckDB database "${databasePath}" is on a filesystem whose local-lock semantics are not accepted by the strict shareable preflight`
    );
    this.name = 'DuckDBUnsafeFilesystemError';
  }
}

export class DuckDBAtomicPublicationUnavailableError extends Error {
  public readonly code =
    'MALLOY_DUCKDB_ATOMIC_PUBLICATION_UNAVAILABLE' as const;
  public readonly cause: unknown;

  constructor(databasePath: string, cause: unknown) {
    super(
      `DuckDB database "${databasePath}" cannot be created with atomic no-replace publication on this filesystem; pre-create it while no peers are running or move it to a hardlink-capable filesystem`
    );
    this.name = 'DuckDBAtomicPublicationUnavailableError';
    this.cause = cause;
  }
}

export class DuckDBUnsafeExecutionRealmError extends Error {
  public readonly code = 'MALLOY_DUCKDB_UNSAFE_EXECUTION_REALM' as const;

  constructor(databasePath: string) {
    super(
      `DuckDB shareable local-file database "${databasePath}" cannot run in a Node worker thread. ` +
        'The broker is JavaScript-realm-local while POSIX fcntl locks are process-associated; use the main thread or an out-of-process database broker'
    );
    this.name = 'DuckDBUnsafeExecutionRealmError';
  }
}

export class DuckDBTargetChangedError extends Error {
  constructor(databasePath: string) {
    super(
      `DuckDB database "${databasePath}" changed physical file identity while it was owned; the connection was stopped to avoid accessing an unfenced replacement`
    );
    this.name = 'DuckDBTargetChangedError';
  }
}

export class DuckDBTargetMissingError extends Error {
  constructor(databasePath: string) {
    super(
      `DuckDB database "${databasePath}" does not exist and cannot be opened under a verified physical-file identity`
    );
    this.name = 'DuckDBTargetMissingError';
  }
}

/**
 * A fencing token for one physical DuckDB target.
 *
 * This is deliberately exclusive even for READ_ONLY connections. DuckDB uses
 * traditional process-associated fcntl locks on POSIX: closing any descriptor
 * for an inode can release every lock that process owns for that inode. One
 * Malloy target owner per JS realm avoids creating the dangerous second fd.
 */
export class DuckDBPhysicalTargetLease {
  private released = false;
  private openedIdentity: FileIdentity | undefined;

  constructor(
    private readonly state: BrokerState,
    private readonly slot: TargetSlot,
    private readonly record: OwnerRecord,
    public readonly databasePath: string,
    private identityBeforeOpen: FileIdentity | undefined
  ) {}

  get requiresInitialization(): boolean {
    return this.identityBeforeOpen === undefined;
  }

  /**
   * Atomically publish a fully closed, private DuckDB file at a target which
   * was absent when this lease was granted. link(2) is the no-replace commit:
   * if any peer wins the pathname first, publication fails rather than
   * silently binding this lease to an unverified file.
   */
  publishPreparedTarget(preparedPath: string): void {
    this.assertHeld();
    if (this.identityBeforeOpen !== undefined) {
      throw new Error('DuckDB physical target already has an identity');
    }
    const preparedIdentity = readIdentity(preparedPath);
    if (!preparedIdentity) {
      throw new DuckDBTargetMissingError(preparedPath);
    }
    assertOwnerFileIdentity(this.record.owner, preparedPath, preparedIdentity);
    if (readIdentity(this.databasePath) !== undefined) {
      throw new DuckDBTargetChangedError(this.databasePath);
    }

    try {
      fs.linkSync(preparedPath, this.databasePath);
    } catch (error) {
      if (isErrorCode(error, 'EEXIST')) {
        throw new DuckDBTargetChangedError(this.databasePath);
      }
      if (isAtomicPublicationUnsupported(error)) {
        throw new DuckDBAtomicPublicationUnavailableError(
          this.databasePath,
          error
        );
      }
      // Preserve operational failures (for example EIO or ENOSPC). They do
      // not prove that hard-link publication is unsupported, and callers need
      // the original errno to decide whether retrying is appropriate.
      throw error;
    }
    // Remove the private staging name in the same synchronous turn. The
    // published target is again single-linked before any JS peer can run.
    fs.unlinkSync(preparedPath);

    const publishedIdentity = readIdentity(this.databasePath);
    if (!sameIdentity(preparedIdentity, publishedIdentity)) {
      throw new DuckDBTargetChangedError(this.databasePath);
    }
    assertOwnerFileIdentity(
      this.record.owner,
      this.databasePath,
      publishedIdentity
    );
    assertSlotOwnsIdentity(
      this.state,
      this.slot,
      this.databasePath,
      publishedIdentity
    );
    bindIdentity(
      this.state,
      this.slot,
      this.databasePath,
      publishedIdentity as FileIdentity
    );
    this.identityBeforeOpen = publishedIdentity;
  }

  /** Verify the path immediately before DuckDB opens or ATTACHes it. */
  assertSafeBeforeOpen(): void {
    this.assertHeld();
    if (requiresStrictFilesystemPreflight(this.record.owner)) {
      assertSafeFilesystem(this.databasePath);
    }
    const current = readIdentity(this.databasePath);
    if (
      this.record.owner.mode === 'shareable' &&
      (!this.identityBeforeOpen || !current)
    ) {
      throw new DuckDBTargetMissingError(this.databasePath);
    }
    assertOwnerFileIdentity(this.record.owner, this.databasePath, current);
    if (
      this.identityBeforeOpen !== undefined &&
      !sameIdentity(current, this.identityBeforeOpen)
    ) {
      throw new DuckDBTargetChangedError(this.databasePath);
    }
    assertSlotOwnsIdentity(this.state, this.slot, this.databasePath, current);
  }

  /**
   * Bind the token to the identity DuckDB actually opened. Call only after a
   * successful native open/ATTACH, and clean up the native handle if it throws.
   */
  confirmOpen(): void {
    this.assertHeld();
    const current = readIdentity(this.databasePath);
    if (!current) {
      throw new DuckDBTargetChangedError(this.databasePath);
    }
    assertOwnerFileIdentity(this.record.owner, this.databasePath, current);
    if (
      this.identityBeforeOpen !== undefined &&
      !sameIdentity(current, this.identityBeforeOpen)
    ) {
      throw new DuckDBTargetChangedError(this.databasePath);
    }
    assertSlotOwnsIdentity(this.state, this.slot, this.databasePath, current);
    bindIdentity(this.state, this.slot, this.databasePath, current);
    this.openedIdentity = current;
  }

  /** Fail closed if rename/replacement or a new hard link changed the target. */
  assertUnchanged(): void {
    this.assertHeld();
    const current = readIdentity(this.databasePath);
    assertOwnerFileIdentity(this.record.owner, this.databasePath, current);
    if (!sameIdentity(current, this.openedIdentity)) {
      throw new DuckDBTargetChangedError(this.databasePath);
    }
  }

  /** Keep ownership, but wake all local waiters with a retryable failure. */
  rejectWaiters(error: unknown): void {
    this.assertHeld();
    const failure = asError(error);
    const waiters = this.slot.waiters.splice(0);
    this.record.yieldRequested = false;
    this.record.yieldEpoch++;
    for (const waiter of waiters) {
      rejectWaiter(waiter, failure);
    }
  }

  /** Release only after native DETACH/close has established its postcondition. */
  release(): void {
    if (this.released) return;
    this.assertHeld();
    this.released = true;
    this.slot.owner = undefined;
    grantNext(this.state, this.slot);
    pruneSlot(this.state, this.slot);
  }

  get isHeld(): boolean {
    return !this.released && this.slot.owner === this.record;
  }

  /** True only while at least one live waiter still needs this exact lease. */
  get isYieldRequested(): boolean {
    return (
      this.isHeld && this.record.yieldRequested && this.slot.waiters.length > 0
    );
  }

  private assertHeld(): void {
    if (this.released || this.slot.owner !== this.record) {
      throw new Error('DuckDB physical-target fencing token is not held');
    }
  }
}

export function acquireDuckDBPhysicalTarget(
  databasePath: string,
  owner: DuckDBTargetOwner,
  options: {signal?: AbortSignal; timeoutMs?: number} = {}
): Promise<DuckDBPhysicalTargetLease> {
  throwIfAborted(options.signal);
  const canonicalPath = path.normalize(databasePath);
  if (!isMainThread) {
    throw new DuckDBUnsafeExecutionRealmError(canonicalPath);
  }
  if (requiresStrictFilesystemPreflight(owner)) {
    assertSafeFilesystem(canonicalPath);
  }
  const identity = readIdentity(canonicalPath);
  assertOwnerFileIdentity(owner, canonicalPath, identity);

  const state = getBrokerState();
  const pathSlot = state.byPath.get(canonicalPath);
  const inodeSlot = identity
    ? state.byInode.get(identityKey(identity))
    : undefined;
  if (pathSlot && inodeSlot && pathSlot !== inodeSlot) {
    return Promise.reject(new DuckDBTargetChangedError(canonicalPath));
  }
  const slot = pathSlot ?? inodeSlot ?? createSlot();
  slot.paths.add(canonicalPath);
  state.byPath.set(canonicalPath, slot);
  if (identity) bindIdentity(state, slot, canonicalPath, identity);

  if (!slot.owner && slot.waiters.length === 0) {
    return Promise.resolve(grant(state, slot, owner, canonicalPath, identity));
  }

  if (slot.owner?.owner.identity === owner.identity) {
    return Promise.reject(
      new Error('DuckDB physical-target owner attempted to acquire twice')
    );
  }

  if (slot.owner?.owner.mode === 'direct') {
    return Promise.reject(
      new DuckDBPhysicalTargetBusyError(
        canonicalPath,
        slot.owner.owner.description
      )
    );
  }

  return new Promise<DuckDBPhysicalTargetLease>((resolve, reject) => {
    const waiter: Waiter = {
      owner,
      databasePath: canonicalPath,
      resolve,
      reject,
      active: true,
    };
    const cleanupTasks: Array<() => void> = [];
    if (options.signal) {
      const signal = options.signal;
      const onAbort = () => {
        removeWaiter(slot, waiter);
        rejectWaiter(waiter, abortReason(signal));
        pruneSlot(state, slot);
      };
      signal.addEventListener('abort', onAbort, {once: true});
      cleanupTasks.push(() => signal.removeEventListener('abort', onAbort));
    }
    if (options.timeoutMs !== undefined) {
      const timeout = setTimeout(() => {
        removeWaiter(slot, waiter);
        rejectWaiter(
          waiter,
          new DuckDBPhysicalTargetBusyError(
            canonicalPath,
            slot.owner?.owner.description ?? 'another queued Malloy owner'
          )
        );
        pruneSlot(state, slot);
      }, options.timeoutMs);
      cleanupTasks.push(() => clearTimeout(timeout));
    }
    waiter.cleanup = () => {
      for (const cleanup of cleanupTasks) cleanup();
    };
    slot.waiters.push(waiter);
    requestOwnerYield(slot);
  });
}

export function physicalTargetBrokerSnapshotForTesting(): {
  paths: number;
  inodes: number;
  owners: number;
  waiters: number;
} {
  const state = getBrokerState();
  const slots = new Set(state.byPath.values());
  for (const slot of state.byInode.values()) slots.add(slot);
  return {
    paths: state.byPath.size,
    inodes: state.byInode.size,
    owners: [...slots].filter(slot => slot.owner !== undefined).length,
    waiters: [...slots].reduce((sum, slot) => sum + slot.waiters.length, 0),
  };
}

function getBrokerState(): BrokerState {
  const shared = globalThis as unknown as Record<symbol, unknown>;
  const existing = shared[BROKER_SYMBOL];
  if (existing !== undefined) {
    if (!isBrokerState(existing)) {
      throw new Error(
        'Incompatible DuckDB physical-target broker protocol is already installed in this JavaScript realm'
      );
    }
    return existing;
  }
  const created: BrokerState = {
    protocol: BROKER_PROTOCOL,
    byPath: new Map(),
    byInode: new Map(),
  };
  Object.defineProperty(shared, BROKER_SYMBOL, {
    value: created,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return created;
}

function isBrokerState(value: unknown): value is BrokerState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'protocol' in value &&
    value.protocol === BROKER_PROTOCOL &&
    'byPath' in value &&
    value.byPath instanceof Map &&
    'byInode' in value &&
    value.byInode instanceof Map
  );
}

function createSlot(): TargetSlot {
  return {paths: new Set(), waiters: []};
}

function grant(
  state: BrokerState,
  slot: TargetSlot,
  owner: DuckDBTargetOwner,
  databasePath: string,
  identity: FileIdentity | undefined
): DuckDBPhysicalTargetLease {
  const record: OwnerRecord = {owner, yieldRequested: false, yieldEpoch: 0};
  slot.owner = record;
  const lease = new DuckDBPhysicalTargetLease(
    state,
    slot,
    record,
    databasePath,
    identity
  );
  record.lease = lease;
  return lease;
}

function grantNext(state: BrokerState, slot: TargetSlot): void {
  // Drain invalidated waiters iteratively. A recursive handoff can overflow
  // the JavaScript stack when a large adversarial queue all fails identity
  // validation at once.
  for (;;) {
    const waiter = slot.waiters.shift();
    if (!waiter) return;
    try {
      const identity = readIdentity(waiter.databasePath);
      assertOwnerFileIdentity(waiter.owner, waiter.databasePath, identity);
      assertSlotOwnsIdentity(state, slot, waiter.databasePath, identity);
      const lease = grant(
        state,
        slot,
        waiter.owner,
        waiter.databasePath,
        identity
      );
      resolveWaiter(waiter, lease);
      // Resolve first. Promise continuations then publish the lease in the new
      // owner before the queued cooperative-yield callback can observe it.
      if (slot.waiters.length > 0) requestOwnerYield(slot);
      return;
    } catch (error) {
      rejectWaiter(waiter, asError(error));
    }
  }
}

function requestOwnerYield(slot: TargetSlot): void {
  const record = slot.owner;
  if (!record || record.yieldRequested) return;
  const requestYield = record.owner.requestYield;
  if (!requestYield) return;
  record.yieldRequested = true;
  const yieldEpoch = ++record.yieldEpoch;
  queueMicrotask(() => {
    const lease = record.lease;
    if (
      slot.owner !== record ||
      !lease?.isHeld ||
      !record.yieldRequested ||
      record.yieldEpoch !== yieldEpoch ||
      slot.waiters.length === 0
    ) {
      return;
    }
    requestYield(lease);
  });
}

function pruneSlot(state: BrokerState, slot: TargetSlot): void {
  if (slot.owner || slot.waiters.length > 0) return;
  for (const targetPath of slot.paths) {
    if (state.byPath.get(targetPath) === slot) {
      state.byPath.delete(targetPath);
    }
  }
  if (slot.inodeKey && state.byInode.get(slot.inodeKey) === slot) {
    state.byInode.delete(slot.inodeKey);
  }
}

function bindIdentity(
  state: BrokerState,
  slot: TargetSlot,
  databasePath: string,
  identity: FileIdentity
): void {
  const key = identityKey(identity);
  const existing = state.byInode.get(key);
  if (existing && existing !== slot) {
    throw new DuckDBPhysicalTargetBusyError(
      databasePath,
      existing.owner?.owner.description ?? 'another pending Malloy owner'
    );
  }
  if (slot.inodeKey && slot.inodeKey !== key) {
    throw new DuckDBTargetChangedError(databasePath);
  }
  slot.inodeKey = key;
  state.byInode.set(key, slot);
}

function assertSlotOwnsIdentity(
  state: BrokerState,
  slot: TargetSlot,
  databasePath: string,
  identity: FileIdentity | undefined
): void {
  if (slot.inodeKey) {
    if (!identity || slot.inodeKey !== identityKey(identity)) {
      throw new DuckDBTargetChangedError(databasePath);
    }
  }
  if (!identity) return;
  const other = state.byInode.get(identityKey(identity));
  if (other && other !== slot) {
    throw new DuckDBPhysicalTargetBusyError(
      databasePath,
      other.owner?.owner.description ?? 'another pending Malloy owner'
    );
  }
}

function removeWaiter(slot: TargetSlot, waiter: Waiter): void {
  const index = slot.waiters.indexOf(waiter);
  if (index !== -1) slot.waiters.splice(index, 1);
  if (slot.waiters.length === 0 && slot.owner) {
    slot.owner.yieldRequested = false;
    slot.owner.yieldEpoch++;
  }
}

function resolveWaiter(waiter: Waiter, lease: DuckDBPhysicalTargetLease): void {
  if (!waiter.active) {
    lease.release();
    return;
  }
  waiter.active = false;
  waiter.cleanup?.();
  waiter.resolve(lease);
}

function rejectWaiter(waiter: Waiter, error: Error): void {
  if (!waiter.active) return;
  waiter.active = false;
  waiter.cleanup?.();
  waiter.reject(error);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error(
    signal.reason === undefined
      ? 'DuckDB physical-target acquisition was aborted'
      : String(signal.reason)
  );
  error.name = 'AbortError';
  return error;
}

function readIdentity(databasePath: string): FileIdentity | undefined {
  try {
    const stat = fs.statSync(databasePath, {bigint: true});
    return {device: stat.dev, inode: stat.ino, links: stat.nlink};
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  }
}

function assertSingleLink(
  databasePath: string,
  identity: FileIdentity | undefined
): void {
  if (identity && identity.links > BigInt(1)) {
    throw new DuckDBUnsafeFileIdentityError(databasePath, identity.links);
  }
}

function assertOwnerFileIdentity(
  owner: DuckDBTargetOwner,
  databasePath: string,
  identity: FileIdentity | undefined
): void {
  if (owner.mode === 'shareable') assertSingleLink(databasePath, identity);
}

function requiresStrictFilesystemPreflight(owner: DuckDBTargetOwner): boolean {
  return (
    owner.mode === 'shareable' &&
    (owner.shareableLockSafety ?? 'strict') === 'strict'
  );
}

function sameIdentity(
  left: FileIdentity | undefined,
  right: FileIdentity | undefined
): boolean {
  if (!left || !right) return left === right;
  return left.device === right.device && left.inode === right.inode;
}

function identityKey(identity: FileIdentity): string {
  return `${identity.device.toString()}:${identity.inode.toString()}`;
}

function assertSafeFilesystem(databasePath: string): void {
  if (typeof fs.statfsSync !== 'function') return;
  let probe = databasePath;
  while (true) {
    try {
      const type = Number(fs.statfsSync(probe, {bigint: true}).type);
      if (UNSAFE_FILESYSTEM_TYPES.has(type >>> 0)) {
        throw new DuckDBUnsafeFilesystemError(databasePath);
      }
      return;
    } catch (error) {
      if (!isErrorCode(error, 'ENOENT')) throw error;
      const parent = path.dirname(probe);
      if (parent === probe) throw error;
      probe = parent;
    }
  }
}

// Linux filesystem magic values for common distributed/remote filesystems.
// DuckDB's local-file lock is not a distributed lease, so shareable mode
// fails closed rather than inferring correctness from a successful statfs().
const UNSAFE_FILESYSTEM_TYPES = new Set([
  0x0000517b, // SMB
  0x0000564c, // NCP
  0x00006969, // NFS
  0x00c36400, // Ceph
  0x01021997, // v9fs / WSL DrvFS
  0x01161970, // GFS2
  0x0bd00bd0, // Lustre
  0x47504653, // GPFS
  0x5346414f, // AFS
  0x65735546, // FUSE (including sshfs, rclone, and GlusterFS clients)
  0x6b414653, // AFS_FS
  0x73757245, // Coda
  0x7461636f, // OCFS2
  0xfe534d42, // SMB2
  0xff534d42, // CIFS
]);

function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function isAtomicPublicationUnsupported(error: unknown): boolean {
  return ['EXDEV', 'ENOSYS', 'ENOTSUP', 'EOPNOTSUPP', 'EPERM'].some(code =>
    isErrorCode(error, code)
  );
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
