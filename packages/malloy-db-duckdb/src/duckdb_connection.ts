/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DuckDBCommon} from './duckdb_common';
import {DuckDBInstance, StatementType} from '@duckdb/node-api';
import type {DuckDBConnection as DuckDBNodeConnection} from '@duckdb/node-api';
import fs from 'fs';
import path from 'path';
import {performance} from 'perf_hooks';
import {isMainThread} from 'worker_threads';
import type {
  ConnectionConfig,
  MalloyQueryData,
  QueryRecord,
  QueryOptionsReader,
  RunSQLOptions,
  TemporaryTableRunOptions,
} from '@malloydata/malloy';
import {makeDigest} from '@malloydata/malloy';
import packageJson from '@malloydata/malloy/package.json';
import {
  buildDuckDBShareKey,
  DEFAULT_SHAREABLE_ATTACH_ALIAS,
  NATURAL_SHAREABLE_ATTACH_ALIAS,
  normalizeDuckDBConfig,
  sqlIdentifierLiteral,
  sqlStringListLiteral,
  sqlStringLiteral,
  stringifyDuckDBOption,
  type NormalizedDuckDBConfig,
} from './duckdb_config';
import {
  acquireDuckDBPhysicalTarget,
  DuckDBPhysicalTargetBusyError,
  type DuckDBPhysicalTargetLease,
  type DuckDBTargetOwner,
} from './duckdb_physical_target_broker';

export interface DuckDBConnectionOptions extends ConnectionConfig {
  additionalExtensions?: string[] | string;
  databasePath?: string;
  motherDuckToken?: string;
  workingDirectory?: string;
  readOnly?: boolean;
  setupSQL?: string;
  securityPolicy?: 'none' | 'local' | 'sandboxed';
  allowedDirectories?: string[];
  enableExternalAccess?: boolean;
  lockConfiguration?: boolean;
  autoloadKnownExtensions?: boolean;
  autoinstallKnownExtensions?: boolean;
  allowCommunityExtensions?: boolean;
  allowUnsignedExtensions?: boolean;
  tempFileEncryption?: boolean;
  threads?: number;
  memoryLimit?: string;
  tempDirectory?: string;
  extensionDirectory?: string;
  shareable?: boolean;
  shareableLockSafety?: 'strict' | 'best-effort';
  shareableAttachAlias?: string;
}

type ShareableAttachmentState =
  | {status: 'detached'}
  | {status: 'attached'; catalog: string; oid: string}
  | {status: 'discovering'};

interface ActiveDB {
  instance: DuckDBInstance;
  connections: DuckDBNodeConnection[];
  pendingConnections: number;
  targetLease?: DuckDBPhysicalTargetLease;
  poisonError?: Error;
  lockedSetup?: Promise<void>;
}

interface BootstrapQuarantine {
  instance?: DuckDBInstance;
  readonly stagingDirectory: string;
}

interface StreamOperationControl {
  readonly abortController: AbortController;
  ownsLifecycle: boolean;
  nativeConnection?: DuckDBNodeConnection;
  targetLease?: DuckDBPhysicalTargetLease;
}

const PHYSICAL_TARGET_WAIT_TIMEOUT_MS = 30_000;
const SHAREABLE_LOCK_RETRY_INITIAL_DELAY_MS = 10;
const SHAREABLE_LOCK_RETRY_MAX_DELAY_MS = 1_000;

export class DuckDBConnection extends DuckDBCommon {
  public readonly name: string;
  public readonly runSQLWithTemporaryTable?: (
    sqlCommand: string,
    buildConsumerSQL: (tableName: string) => string,
    options?: TemporaryTableRunOptions
  ) => Promise<MalloyQueryData>;
  private readonly normalized: NormalizedDuckDBConfig;
  private readonly shareKey: string;
  private readonly digestDatabasePath: string;
  private readonly digestWorkingDirectory?: string;
  private readonly digestSetupSQL?: string;
  private readonly lifecycle = new AsyncFIFOMutex();
  private readonly targetOwnerIdentity = {};
  private readonly targetOwner: DuckDBTargetOwner;
  private closeTask: Promise<void> | undefined;
  private closeComplete = false;
  private targetLease: DuckDBPhysicalTargetLease | undefined;
  private attachAbortController: AbortController | undefined;
  private readonly activeStreams = new Set<ManagedDuckDBStream>();
  private readonly manifestTemporaryTables = new Set<string>();
  private dataGeneration = 0;
  private initGeneration = 0;
  private operationAbortSignal: AbortSignal | undefined;
  private brokerYieldIntent: DuckDBPhysicalTargetLease | undefined;
  private idleIntentCount = 0;
  private setupTainted = false;
  private bootstrapQuarantine: BootstrapQuarantine | undefined;

  connecting: Promise<void>;
  protected connection: DuckDBNodeConnection | null = null;
  protected setupError: Error | undefined;
  private retryableInitError: Error | undefined;
  protected isSetup: Promise<void> | undefined;
  /**
   * Set by `close()`. Once true, `setup()` throws and no operation will
   * reattach. This is the "poison pill" that distinguishes terminal close
   * from reversible idle.
   */
  protected closed = false;

  /**
   * Shareable mode only. The DuckDBInstance backing this connection's
   * `:memory:` primary database. Not shared via `activeDBs` because each
   * shareable connection independently ATTACHes/DETACHes the real file —
   * there is nothing to pool. Closed in `close()`.
   */
  private ownedInstance: DuckDBInstance | null = null;

  /**
   * Shareable mode only. Tracks the catalog name DuckDB actually assigned to
   * the attached file. Natural catalog names must be discovered from DuckDB,
   * rather than guessed from the path, because DuckDB owns filename parsing.
   * `discovering` covers the whole ATTACH/discovery window, so even an
   * ambiguous command failure can only be recovered through terminal cleanup.
   */
  private shareableAttachment: ShareableAttachmentState = {
    status: 'detached',
  };

  /**
   * Shareable mode only. True after the first successful run of the
   * once-per-connection portion of `setupOnce()` (baseline `SET`s,
   * extension `LOAD`s, user `setupSQL`, `lockConfiguration`). Those run
   * against the persistent `:memory:` primary and must NOT re-run on
   * later wake-ups: user `setupSQL` may be non-idempotent, and any later
   * `SET` would fail under `lockConfiguration=true`. Wake-ups still
   * re-ATTACH the real file because that's the bit DETACH released.
   */
  private connectionSetupRan = false;

  static activeDBs: Record<string, ActiveDB> = {};
  private static activeDBInitializers: Record<string, Promise<ActiveDB>> = {};
  private static lockedSetupSequence = 0;

  public constructor(
    options: DuckDBConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  public constructor(
    name: string,
    databasePath?: string,
    workingDirectory?: string,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    arg: string | DuckDBConnectionOptions,
    arg2?: string | QueryOptionsReader,
    workingDirectory?: string,
    queryOptions?: QueryOptionsReader
  ) {
    super();

    const options =
      typeof arg === 'string'
        ? buildLegacyOptions(arg, arg2, workingDirectory)
        : arg;
    this.name = options.name;

    if (typeof arg === 'string') {
      if (queryOptions) {
        this.queryOptions = queryOptions;
      }
    } else if (arg2) {
      this.queryOptions = arg2 as QueryOptionsReader;
    }

    this.digestDatabasePath = options.databasePath ?? ':memory:';
    this.digestWorkingDirectory = options.workingDirectory;
    this.digestSetupSQL =
      typeof options.setupSQL === 'string' ? options.setupSQL : undefined;

    this.normalized = normalizeDuckDBConfig(options);
    if (this.normalized.effectiveShareable) {
      this.runSQLWithTemporaryTable = (sqlCommand, buildConsumerSQL, options) =>
        this.runSQLWithScopedTemporaryTable(
          sqlCommand,
          buildConsumerSQL,
          options
        );
    }
    const baseShareKey = buildDuckDBShareKey(this.normalized);
    this.shareKey =
      !this.normalized.effectiveShareable &&
      this.normalized.lockConfiguration === true &&
      this.normalized.setupSQL !== undefined
        ? makeDigest(
            baseShareKey,
            'exclusive-locked-setup',
            String(++DuckDBConnection.lockedSetupSequence)
          )
        : baseShareKey;
    this.isMotherDuck =
      this.normalized.databasePath.startsWith('md:') ||
      this.normalized.databasePath.startsWith('motherduck:');
    this.motherDuckToken = this.normalized.motherDuckToken;
    this.setupSQL = this.normalized.setupSQL;
    this.targetOwner = {
      identity: this.targetOwnerIdentity,
      mode: 'shareable',
      shareableLockSafety: this.normalized.shareableLockSafety,
      description: `shareable DuckDB connection "${this.name}"`,
      requestYield: expectedLease => this.requestBrokerYield(expectedLease),
    };
    this.connecting = this.init();
  }

  public getDigest(): string {
    const digestParts = [
      'duckdb',
      this.digestDatabasePath,
      this.digestWorkingDirectory,
      this.digestSetupSQL,
    ];
    if (this.normalized.effectiveShareable) {
      const alias = this.normalized.shareableAttachAlias;
      if (alias === NATURAL_SHAREABLE_ATTACH_ALIAS) {
        // Natural catalog identity changes persisted view resolution relative
        // to the historical fixed alias, so it must use a distinct BuildID.
        digestParts.push('shareable-natural-catalog-v1');
      } else if (alias !== DEFAULT_SHAREABLE_ATTACH_ALIAS) {
        digestParts.push('shareableAttachAlias', alias);
      }
    }
    return makeDigest(...digestParts);
  }

  private async init(): Promise<void> {
    const generation = this.initGeneration;
    try {
      if (this.normalized.effectiveShareable) {
        const instance = await DuckDBInstance.create(
          ':memory:',
          this.buildInstanceOptions({forShareablePrimary: true})
        );
        // Publish the instance before connect(). If both connect and immediate
        // close fail, terminal close must retain a handle it can retry instead
        // of silently losing the native resource.
        this.ownedInstance = instance;
        let connection: DuckDBNodeConnection | undefined;
        try {
          connection = await instance.connect();
          this.connection = connection;
          this.retryableInitError = undefined;
          // close() waits for connecting before cleanup. Publishing a late
          // handle here lets that cleanup retry instead of losing a native
          // resource if disconnect/close itself fails.
          if (this.closed || generation !== this.initGeneration) return;
        } catch (error) {
          const cleanupErrors: Error[] = [];
          if (connection) {
            try {
              connection.disconnectSync();
              connection = undefined;
            } catch (cleanupError) {
              cleanupErrors.push(asError(cleanupError));
            }
          }
          try {
            instance.closeSync();
            if (this.ownedInstance === instance) this.ownedInstance = null;
          } catch (cleanupError) {
            cleanupErrors.push(asError(cleanupError));
          }
          if (cleanupErrors.length > 0) {
            throw combinedError(
              [asError(error), ...cleanupErrors],
              'DuckDB shareable primary initialization and native cleanup both failed'
            );
          }
          throw error;
        }
        return;
      }

      let activeDB = DuckDBConnection.activeDBs[this.shareKey];
      if (!activeDB) {
        activeDB = await this.getOrCreateActiveDB();
      }
      if (activeDB.poisonError) throw activeDB.poisonError;
      activeDB.pendingConnections++;
      let connection: DuckDBNodeConnection | undefined;
      try {
        connection = await activeDB.instance.connect();
        this.connection = connection;
        activeDB.connections.push(connection);
        this.retryableInitError = undefined;
        // As above, a terminal close owns cleanup of any late native handle.
        if (this.closed || generation !== this.initGeneration) return;
      } finally {
        activeDB.pendingConnections--;
        this.cleanupUnusedActiveDB(activeDB);
      }
    } catch (err) {
      if (!this.closed && generation === this.initGeneration) {
        const error = asError(err);
        if (
          !this.normalized.effectiveShareable &&
          (error instanceof DuckDBPhysicalTargetBusyError ||
            isDuckDBLockConflict(error))
        ) {
          this.retryableInitError = error;
        } else {
          this.setupError = error;
        }
      }
    }
  }

  private async getOrCreateActiveDB(): Promise<ActiveDB> {
    const cached = DuckDBConnection.activeDBs[this.shareKey];
    if (cached) return cached;

    let initializer = DuckDBConnection.activeDBInitializers[this.shareKey];
    if (!initializer) {
      initializer = this.createActiveDB();
      DuckDBConnection.activeDBInitializers[this.shareKey] = initializer;
      void initializer.then(
        activeDB => {
          if (
            DuckDBConnection.activeDBInitializers[this.shareKey] === initializer
          ) {
            DuckDBConnection.activeDBs[this.shareKey] = activeDB;
            delete DuckDBConnection.activeDBInitializers[this.shareKey];
          }
        },
        () => {
          if (
            DuckDBConnection.activeDBInitializers[this.shareKey] === initializer
          ) {
            delete DuckDBConnection.activeDBInitializers[this.shareKey];
          }
        }
      );
    }
    return initializer;
  }

  private async createActiveDB(): Promise<ActiveDB> {
    const localFile = isLocalDuckDBFile(this.normalized.databasePath);
    const owner: DuckDBTargetOwner = {
      identity: {},
      mode: 'direct',
      description: `non-shareable DuckDB instance for "${this.normalized.databasePath}"`,
    };
    // activeDBs and the physical-target broker are realm-local. Preserve the
    // pre-broker behavior for ordinary worker-thread connections; shareable
    // local files still enter the broker and fail with a typed realm error.
    const targetLease =
      localFile && isMainThread
        ? await acquireDuckDBPhysicalTarget(
            this.normalized.databasePath,
            owner,
            {
              timeoutMs: PHYSICAL_TARGET_WAIT_TIMEOUT_MS,
            }
          )
        : undefined;
    let instance: DuckDBInstance | undefined;
    try {
      targetLease?.assertSafeBeforeOpen();
      instance = await DuckDBInstance.create(
        this.normalized.databasePath,
        this.buildInstanceOptions()
      );
      targetLease?.confirmOpen();
      return {instance, connections: [], pendingConnections: 0, targetLease};
    } catch (error) {
      let instanceClosed = instance === undefined;
      let closeError: Error | undefined;
      if (instance) {
        try {
          instance.closeSync();
          instanceClosed = true;
        } catch (cleanupFailure) {
          closeError = asError(cleanupFailure);
        }
      }
      if (instanceClosed) {
        targetLease?.release();
      } else if (instance && targetLease) {
        const poisonError = combinedError(
          [asError(error), closeError!],
          'DuckDB open failed and its native instance could not be quarantined cleanly'
        );
        DuckDBConnection.activeDBs[this.shareKey] = {
          instance,
          connections: [],
          pendingConnections: 0,
          targetLease,
          poisonError,
        };
        throw poisonError;
      }
      throw error;
    }
  }

  /**
   * A lease acquired for a missing pathname has no inode to fence. Build a
   * valid DuckDB file under a private sibling name, close it completely, then
   * let the broker publish it with link(2)'s atomic no-replace semantics.
   */
  private async initializePhysicalTarget(
    lease: DuckDBPhysicalTargetLease,
    signal: AbortSignal
  ): Promise<void> {
    const priorCleanupError = this.cleanupBootstrapQuarantine();
    if (priorCleanupError) throw priorCleanupError;
    if (!lease.requiresInitialization) return;
    if (this.normalized.readOnly) {
      lease.assertSafeBeforeOpen();
      return;
    }
    throwIfAborted(signal);

    const parent = path.dirname(this.normalized.databasePath);
    const stagingDirectory = fs.mkdtempSync(
      path.join(parent, '.malloy-duckdb-bootstrap-')
    );
    const preparedPath = path.join(stagingDirectory, 'database.duckdb');
    let instance: DuckDBInstance | undefined;
    let operationError: Error | undefined;
    try {
      instance = await DuckDBInstance.create(preparedPath, {
        custom_user_agent: `Malloy/${packageJson.version}`,
      });
      instance.closeSync();
      instance = undefined;
      // Publication is the commit point. Cancellation before this point must
      // not leave a newly visible database behind.
      throwIfAborted(signal);
      lease.publishPreparedTarget(preparedPath);
    } catch (error) {
      operationError = asError(error);
    }

    const cleanupErrors: Error[] = [];
    if (instance) {
      try {
        instance.closeSync();
        instance = undefined;
      } catch (error) {
        cleanupErrors.push(asError(error));
        // Keep both the native handle and its private directory reachable. The
        // physical-target lease remains held until a later setup/close retries
        // this cleanup successfully.
        this.bootstrapQuarantine = {instance, stagingDirectory};
      }
    }
    if (!this.bootstrapQuarantine) {
      try {
        fs.rmSync(stagingDirectory, {recursive: true, force: true});
      } catch (error) {
        cleanupErrors.push(asError(error));
        // Publication may already have committed even though removing the
        // now-private staging directory failed. Retain both the directory and
        // the exact physical-target lease until setup/idle/close can retry the
        // cleanup; releasing the lease here would let another owner enter
        // while this connection still has unfinished bootstrap state.
        this.bootstrapQuarantine = {stagingDirectory};
      }
    }
    if (operationError && cleanupErrors.length === 0) throw operationError;
    if (operationError || cleanupErrors.length > 0) {
      throw combinedError(
        [operationError, ...cleanupErrors].filter(
          (error): error is Error => error !== undefined
        ),
        `Failed to atomically initialize DuckDB target "${this.normalized.databasePath}"`
      );
    }
  }

  private cleanupBootstrapQuarantine(): Error | undefined {
    const quarantine = this.bootstrapQuarantine;
    if (!quarantine) return undefined;
    if (quarantine.instance) {
      try {
        quarantine.instance.closeSync();
        quarantine.instance = undefined;
      } catch (error) {
        return combinedError(
          [asError(error)],
          'Failed to retry DuckDB bootstrap native cleanup'
        );
      }
    }
    try {
      fs.rmSync(quarantine.stagingDirectory, {recursive: true, force: true});
      this.bootstrapQuarantine = undefined;
      return undefined;
    } catch (error) {
      return combinedError(
        [asError(error)],
        'Failed to retry DuckDB bootstrap directory cleanup'
      );
    }
  }

  private cleanupUnusedActiveDB(activeDB: ActiveDB): void {
    if (
      activeDB.connections.length !== 0 ||
      activeDB.pendingConnections !== 0 ||
      DuckDBConnection.activeDBs[this.shareKey] !== activeDB
    ) {
      return;
    }
    try {
      activeDB.instance.closeSync();
      activeDB.targetLease?.release();
      delete DuckDBConnection.activeDBs[this.shareKey];
    } catch (error) {
      activeDB.poisonError = asError(error);
      throw error;
    }
  }

  protected async setup(): Promise<void> {
    if (this.closed) {
      throw new Error(`DuckDB connection "${this.name}" is closed`);
    }
    if (this.setupError) {
      throw this.setupError;
    }

    await this.connecting;
    if (this.closed) {
      throw new Error(`DuckDB connection "${this.name}" is closed`);
    }
    if (this.setupError) {
      throw this.setupError;
    }
    if (this.retryableInitError) {
      const error = this.retryableInitError;
      this.retryableInitError = undefined;
      throw error;
    }

    // A retryable non-shareable initialization failure has no live native
    // handle, so retry it lazily. Healthy non-shareable idle() is a no-op;
    // shareable idle keeps its :memory: handle and only re-ATTACHes below.
    if (this.connection === null) {
      this.connecting = this.init();
      await this.connecting;
      if (this.setupError) {
        throw this.setupError;
      }
      if (this.retryableInitError) {
        const error = this.retryableInitError;
        this.retryableInitError = undefined;
        throw error;
      }
      if (this.connection === null) {
        throw new Error(
          'DuckDB connection initialization did not open a handle'
        );
      }
    }

    if (!this.isSetup) this.isSetup = this.setupOnce();
    const setupTask = this.isSetup;
    try {
      await setupTask;
    } catch (error) {
      if (
        this.isSetup === setupTask &&
        this.normalized.effectiveShareable &&
        !this.closed &&
        !this.setupTainted &&
        this.shareableAttachment.status === 'detached' &&
        (this.targetLease === undefined ||
          this.bootstrapQuarantine !== undefined)
      ) {
        // Broker busy/abort, external lock contention, and other failures
        // proven to precede ATTACH have no persistent SQL side effects.
        this.isSetup = undefined;
      }
      throw error;
    }

    if (this.normalized.effectiveShareable) {
      if (this.shareableAttachment.status !== 'attached') {
        throw new Error('DuckDB shareable target is not attached after setup');
      }
      try {
        this.targetLease?.assertUnchanged();
      } catch (error) {
        const cleanupError = this.forceCloseShareableAttachment();
        throw cleanupError
          ? combinedError(
              [asError(error), cleanupError],
              'DuckDB target identity changed and terminal cleanup failed'
            )
          : error;
      }
      await this.useShareableCatalog(this.shareableAttachment.catalog);
      return;
    }

    const activeDB = DuckDBConnection.activeDBs[this.shareKey];
    if (activeDB?.poisonError) throw activeDB.poisonError;
    try {
      activeDB?.targetLease?.assertUnchanged();
    } catch (error) {
      if (activeDB) activeDB.poisonError = asError(error);
      throw error;
    }
  }

  protected override async withConnectionOperation<T>(
    operation: () => Promise<T>,
    _context: {sql?: string} = {}
  ): Promise<T> {
    if (this.closed) {
      throw new Error(`DuckDB connection "${this.name}" is closed`);
    }
    return this.lifecycle.runExclusive(async () => {
      if (this.closed) {
        throw new Error(`DuckDB connection "${this.name}" is closed`);
      }
      await this.honorBrokerYieldIntent();
      return operation();
    });
  }

  protected override persistenceGeneration(): string | undefined {
    return this.normalized.effectiveShareable
      ? String(this.dataGeneration)
      : undefined;
  }

  protected override registerManifestTemporaryTable(tableName: string): void {
    if (this.normalized.effectiveShareable) {
      this.manifestTemporaryTables.add(tableName);
    }
  }

  protected override unregisterManifestTemporaryTable(tableName: string): void {
    this.manifestTemporaryTables.delete(tableName);
  }

  protected override async validateUserSQL(sql: string): Promise<void> {
    if (!this.normalized.effectiveShareable || sql.trim() === '') return;
    if (!this.connection) throw new Error('Connection not open');

    const statementKeywords = topLevelStatementKeywords(sql);
    const extracted = await this.connection.extractStatements(sql);
    if (extracted.count !== statementKeywords.length) {
      throw new DuckDBShareableUnsupportedSQLError(
        'DuckDB shareable SQL could not be classified safely; submit each statement as a separate operation'
      );
    }
    for (const keyword of statementKeywords) {
      if (SHAREABLE_FORBIDDEN_STATEMENT_KEYWORDS.has(keyword)) {
        throw new DuckDBShareableUnsupportedSQLError(
          'DuckDB shareable connections do not allow ATTACH, DETACH, USE, prepared-statement lifecycle, or transaction-control SQL; use one autocommit Malloy operation so the physical-file broker can safely hand off ownership'
        );
      }
    }
  }

  protected override async validateTemporaryTableConsumerSQL(
    sql: string
  ): Promise<void> {
    if (!this.normalized.effectiveShareable) return;
    if (!this.connection) throw new Error('Connection not open');

    const extracted = await this.connection.extractStatements(sql);
    if (extracted.count !== 1) {
      throw new DuckDBShareableUnsupportedSQLError(
        'DuckDB scoped TEMP consumers must contain exactly one read-only SELECT statement'
      );
    }
    const prepared = await extracted.prepare(0);
    try {
      if (prepared.statementType !== StatementType.SELECT) {
        throw new DuckDBShareableUnsupportedSQLError(
          'DuckDB scoped TEMP consumers must be a read-only SELECT statement'
        );
      }
    } finally {
      prepared.destroySync();
    }
  }

  private async setupOnce(): Promise<void> {
    if (
      !this.normalized.effectiveShareable &&
      this.normalized.lockConfiguration
    ) {
      const activeDB = DuckDBConnection.activeDBs[this.shareKey];
      if (!activeDB) {
        throw new Error('DuckDB shared instance disappeared during setup');
      }
      // lock_configuration is instance-wide. Identically configured
      // connections share one ActiveDB, so only the first connection may
      // apply the baseline and lock it; all later handles inherit that frozen
      // instance state. The promise is the setup analogue of createActiveDB's
      // singleflight and prevents two first-use calls from racing SETs.
      activeDB.lockedSetup ??= this.setupConnectionState({
        globalBaseline: true,
      });
      await activeDB.lockedSetup;
      this.connectionSetupRan = true;
      return;
    }
    await this.setupConnectionState();
  }

  private async setupConnectionState({
    globalBaseline = false,
  }: {globalBaseline?: boolean} = {}): Promise<void> {
    // In non-shareable mode this method runs once for the live native handle.
    // Healthy idle() deliberately preserves that handle and its setup state.
    //
    // In shareable mode the `:memory:` primary survives idle and so does
    // its connection-level state. Replaying the baseline + user setupSQL
    // on a second wake would re-execute non-idempotent user statements
    // (CREATE TABLE, INSERT, ...) and would also fail outright under
    // `lockConfiguration=true` because subsequent `SET`s are rejected
    // once configuration is locked. Gate everything except the ATTACH on
    // `connectionSetupRan` so it only runs the first time.
    const reattachOnly =
      this.normalized.effectiveShareable && this.connectionSetupRan;

    if (!reattachOnly) {
      await this.applyFinalBaseline({global: globalBaseline});
    }
    await this.attachIfShareable();

    if (!reattachOnly) {
      if (this.normalized.setupSQL) {
        this.setupTainted = true;
        for (const statement of splitSetupSQL(this.normalized.setupSQL)) {
          await this.validateUserSQL(statement);
          await this.runDuckDBQuery(statement);
        }
      }
      if (this.normalized.lockConfiguration) {
        this.setupTainted = true;
        await this.runDuckDBQuery('SET lock_configuration=true');
      }
      this.connectionSetupRan = true;
      this.setupTainted = false;
    }
  }

  /**
   * Shareable mode: ATTACH the real database file into the in-memory
   * primary and `USE` it, so unqualified table refs resolve into the attached
   * file. The `auto` alias mode omits `AS` and discovers DuckDB's natural
   * catalog identity for catalog-qualified persisted views. Runs after
   * `applyFinalBaseline()` so the corresponding `SET allowed_directories`
   * (sandboxed mode) has already been applied.
   */
  private async attachIfShareable(): Promise<void> {
    if (!this.normalized.effectiveShareable) return;
    // close() can run while setup is awaiting baseline SQL, before this
    // method has installed attachAbortController. Make the close state
    // level-triggered at the ATTACH boundary so that missed edge cannot
    // acquire a broker lease or publish a missing database afterwards.
    if (this.closed) {
      throw new Error(`DuckDB connection "${this.name}" is closed`);
    }
    if (this.shareableAttachment.status === 'discovering') {
      throw new Error(
        `DuckDB shareable attachment state is ${this.shareableAttachment.status}; close this connection before retrying`
      );
    }
    if (this.shareableAttachment.status === 'attached') {
      this.targetLease?.assertUnchanged();
      await this.useShareableCatalog(this.shareableAttachment.catalog);
      return;
    }

    const abortController = new AbortController();
    this.attachAbortController = abortController;
    const {signal} = abortController;
    const operationSignal = this.operationAbortSignal;
    const forwardOperationAbort = () => {
      if (operationSignal) {
        abortController.abort(abortReason(operationSignal));
      }
    };
    if (operationSignal?.aborted) {
      forwardOperationAbort();
    } else {
      operationSignal?.addEventListener('abort', forwardOperationAbort, {
        once: true,
      });
    }
    try {
      // Pair controller publication with a level check, like registering a
      // kernel wait queue before rechecking its predicate. close() either
      // observes the controller edge or this branch observes the closed level.
      if (this.closed) {
        abortController.abort(
          new Error(`DuckDB connection "${this.name}" is closed`)
        );
      }
      throwIfAborted(signal);
      const configuredAlias =
        this.normalized.shareableAttachAlias === NATURAL_SHAREABLE_ATTACH_ALIAS
          ? undefined
          : this.normalized.shareableAttachAlias;
      if (!this.targetLease) {
        this.targetLease = await acquireDuckDBPhysicalTarget(
          this.normalized.databasePath,
          this.targetOwner,
          {signal, timeoutMs: PHYSICAL_TARGET_WAIT_TIMEOUT_MS}
        );
      }
      await this.initializePhysicalTarget(this.targetLease, signal);
      if (this.closed) {
        this.releaseTargetLease();
        throw new Error(`DuckDB connection "${this.name}" is closed`);
      }
      const lease = this.targetLease;
      lease.assertSafeBeforeOpen();

      const catalogsBefore = await this.readDuckDBCatalogsByOID();
      const readOnlyClause = this.normalized.readOnly ? ' (READ_ONLY)' : '';
      const aliasClause =
        configuredAlias === undefined
          ? ''
          : ` AS ${sqlIdentifierLiteral(configuredAlias)}`;
      const lockWaitStarted = performance.now();
      const lockWaitDeadline =
        lockWaitStarted + PHYSICAL_TARGET_WAIT_TIMEOUT_MS;
      for (let attempt = 0; ; attempt++) {
        throwIfAborted(signal);
        this.shareableAttachment = {status: 'discovering'};
        try {
          await this.runDuckDBCommand(
            `ATTACH ${sqlStringLiteral(
              this.normalized.databasePath
            )}${aliasClause}${readOnlyClause}`
          );

          const catalogsAfter = await this.readDuckDBCatalogsByOID();
          const addedCatalogs = [...catalogsAfter].filter(
            ([oid]) => !catalogsBefore.has(oid)
          );
          if (addedCatalogs.length !== 1) {
            throw new Error(
              `Expected ATTACH to add exactly one DuckDB catalog, but found ${addedCatalogs.length}`
            );
          }
          const [oid, observedName] = addedCatalogs[0];
          const catalog = configuredAlias ?? observedName;
          if (observedName !== catalog) {
            throw new Error(
              `DuckDB ATTACH published catalog "${observedName}" instead of configured catalog "${catalog}"`
            );
          }

          this.shareableAttachment = {status: 'attached', catalog, oid};
          lease.confirmOpen();
          await this.useShareableCatalog(catalog);
          return;
        } catch (error) {
          const catalogsAfter = await this.tryReadDuckDBCatalogsByOID();
          if (
            catalogsAfter &&
            sameCatalogDescriptors(catalogsBefore, catalogsAfter)
          ) {
            this.shareableAttachment = {status: 'detached'};
            if (isDuckDBLockConflict(error)) {
              const remaining = lockWaitDeadline - performance.now();
              if (remaining <= 0) {
                this.releaseTargetLease();
                throw new DuckDBLockTimeoutError(
                  this.normalized.databasePath,
                  error,
                  attempt + 1,
                  performance.now() - lockWaitStarted
                );
              }
              await abortableDelay(
                boundedLockRetryDelay(attempt, remaining),
                signal
              );
              if (performance.now() >= lockWaitDeadline) {
                this.releaseTargetLease();
                throw new DuckDBLockTimeoutError(
                  this.normalized.databasePath,
                  error,
                  attempt + 1,
                  performance.now() - lockWaitStarted
                );
              }
              lease.assertSafeBeforeOpen();
              continue;
            }
            this.releaseTargetLease();
            throw error;
          }

          const addedCatalogs = catalogsAfter
            ? [...catalogsAfter].filter(([oid]) => !catalogsBefore.has(oid))
            : [];
          if (addedCatalogs.length === 1) {
            const [oid, catalog] = addedCatalogs[0];
            this.shareableAttachment = {
              status: 'attached',
              catalog,
              oid,
            };
          }
          await this.rollbackShareableAttach(error);
        }
      }
    } catch (error) {
      // Every failure proven to precede ATTACH must drop its fencing token.
      // Ambiguous post-ATTACH failures are terminally closed by rollback.
      if (
        this.shareableAttachment.status === 'detached' &&
        this.bootstrapQuarantine === undefined
      ) {
        this.releaseTargetLease();
      }
      throw error;
    } finally {
      operationSignal?.removeEventListener('abort', forwardOperationAbort);
      if (this.attachAbortController === abortController) {
        this.attachAbortController = undefined;
      }
    }
  }

  private async readDuckDBCatalogsByOID(): Promise<Map<string, string>> {
    const {rows} = await this.runDuckDBQuery(
      'SELECT CAST(database_oid AS VARCHAR) AS database_oid, database_name FROM duckdb_databases()'
    );
    const catalogs = new Map<string, string>();
    for (const row of rows) {
      const oid = row['database_oid'];
      const name = row['database_name'];
      if (typeof oid !== 'string' || typeof name !== 'string') {
        throw new Error('DuckDB returned an invalid catalog descriptor');
      }
      catalogs.set(oid, name);
    }
    return catalogs;
  }

  private async tryReadDuckDBCatalogsByOID(): Promise<
    Map<string, string> | undefined
  > {
    try {
      return await this.readDuckDBCatalogsByOID();
    } catch {
      return undefined;
    }
  }

  private async useShareableCatalog(catalog: string): Promise<void> {
    await this.runDuckDBCommand(
      `USE ${sqlIdentifierLiteral(catalog)}.${sqlIdentifierLiteral('main')}`
    );
  }

  private async rollbackShareableAttach(error: unknown): Promise<never> {
    if (this.shareableAttachment.status === 'attached') {
      try {
        await this.detachShareableFile();
      } catch (rollbackError) {
        const cleanupError = this.forceCloseShareableAttachment();
        throw combinedError(
          [asError(error), asError(rollbackError), cleanupError].filter(
            (item): item is Error => item !== undefined
          ),
          'DuckDB shareable ATTACH failed and rollback could not detach the database'
        );
      }
      throw error;
    }

    const cleanupError = this.forceCloseShareableAttachment();
    if (cleanupError) {
      throw combinedError(
        [asError(error), cleanupError],
        'DuckDB shareable ATTACH catalog discovery failed and terminal cleanup also failed'
      );
    }
    throw error;
  }

  /**
   * ATTACH succeeded but catalog discovery did not, so SQL cannot name the
   * database for DETACH. This happens before setup completes and before any
   * Malloy cache can retain native connection state, making a terminal native
   * disconnect safe here (unlike the normal idle path; see detachInstance()).
   */
  private forceCloseShareableAttachment(): Error | undefined {
    const errors: Error[] = [];
    if (this.connection) {
      try {
        this.connection.disconnectSync();
        this.connection = null;
      } catch (error) {
        errors.push(asError(error));
      }
    }
    if (this.ownedInstance) {
      try {
        this.ownedInstance.closeSync();
        this.ownedInstance = null;
      } catch (error) {
        errors.push(asError(error));
      }
    }
    const bootstrapCleanupError = this.cleanupBootstrapQuarantine();
    if (bootstrapCleanupError) errors.push(bootstrapCleanupError);
    this.closed = true;
    if (
      this.connection === null &&
      this.ownedInstance === null &&
      this.bootstrapQuarantine === undefined
    ) {
      this.manifestTemporaryTables.clear();
      this.finishShareableDetach();
    }
    return errors.length === 0
      ? undefined
      : combinedError(errors, 'Failed to close DuckDB shareable attachment');
  }

  private buildInstanceOptions(opts?: {
    forShareablePrimary?: boolean;
  }): Record<string, string> {
    const forShareablePrimary = opts?.forShareablePrimary === true;
    const options: Record<string, string> = {
      custom_user_agent: `Malloy/${packageJson.version}`,
    };

    if (this.normalized.motherDuckToken !== undefined) {
      options['motherduck_token'] = this.normalized.motherDuckToken;
    }
    // In shareable mode the primary is :memory: and must stay writable —
    // temp tables, manifestTemporaryTable, and search-index work all live
    // there. The user's `readOnly` applies to the ATTACHed real file via
    // `(READ_ONLY)` in attachIfShareable().
    if (this.normalized.readOnly && !forShareablePrimary) {
      options['access_mode'] = 'READ_ONLY';
    }
    if (this.normalized.autoloadKnownExtensions !== undefined) {
      options['autoload_known_extensions'] = stringifyDuckDBOption(
        this.normalized.autoloadKnownExtensions
      );
    }
    if (this.normalized.autoinstallKnownExtensions !== undefined) {
      options['autoinstall_known_extensions'] = stringifyDuckDBOption(
        this.normalized.autoinstallKnownExtensions
      );
    }
    if (this.normalized.allowCommunityExtensions !== undefined) {
      options['allow_community_extensions'] = stringifyDuckDBOption(
        this.normalized.allowCommunityExtensions
      );
    }
    if (this.normalized.allowUnsignedExtensions !== undefined) {
      options['allow_unsigned_extensions'] = stringifyDuckDBOption(
        this.normalized.allowUnsignedExtensions
      );
    }
    if (this.normalized.tempFileEncryption !== undefined) {
      options['temp_file_encryption'] = stringifyDuckDBOption(
        this.normalized.tempFileEncryption
      );
    }
    if (this.normalized.threads !== undefined) {
      options['threads'] = stringifyDuckDBOption(this.normalized.threads);
    }
    if (this.normalized.memoryLimit !== undefined) {
      options['memory_limit'] = this.normalized.memoryLimit;
    }
    if (this.normalized.tempDirectory !== undefined) {
      options['temp_directory'] = this.normalized.tempDirectory;
    }
    if (this.normalized.extensionDirectory !== undefined) {
      options['extension_directory'] = this.normalized.extensionDirectory;
    }
    if (this.shouldApplyEnableExternalAccessAtOpenTime()) {
      options['enable_external_access'] = stringifyDuckDBOption(
        this.normalized.enableExternalAccess!
      );
    }

    return options;
  }

  private shouldApplyEnableExternalAccessAtOpenTime(): boolean {
    // DuckDB's Node API does not currently accept allowed_directories as an
    // open-time option, and DuckDB rejects SET allowed_directories after
    // enable_external_access=false. Apply the disable at open time unless a
    // post-connect allowlist SET is required.
    return (
      this.normalized.enableExternalAccess !== undefined &&
      this.normalized.allowedDirectories === undefined
    );
  }

  private async applyFinalBaseline({global}: {global: boolean}): Promise<void> {
    const set = global ? 'SET GLOBAL' : 'SET';
    if (this.normalized.allowedDirectories !== undefined) {
      await this.runDuckDBQuery(
        `${set} allowed_directories=${sqlStringListLiteral(
          this.normalized.allowedDirectories
        )}`
      );
    }

    if (
      this.normalized.enableExternalAccess !== undefined &&
      !this.shouldApplyEnableExternalAccessAtOpenTime()
    ) {
      await this.runDuckDBQuery(
        `${set} enable_external_access=${this.normalized.enableExternalAccess}`
      );
    }

    if (this.normalized.workingDirectory !== undefined) {
      await this.runDuckDBQuery(
        `${set} FILE_SEARCH_PATH=${sqlStringLiteral(
          this.normalized.workingDirectory
        )}`
      );
    }

    if (this.normalized.secretDirectory !== undefined) {
      await this.runDuckDBQuery(
        `${set} secret_directory=${sqlStringLiteral(
          this.normalized.secretDirectory
        )}`
      );
    }

    // TimeZone and FILE_SEARCH_PATH are connection-local under plain SET. A
    // locked ActiveDB can add native connections after the singleflight setup
    // has completed, and lock_configuration prevents those later handles from
    // issuing SET. SET GLOBAL makes every configured baseline value an instance
    // default before locking, so existing and future handles inherit it.
    await this.runDuckDBQuery(`${set} TimeZone='UTC'`);
    await this.loadBaselineExtensions();
  }

  private async loadBaselineExtensions(): Promise<void> {
    if (this.normalized.securityPolicy !== 'none') {
      await this.loadExtension('json', {allowInstall: false, required: true});
      await this.loadExtension('icu', {allowInstall: false, required: true});
      return;
    }

    const allowInstall = this.normalized.enableExternalAccess !== false;
    await this.loadExtension('json', {allowInstall, required: false});
    await this.loadExtension('icu', {allowInstall, required: false});

    if (this.normalized.enableExternalAccess !== false) {
      await this.loadExtension('httpfs', {allowInstall, required: false});
    }

    for (const extension of this.normalized.additionalExtensions) {
      await this.loadExtension(extension, {allowInstall, required: false});
    }

    if (this.isMotherDuck) {
      await this.loadExtension('motherduck', {allowInstall, required: false});
    }
  }

  private async loadExtension(
    extension: string,
    options: {allowInstall: boolean; required: boolean}
  ): Promise<void> {
    try {
      await this.runDuckDBQuery(`LOAD ${sqlStringLiteral(extension)}`);
      return;
    } catch (loadError) {
      if (!options.allowInstall) {
        if (options.required) {
          throw loadError;
        }
        // eslint-disable-next-line no-console
        console.error(
          `Unable to load DuckDB extension "${extension}"`,
          loadError
        );
        return;
      }
    }

    try {
      await this.runDuckDBQuery(`INSTALL ${sqlStringLiteral(extension)}`);
      await this.runDuckDBQuery(`LOAD ${sqlStringLiteral(extension)}`);
    } catch (error) {
      if (options.required) {
        throw error;
      }
      // eslint-disable-next-line no-console
      console.error(`Unable to load DuckDB extension "${extension}"`, error);
    }
  }

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}> {
    if (!this.connection) {
      throw new Error('Connection not open');
    }

    const result = await this.connection.run(sql);
    const rows = (await result.getRowObjectsJson()) as QueryRecord[];

    return {
      rows,
      totalRows: rows.length,
    };
  }

  /** Execute lifecycle SQL without materializing a result that has no rows. */
  private async runDuckDBCommand(sql: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not open');
    }
    await this.connection.run(sql);
  }

  public runSQLStream(
    sql: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const control: StreamOperationControl = {
      abortController: new AbortController(),
      ownsLifecycle: false,
    };
    const cancellationReason = () =>
      abortSignal?.reason instanceof Error
        ? abortSignal.reason
        : new Error('DuckDB stream was cancelled');
    const onAbort = () => managed.cancel();
    const managed = new ManagedDuckDBStream(
      this.runSQLStreamLocked(sql, {rowLimit, abortSignal}, control),
      () => {
        const reason = cancellationReason();
        control.abortController.abort(reason);
        if (!control.ownsLifecycle) return;
        this.attachAbortController?.abort(reason);
        try {
          control.nativeConnection?.interrupt();
        } catch {
          // The running native promise remains the authority for completion.
        }
      },
      expectedLease =>
        control.ownsLifecycle && this.targetLease === expectedLease,
      () => {
        const lease = control.targetLease;
        if (
          !lease ||
          !control.ownsLifecycle ||
          this.targetLease !== lease ||
          !lease.isYieldRequested
        ) {
          return;
        }
        this.requestBrokerYield(lease);
      },
      () => {
        this.activeStreams.add(managed);
        abortSignal?.addEventListener('abort', onAbort, {once: true});
        if (abortSignal?.aborted) {
          control.abortController.abort(cancellationReason());
        }
      },
      () => {
        this.activeStreams.delete(managed);
        abortSignal?.removeEventListener('abort', onAbort);
      }
    );
    return managed;
  }

  private async *runSQLStreamLocked(
    sql: string,
    {rowLimit, abortSignal}: RunSQLOptions,
    control: StreamOperationControl
  ): AsyncIterableIterator<QueryRecord> {
    if (this.closed) {
      throw new Error(`DuckDB connection "${this.name}" is closed`);
    }
    const release = await this.lifecycle.acquire(
      control.abortController.signal
    );
    control.ownsLifecycle = true;
    this.operationAbortSignal = control.abortController.signal;
    try {
      if (this.closed) {
        throw new Error(`DuckDB connection "${this.name}" is closed`);
      }
      this.throwIfIdleIntent();
      await this.honorBrokerYieldIntent();
      const defaultOptions = this.readQueryOptions();
      rowLimit ??= defaultOptions.rowLimit;
      await this.setup();
      control.targetLease = this.targetLease;
      this.throwIfIdleIntent();
      if (!this.connection) {
        throw new Error('Connection not open');
      }

      const nativeConnection = this.connection;
      control.nativeConnection = nativeConnection;
      throwIfAborted(control.abortController.signal);

      const statements = sql.split('-- hack: split on this');
      while (statements.length > 1) {
        await this.validateUserSQL(statements[0]);
        await this.runDuckDBQuery(statements[0]);
        statements.shift();
      }
      await this.validateUserSQL(statements[0]);
      const result = await nativeConnection.stream(statements[0]);

      let index = 0;
      for await (const chunk of result.yieldRowObjectJson()) {
        for (const row of chunk) {
          this.throwIfIdleIntent();
          if (
            (rowLimit !== undefined && index >= rowLimit) ||
            abortSignal?.aborted
          ) {
            return;
          }
          index++;
          yield row as QueryRecord;
        }
      }
    } finally {
      if (this.operationAbortSignal === control.abortController.signal) {
        this.operationAbortSignal = undefined;
      }
      control.nativeConnection = undefined;
      control.targetLease = undefined;
      control.ownsLifecycle = false;
      release();
    }
  }

  close(): Promise<void> {
    if (this.closeComplete) return Promise.resolve();
    if (this.closeTask) return this.closeTask;
    this.closed = true;
    this.initGeneration++;
    this.attachAbortController?.abort(
      new Error(`DuckDB connection "${this.name}" is closed`)
    );
    for (const stream of this.activeStreams) stream.cancel();
    try {
      this.connection?.interrupt();
    } catch {
      // The lifecycle task still waits for the native operation to settle.
    }
    const task = this.lifecycle.runExclusive(() => this.closeLocked());
    this.closeTask = task;
    void task.then(
      () => {
        this.closeComplete = true;
        if (this.closeTask === task) this.closeTask = undefined;
      },
      () => {
        if (this.closeTask === task) this.closeTask = undefined;
      }
    );
    return task;
  }

  private async closeLocked(): Promise<void> {
    await this.connecting;
    const errors: Error[] = [];
    if (this.normalized.effectiveShareable) {
      if (
        this.shareableAttachment.status === 'attached' &&
        this.connection !== null
      ) {
        try {
          await this.detachShareableFile();
        } catch (error) {
          errors.push(asError(error));
        }
      }
      const cleanupError = this.forceCloseShareableAttachment();
      if (cleanupError) errors.push(cleanupError);
    } else {
      const cleanupError = this.detachInstance(true);
      if (cleanupError) errors.push(cleanupError);
    }
    const cleanupComplete = this.normalized.effectiveShareable
      ? this.connection === null &&
        this.ownedInstance === null &&
        this.bootstrapQuarantine === undefined &&
        this.targetLease === undefined
      : this.connection === null;
    if (cleanupComplete) {
      this.isSetup = undefined;
      this.setupError = undefined;
      this.retryableInitError = undefined;
      this.shareableAttachment = {status: 'detached'};
    }
    this.closed = true;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw combinedError(errors, 'Failed to close DuckDB connection');
    }
  }

  async idle(): Promise<void> {
    if (this.closed) {
      if (!this.closeComplete) await this.close();
      return;
    }
    // No-op for in-memory: closing the instance silently destroys state.
    if (this.normalized.databasePath === ':memory:') return;

    if (!this.normalized.effectiveShareable) return;
    this.idleIntentCount++;
    const lease = this.targetLease;
    if (lease?.isHeld) {
      const reason = new DuckDBStreamLeaseRevokedError(
        `DuckDB stream on "${this.name}" was revoked at a yielded-row safepoint because the connection was idled`
      );
      for (const stream of this.activeStreams) {
        stream.revokeWhenPaused(reason, lease, {requireYieldRequest: false});
      }
    }
    await this.lifecycle.runExclusive(async () => {
      try {
        if (this.closed) return;
        await this.detachShareableFile();
      } finally {
        // Clear this request while still holding the lifecycle mutex. A
        // stream admitted after this idle must not observe a stale intent.
        this.idleIntentCount--;
      }
    });
  }

  private throwIfIdleIntent(): void {
    if (this.idleIntentCount === 0) return;
    throw new DuckDBStreamLeaseRevokedError(
      `DuckDB stream on "${this.name}" was revoked before pausing because the connection was idled`
    );
  }

  private async detachShareableFile(): Promise<void> {
    if (!this.normalized.effectiveShareable) return;
    if (this.shareableAttachment.status === 'detached') {
      const cleanupError = this.cleanupBootstrapQuarantine();
      if (cleanupError) throw cleanupError;
      if (this.targetLease) this.finishShareableDetach();
      return;
    }
    if (this.shareableAttachment.status === 'discovering') {
      throw new Error(
        `Cannot detach DuckDB shareable database because its state is ${this.shareableAttachment.status}`
      );
    }
    if (!this.connection) {
      throw new Error(
        'Cannot detach DuckDB shareable database: connection closed'
      );
    }

    const {catalog, oid} = this.shareableAttachment;
    let switchedToMemory = false;
    try {
      await this.runDuckDBCommand(
        `USE ${sqlIdentifierLiteral('memory')}.${sqlIdentifierLiteral('main')}`
      );
      switchedToMemory = true;
      await this.runDuckDBCommand(`DETACH ${sqlIdentifierLiteral(catalog)}`);
      this.finishShareableDetach();
    } catch (error) {
      const catalogsAfter = await this.tryReadDuckDBCatalogsByOID();
      if (catalogsAfter && !catalogsAfter.has(oid)) {
        // DETACH took effect but its shutdown checkpoint/wrapper failed. The
        // durability error still propagates, while ownership is now released
        // according to the verified catalog postcondition.
        this.finishShareableDetach();
        throw error;
      }
      if (switchedToMemory) {
        try {
          await this.useShareableCatalog(catalog);
        } catch (restoreError) {
          const cleanupError = this.forceCloseShareableAttachment();
          throw combinedError(
            [asError(error), asError(restoreError), cleanupError].filter(
              (item): item is Error => item !== undefined
            ),
            `Failed to detach DuckDB catalog "${catalog}", restore it as the default catalog, and terminally close the connection`
          );
        }
      }
      throw error;
    }
  }

  private finishShareableDetach(): void {
    const hadLease = this.targetLease !== undefined;
    this.releaseTargetLease();
    this.shareableAttachment = {status: 'detached'};
    if (hadLease) {
      this.dataGeneration++;
      this.invalidateSchemaCache();
      if (!this.setupTainted) this.isSetup = undefined;
    }
  }

  private releaseTargetLease(): void {
    const lease = this.targetLease;
    if (!lease) return;
    if (this.brokerYieldIntent === lease) {
      this.brokerYieldIntent = undefined;
    }
    lease.release();
    if (this.targetLease === lease) this.targetLease = undefined;
  }

  private requestBrokerYield(expectedLease: DuckDBPhysicalTargetLease): void {
    if (this.targetLease !== expectedLease || !expectedLease.isYieldRequested) {
      return;
    }
    this.brokerYieldIntent = expectedLease;
    const revocationError = new DuckDBStreamLeaseRevokedError(
      `DuckDB stream on "${this.name}" was revoked at a yielded-row safepoint so another connection could acquire the physical database`
    );
    for (const stream of this.activeStreams) {
      stream.revokeWhenPaused(revocationError, expectedLease);
    }
    void this.lifecycle
      .runExclusive(async () => {
        if (this.closed) {
          // Terminal cleanup may itself be quarantined after a partial native
          // close. Do not leave a newly arrived waiter sleeping until its
          // timeout: fail it immediately and queue another cleanup attempt
          // after this lifecycle critical section releases.
          if (this.targetLease === expectedLease && expectedLease.isHeld) {
            expectedLease.rejectWaiters(
              new Error(
                `DuckDB connection "${this.name}" is awaiting retry of terminal native cleanup`
              )
            );
            void this.close().catch(() => {
              // The exact lease remains fenced; a later lifecycle request can
              // retry cleanup again without granting unsafe ownership.
            });
          }
          return;
        }
        await this.honorBrokerYieldIntent();
      })
      .catch(() => {
        // A waiter is either released by successful DETACH or rejected above.
      });
  }

  /**
   * A broker yield request is an admission barrier, not merely another FIFO
   * work item. Operations which were already queued behind the current owner
   * must observe it before running, otherwise a local backlog could starve the
   * physical-target waiter indefinitely.
   */
  private async honorBrokerYieldIntent(): Promise<void> {
    const lease = this.targetLease;
    // The lease flag is the level-triggered source of truth. The broker's
    // callback is deliberately deferred to a microtask, so relying only on
    // the callback-populated edge leaves a lost-wakeup window in which a
    // locally queued operation can overtake an already-enqueued waiter.
    const expectedLease = lease?.isYieldRequested
      ? lease
      : this.brokerYieldIntent;
    if (!expectedLease) return;
    if (lease !== expectedLease || !expectedLease.isYieldRequested) {
      if (this.brokerYieldIntent === expectedLease) {
        this.brokerYieldIntent = undefined;
      }
      return;
    }
    try {
      await this.detachShareableFile();
      if (this.brokerYieldIntent === expectedLease) {
        this.brokerYieldIntent = undefined;
      }
    } catch (error) {
      if (this.brokerYieldIntent === expectedLease) {
        this.brokerYieldIntent = undefined;
      }
      if (lease.isHeld) {
        lease.rejectWaiters(
          new Error(
            `DuckDB connection "${this.name}" could not yield the physical database safely: ${asError(error).message}`
          )
        );
      }
      throw error;
    }
  }

  /**
   * Drop our entry from the shared `activeDBs` bookkeeping. If we were
   * the last sharer, close the underlying `DuckDBInstance`.
   *
   * NOTE: this does NOT fully release the OS file lock when other
   * processes try to open the same path. `duckdb_close` (= `closeSync`)
   * is a refcount-decrement on `shared_ptr<DatabaseInstance>`; the
   * `fcntl(F_SETLK)` lock on the storage manager's `UnixFileHandle`
   * survives until the last `shared_ptr` ref is gone, and live C++
   * `Connection` objects keep that refcount above zero via their
   * `ClientContext`. To force the lock release we'd need to also
   * `disconnectSync()` the per-connection node-api Connection — but
   * doing so unconditionally (as 0.0.389 did) crashes the language
   * server because malloy's translate/persistence layer retains
   * weak_ptrs to the destroyed C++ Connection. See the commented-out
   * code below and PR #2793 / the revert PR for context.
   *
   * Proper fix needs to coordinate disconnect with invalidation of
   * whatever caches survive idle (manifest reader is the main suspect).
   */
  private detachInstance(terminal: boolean): Error | undefined {
    const errors: Error[] = [];
    // [PR #2793, reverted] Adding `this.connection?.disconnectSync()`
    // here releases the OS file lock — but it also destroys C++ state
    // that malloy-internal caches (manifest reader, etc.) hold
    // weak_ptrs to. Result: SIGSEGV in the language server during
    // translate, or `bad_weak_ptr` exceptions surfacing as model
    // problems on next op. Left here as a marker for the proper fix.
    //
    // if (this.connection) {
    //   this.connection.disconnectSync();
    // }
    const activeDB = DuckDBConnection.activeDBs[this.shareKey];
    if (activeDB) {
      if (terminal && this.connection) {
        try {
          this.connection.disconnectSync();
          activeDB.connections = activeDB.connections.filter(
            connection => connection !== this.connection
          );
          this.connection = null;
        } catch (error) {
          errors.push(asError(error));
        }
      }
      if (
        activeDB.connections.length === 0 &&
        activeDB.pendingConnections === 0
      ) {
        try {
          activeDB.instance.closeSync();
          activeDB.targetLease?.release();
          delete DuckDBConnection.activeDBs[this.shareKey];
        } catch (error) {
          activeDB.poisonError = asError(error);
          errors.push(asError(error));
        }
      }
    } else if (terminal && this.connection) {
      try {
        this.connection.disconnectSync();
        this.connection = null;
      } catch (error) {
        errors.push(asError(error));
      }
    }
    return errors.length === 0
      ? undefined
      : combinedError(errors, 'Failed to close DuckDB instance');
  }

  /**
   * Forcefully close all cached DuckDB instances. Useful for test cleanup
   * to release file locks between test runs.
   */
  static closeAllInstances(): void {
    for (const key of Object.keys(DuckDBConnection.activeDBs)) {
      const activeDB = DuckDBConnection.activeDBs[key];
      const survivors: DuckDBNodeConnection[] = [];
      for (const connection of activeDB.connections) {
        try {
          connection.disconnectSync();
        } catch {
          survivors.push(connection);
        }
      }
      activeDB.connections = survivors;
      if (survivors.length > 0 || activeDB.pendingConnections > 0) continue;
      try {
        activeDB.instance.closeSync();
        activeDB.targetLease?.release();
        delete DuckDBConnection.activeDBs[key];
      } catch {
        // Retain the instance and its fencing token for a later cleanup retry.
      }
    }
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function combinedError(errors: Error[], message: string): Error {
  return new Error(
    `${message}: ${errors.map(error => error.message).join('; ')}`
  );
}

function buildLegacyOptions(
  name: string,
  databasePathOrQueryOptions?: string | QueryOptionsReader,
  workingDirectory?: string
): DuckDBConnectionOptions {
  const options: DuckDBConnectionOptions = {name};
  if (typeof databasePathOrQueryOptions === 'string') {
    options.databasePath = databasePathOrQueryOptions;
  }
  options.workingDirectory = workingDirectory ?? '.';
  return options;
}

function splitSetupSQL(setupSQL: string): string[] {
  return setupSQL
    .split(';\n')
    .map(statement => statement.trim())
    .filter(statement => statement !== '');
}

interface FIFOMutexWaiter {
  readonly resolve: (release: () => void) => void;
  readonly reject: (error: Error) => void;
  readonly signal?: AbortSignal;
  onAbort?: () => void;
}

class AsyncFIFOMutex {
  private locked = false;
  private readonly waiters: FIFOMutexWaiter[] = [];

  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve(this.makeRelease());
    }
    return new Promise((resolve, reject) => {
      const waiter: FIFOMutexWaiter = {resolve, reject, signal};
      if (signal) {
        waiter.onAbort = () => {
          const index = this.waiters.indexOf(waiter);
          if (index !== -1) this.waiters.splice(index, 1);
          reject(abortReason(signal));
        };
        signal.addEventListener('abort', waiter.onAbort, {once: true});
      }
      this.waiters.push(waiter);
    });
  }

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      while (true) {
        const next = this.waiters.shift();
        if (!next) {
          this.locked = false;
          return;
        }
        if (next.onAbort) {
          next.signal?.removeEventListener('abort', next.onAbort);
        }
        if (next.signal?.aborted) {
          next.reject(abortReason(next.signal));
          continue;
        }
        next.resolve(this.makeRelease());
        return;
      }
    };
  }
}

/**
 * Async generators only run finally when the consumer asks for another row or
 * calls return(). Keep an explicit controller so close() can return a paused
 * stream and release its lifecycle lease instead of waiting forever.
 */
class ManagedDuckDBStream implements AsyncIterableIterator<QueryRecord> {
  private started = false;
  private finished = false;
  private paused = false;
  private revokeOnPause:
    {error: Error; isStillRequested: () => boolean} | undefined;
  private terminalError: Error | undefined;
  private revocationTask: Promise<void> | undefined;
  private advanceInFlight = false;

  constructor(
    private readonly source: AsyncIterableIterator<QueryRecord>,
    private readonly interrupt: () => void,
    private readonly ownsLease: (
      expectedLease: DuckDBPhysicalTargetLease
    ) => boolean,
    private readonly pollYieldRequest: () => void,
    private readonly onStart: () => void,
    private readonly onFinish: () => void
  ) {}

  [Symbol.asyncIterator](): AsyncIterableIterator<QueryRecord> {
    return this;
  }

  next(): Promise<IteratorResult<QueryRecord>> {
    if (this.revocationTask) return this.nextAfterRevocation();
    if (this.finished) {
      if (this.terminalError) return Promise.reject(this.terminalError);
      return Promise.resolve({done: true as const, value: undefined});
    }
    if (this.advanceInFlight) {
      return Promise.reject(
        new Error(
          'DuckDB streams do not allow concurrent next() calls; await each row before requesting the next one'
        )
      );
    }
    if (this.paused) {
      // A waiter raises the lease's level synchronously, while requestYield
      // runs later. Do not start a new native pull through that callback gap.
      this.pollYieldRequest();
      if (this.revocationTask) return this.nextAfterRevocation();
    }
    this.paused = false;
    this.start();
    this.advanceInFlight = true;
    return this.observeNext(this.source.next()).finally(() => {
      this.advanceInFlight = false;
    });
  }

  return(): Promise<IteratorResult<QueryRecord>> {
    if (this.revocationTask) return this.returnAfterRevocation();
    if (this.finished) {
      return Promise.resolve({done: true as const, value: undefined});
    }
    this.paused = false;
    this.interrupt();
    const returned = this.source.return
      ? this.source.return()
      : Promise.resolve({done: true as const, value: undefined});
    return this.observe(returned);
  }

  throw(error?: unknown): Promise<IteratorResult<QueryRecord>> {
    if (this.finished) return Promise.reject(error);
    this.start();
    this.interrupt();
    const thrown = this.source.throw
      ? this.source.throw(error)
      : Promise.reject(error);
    return this.observe(thrown);
  }

  cancel(): void {
    if (this.finished) return;
    void this.return().catch(() => {
      // The caller driving next() observes the native interruption error.
    });
  }

  /**
   * Kernel leases are broken only after the holder reaches a quiescent
   * safepoint. A yielded row is that safepoint for an async iterator: no
   * native pull is running, so returning the generator cannot interrupt an
   * unrelated operation or expose a half-consumed chunk.
   */
  revokeWhenPaused(
    error: Error,
    expectedLease: DuckDBPhysicalTargetLease,
    {requireYieldRequest = true}: {requireYieldRequest?: boolean} = {}
  ): void {
    if (!this.ownsLease(expectedLease)) return;
    if (this.finished || this.revocationTask) return;
    const isStillRequested = () =>
      this.ownsLease(expectedLease) &&
      (!requireYieldRequest || expectedLease.isYieldRequested);
    if (!isStillRequested()) return;
    if (
      !this.revokeOnPause ||
      !this.revokeOnPause.isStillRequested() ||
      !requireYieldRequest
    ) {
      // Explicit idle is stronger than a cancellable broker request, and a
      // stale request must never mask a later live revocation source.
      this.revokeOnPause = {error, isStillRequested};
    }
    if (this.paused) this.revokePausedStream();
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    this.onStart();
  }

  private async observe(
    operation: Promise<IteratorResult<QueryRecord>>
  ): Promise<IteratorResult<QueryRecord>> {
    try {
      const result = await operation;
      if (result.done) this.finish();
      return result;
    } catch (error) {
      this.finish();
      throw error;
    }
  }

  private async observeNext(
    operation: Promise<IteratorResult<QueryRecord>>
  ): Promise<IteratorResult<QueryRecord>> {
    try {
      const result = await operation;
      if (result.done) {
        this.finish();
      } else {
        this.paused = true;
        if (this.revokeOnPause) {
          if (this.revokeOnPause.isStillRequested()) {
            this.revokePausedStream();
          } else {
            this.revokeOnPause = undefined;
          }
        }
      }
      return result;
    } catch (error) {
      this.finish();
      throw error;
    }
  }

  private revokePausedStream(): void {
    if (!this.paused || this.finished || this.revocationTask) return;
    if (!this.revokeOnPause?.isStillRequested()) {
      this.revokeOnPause = undefined;
      return;
    }
    this.paused = false;
    this.terminalError = this.revokeOnPause.error;
    this.interrupt();
    const returned = this.source.return
      ? this.source.return()
      : Promise.resolve({done: true as const, value: undefined});
    this.revocationTask = this.observe(returned).then(
      () => undefined,
      error => {
        this.terminalError = combinedError(
          [this.terminalError as Error, asError(error)],
          'DuckDB stream lease revocation failed'
        );
      }
    );
  }

  private async nextAfterRevocation(): Promise<IteratorResult<QueryRecord>> {
    await this.revocationTask;
    throw (
      this.terminalError ??
      new DuckDBStreamLeaseRevokedError('DuckDB stream lease was revoked')
    );
  }

  private async returnAfterRevocation(): Promise<IteratorResult<QueryRecord>> {
    await this.revocationTask;
    return {done: true as const, value: undefined};
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.onFinish();
  }
}

export class DuckDBStreamLeaseRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuckDBStreamLeaseRevokedError';
  }
}

export const DUCKDB_LOCK_TIMEOUT_CODE = 'MALLOY_DUCKDB_LOCK_TIMEOUT' as const;

export class DuckDBLockTimeoutError extends Error {
  public readonly code = DUCKDB_LOCK_TIMEOUT_CODE;
  public readonly cause: unknown;
  public readonly attempts: number;
  public readonly elapsedMilliseconds: number;

  constructor(
    databasePath: string,
    cause: unknown,
    attempts: number,
    elapsedMilliseconds: number
  ) {
    const elapsed = Math.max(0, Math.round(elapsedMilliseconds));
    super(
      `Timed out acquiring DuckDB file lock for "${databasePath}" after ${attempts} attempts and ${elapsed}ms: ${asError(cause).message}`
    );
    this.name = 'DuckDBLockTimeoutError';
    this.cause = cause;
    this.attempts = attempts;
    this.elapsedMilliseconds = elapsed;
  }
}

export const DUCKDB_SHAREABLE_UNSUPPORTED_SQL_CODE =
  'MALLOY_DUCKDB_SHAREABLE_UNSUPPORTED_SQL' as const;

export class DuckDBShareableUnsupportedSQLError extends Error {
  public readonly code = DUCKDB_SHAREABLE_UNSUPPORTED_SQL_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'DuckDBShareableUnsupportedSQLError';
  }
}

const SHAREABLE_FORBIDDEN_STATEMENT_KEYWORDS = new Set([
  'ABORT',
  'ATTACH',
  'BEGIN',
  'COMMIT',
  'DEALLOCATE',
  'DETACH',
  'END',
  'EXPLAIN_ANALYZE',
  'EXECUTE',
  'PREPARE',
  'RELEASE',
  'ROLLBACK',
  'SAVEPOINT',
  'START',
  'USE',
]);

/**
 * Return the first unquoted token of every SQL statement. Native
 * extractStatements() is used by the caller as an independent count check, so
 * an unfamiliar quoting construct fails closed instead of bypassing policy.
 */
function topLevelStatementKeywords(sql: string): string[] {
  const keywords: string[] = [];
  let atStatementStart = true;
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];
    if (/\s/u.test(current)) {
      index++;
      continue;
    }
    if (current === ';') {
      atStatementStart = true;
      index++;
      continue;
    }
    if (current === '-' && next === '-') {
      index += 2;
      while (index < sql.length && sql[index] !== '\n') index++;
      continue;
    }
    if (current === '/' && next === '*') {
      index = skipNestedBlockComment(sql, index + 2);
      continue;
    }
    if (current === '$') {
      const delimiter = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(
        sql.slice(index)
      )?.[0];
      if (delimiter) {
        if (atStatementStart) {
          keywords.push('<QUOTED>');
          atStatementStart = false;
        }
        const end = sql.indexOf(delimiter, index + delimiter.length);
        index = end === -1 ? sql.length : end + delimiter.length;
        continue;
      }
    }
    if (current === "'" || current === '"' || current === '`') {
      if (atStatementStart) {
        keywords.push('<QUOTED>');
        atStatementStart = false;
      }
      index = skipQuotedSQL(sql, index, current);
      continue;
    }
    if (/[A-Za-z_]/.test(current)) {
      const start = index++;
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index])) {
        index++;
      }
      if (atStatementStart) {
        const keyword = sql.slice(start, index).toUpperCase();
        keywords.push(
          keyword === 'EXPLAIN' && explainExecutesNestedStatement(sql, index)
            ? 'EXPLAIN_ANALYZE'
            : keyword
        );
        atStatementStart = false;
      }
      continue;
    }
    if (atStatementStart) {
      keywords.push('<OTHER>');
      atStatementStart = false;
    }
    index++;
  }
  return keywords;
}

/**
 * DuckDB's EXPLAIN ANALYZE executes the wrapped statement. Prepared-statement
 * metadata reports only EXPLAIN, so inspect the modifier prefix before the
 * wrapped statement and reject it through the normal lifecycle-SQL fence.
 */
function explainExecutesNestedStatement(sql: string, from: number): boolean {
  let index = skipSQLTrivia(sql, from);
  const directModifier = readSQLWord(sql, index);
  if (directModifier?.word === 'ANALYZE') return true;
  if (sql[index] !== '(') return false;

  let depth = 0;
  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];
    if (current === '-' && next === '-') {
      index += 2;
      while (index < sql.length && sql[index] !== '\n') index++;
      continue;
    }
    if (current === '/' && next === '*') {
      index = skipNestedBlockComment(sql, index + 2);
      continue;
    }
    if (current === "'" || current === '"' || current === '`') {
      index = skipQuotedSQL(sql, index, current);
      continue;
    }
    if (current === '$') {
      const delimiter = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(
        sql.slice(index)
      )?.[0];
      if (delimiter) {
        const end = sql.indexOf(delimiter, index + delimiter.length);
        index = end === -1 ? sql.length : end + delimiter.length;
        continue;
      }
    }
    if (current === '(') {
      depth++;
      index++;
      continue;
    }
    if (current === ')') {
      depth--;
      index++;
      if (depth === 0) return false;
      continue;
    }
    if (depth === 1) {
      const modifier = readSQLWord(sql, index);
      if (modifier) {
        if (modifier.word === 'ANALYZE') return true;
        index = modifier.end;
        continue;
      }
    }
    index++;
  }
  return false;
}

function skipSQLTrivia(sql: string, from: number): number {
  let index = from;
  while (index < sql.length) {
    if (/\s/u.test(sql[index])) {
      index++;
      continue;
    }
    if (sql[index] === '-' && sql[index + 1] === '-') {
      index += 2;
      while (index < sql.length && sql[index] !== '\n') index++;
      continue;
    }
    if (sql[index] === '/' && sql[index + 1] === '*') {
      index = skipNestedBlockComment(sql, index + 2);
      continue;
    }
    break;
  }
  return index;
}

function readSQLWord(
  sql: string,
  from: number
): {word: string; end: number} | undefined {
  if (!/[A-Za-z_]/.test(sql[from] ?? '')) return undefined;
  let end = from + 1;
  while (end < sql.length && /[A-Za-z0-9_$]/.test(sql[end])) end++;
  return {word: sql.slice(from, end).toUpperCase(), end};
}

function skipNestedBlockComment(sql: string, from: number): number {
  let depth = 1;
  let index = from;
  while (index < sql.length && depth > 0) {
    if (sql[index] === '/' && sql[index + 1] === '*') {
      depth++;
      index += 2;
    } else if (sql[index] === '*' && sql[index + 1] === '/') {
      depth--;
      index += 2;
    } else {
      index++;
    }
  }
  return index;
}

function skipQuotedSQL(sql: string, from: number, quote: string): number {
  let index = from + 1;
  while (index < sql.length) {
    if (sql[index] === '\\') {
      index += 2;
    } else if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 2;
      } else {
        return index + 1;
      }
    } else {
      index++;
    }
  }
  return index;
}

function sameCatalogDescriptors(
  left: Map<string, string>,
  right: Map<string, string>
): boolean {
  if (left.size !== right.size) return false;
  for (const [oid, name] of left) {
    if (right.get(oid) !== name) return false;
  }
  return true;
}

function isDuckDBLockConflict(error: unknown): boolean {
  const message = asError(error).message;
  return (
    message.includes('Could not set lock on file') ||
    message.includes('Conflicting lock is held') ||
    message.includes('Could not obtain lock') ||
    // On Windows the operating-system portion is localized, while DuckDB's
    // owner diagnostic remains stable (for example on a Chinese locale).
    message.includes('File is already open in')
  );
}

function abortableDelay(
  milliseconds: number,
  signal: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, {once: true});
  });
}

function jitteredRetryDelay(maximumMilliseconds: number): number {
  const minimum = Math.ceil(maximumMilliseconds / 2);
  return minimum + Math.floor(Math.random() * (maximumMilliseconds - minimum));
}

function boundedLockRetryDelay(
  attempt: number,
  remainingMilliseconds: number
): number {
  const exponentialMaximum = Math.min(
    SHAREABLE_LOCK_RETRY_MAX_DELAY_MS,
    SHAREABLE_LOCK_RETRY_INITIAL_DELAY_MS * 2 ** Math.min(attempt, 16)
  );
  return jitteredRetryDelay(
    Math.max(1, Math.min(exponentialMaximum, Math.floor(remainingMilliseconds)))
  );
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error(
    signal.reason === undefined
      ? 'DuckDB attachment was aborted'
      : String(signal.reason)
  );
  error.name = 'AbortError';
  return error;
}

function isLocalDuckDBFile(databasePath: string): boolean {
  return (
    databasePath !== ':memory:' &&
    !databasePath.startsWith('md:') &&
    !databasePath.startsWith('motherduck:') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(databasePath)
  );
}
