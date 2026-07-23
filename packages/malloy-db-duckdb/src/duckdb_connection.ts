/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DuckDBCommon} from './duckdb_common';
import {DuckDBInstance} from '@duckdb/node-api';
import type {DuckDBConnection as DuckDBNodeConnection} from '@duckdb/node-api';
import type {
  ConnectionConfig,
  QueryRecord,
  QueryOptionsReader,
  RunSQLOptions,
} from '@malloydata/malloy';
import {makeDigest, queryMetadataComment} from '@malloydata/malloy';
import packageJson from '@malloydata/malloy/package.json';
import {
  buildDuckDBShareKey,
  normalizeDuckDBConfig,
  sqlStringListLiteral,
  sqlStringLiteral,
  stringifyDuckDBOption,
  type NormalizedDuckDBConfig,
} from './duckdb_config';

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
}

const SHAREABLE_ATTACH_ALIAS = 'malloy_db';

interface ActiveDB {
  instance: DuckDBInstance;
  connections: DuckDBNodeConnection[];
}

export class DuckDBConnection extends DuckDBCommon {
  public readonly name: string;
  private readonly normalized: NormalizedDuckDBConfig;
  private readonly shareKey: string;
  private readonly digestDatabasePath: string;
  private readonly digestWorkingDirectory?: string;
  private readonly digestSetupSQL?: string;

  connecting: Promise<void>;
  protected connection: DuckDBNodeConnection | null = null;
  protected setupError: Error | undefined;
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
   * Shareable mode only. True between a successful ATTACH (in
   * `setupOnce()`) and the matching DETACH (in `idle()` / `close()`).
   */
  private attached = false;

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
    this.shareKey = buildDuckDBShareKey(this.normalized);
    this.isMotherDuck =
      this.normalized.databasePath.startsWith('md:') ||
      this.normalized.databasePath.startsWith('motherduck:');
    this.motherDuckToken = this.normalized.motherDuckToken;
    this.setupSQL = this.normalized.setupSQL;
    this.connecting = this.init();
  }

  public getDigest(): string {
    return makeDigest(
      'duckdb',
      this.digestDatabasePath,
      this.digestWorkingDirectory,
      this.digestSetupSQL
    );
  }

  private async init(): Promise<void> {
    try {
      if (this.normalized.effectiveShareable) {
        // Shareable mode: own private :memory: primary, no activeDBs
        // sharing. The real database file is opened lazily via ATTACH in
        // setupOnce() and released via DETACH in idle().
        const instance = await DuckDBInstance.create(
          ':memory:',
          this.buildInstanceOptions({forShareablePrimary: true})
        );
        this.connection = await instance.connect();
        this.ownedInstance = instance;
        return;
      }

      const cached = DuckDBConnection.activeDBs[this.shareKey];
      if (cached) {
        this.connection = await cached.instance.connect();
        cached.connections.push(this.connection);
        return;
      }

      const instance = await DuckDBInstance.create(
        this.normalized.databasePath,
        this.buildInstanceOptions()
      );
      this.connection = await instance.connect();

      DuckDBConnection.activeDBs[this.shareKey] = {
        instance,
        connections: [this.connection],
      };
    } catch (err) {
      this.setupError = err instanceof Error ? err : new Error(String(err));
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
    if (this.setupError) {
      throw this.setupError;
    }

    // Lazy reattach after idle(): if our connection was released, re-run
    // init() now. setupSQL gets replayed below because isSetup was cleared
    // alongside the connection.
    if (this.connection === null) {
      this.connecting = this.init();
      await this.connecting;
      if (this.setupError) {
        throw this.setupError;
      }
    }

    if (!this.isSetup) {
      this.isSetup = this.setupOnce();
    }
    await this.isSetup;
  }

  private async setupOnce(): Promise<void> {
    // In non-shareable mode this whole method runs on every wake because
    // the underlying DuckDBInstance was destroyed by `idle()`/`close()`,
    // so the connection-level state (SETs, LOADs, user setupSQL effects)
    // is gone and must be replayed.
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
      await this.applyFinalBaseline();
    }
    await this.attachIfShareable();

    if (!reattachOnly) {
      if (this.normalized.setupSQL) {
        for (const statement of splitSetupSQL(this.normalized.setupSQL)) {
          await this.runDuckDBQuery(statement);
        }
      }
      if (this.normalized.lockConfiguration) {
        await this.runDuckDBQuery('SET lock_configuration=true');
      }
      this.connectionSetupRan = true;
    }
  }

  /**
   * Shareable mode: ATTACH the real database file into the in-memory
   * primary and `USE` it, so unqualified table refs resolve into the
   * attached file. Idempotent — guarded by `this.attached`. Runs after
   * `applyFinalBaseline()` so the corresponding `SET allowed_directories`
   * (sandboxed mode) has already been applied.
   */
  private async attachIfShareable(): Promise<void> {
    if (!this.normalized.effectiveShareable) return;
    if (this.attached) return;
    const readOnlyClause = this.normalized.readOnly ? ' (READ_ONLY)' : '';
    await this.runDuckDBQuery(
      `ATTACH ${sqlStringLiteral(
        this.normalized.databasePath
      )} AS ${SHAREABLE_ATTACH_ALIAS}${readOnlyClause}`
    );
    await this.runDuckDBQuery(`USE ${SHAREABLE_ATTACH_ALIAS}.main`);
    this.attached = true;
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

  private async applyFinalBaseline(): Promise<void> {
    if (this.normalized.allowedDirectories !== undefined) {
      await this.runDuckDBQuery(
        `SET allowed_directories=${sqlStringListLiteral(
          this.normalized.allowedDirectories
        )}`
      );
    }

    if (
      this.normalized.enableExternalAccess !== undefined &&
      !this.shouldApplyEnableExternalAccessAtOpenTime()
    ) {
      await this.runDuckDBQuery(
        `SET enable_external_access=${this.normalized.enableExternalAccess}`
      );
    }

    if (this.normalized.workingDirectory !== undefined) {
      await this.runDuckDBQuery(
        `SET FILE_SEARCH_PATH=${sqlStringLiteral(
          this.normalized.workingDirectory
        )}`
      );
    }

    if (this.normalized.secretDirectory !== undefined) {
      await this.runDuckDBQuery(
        `SET secret_directory=${sqlStringLiteral(
          this.normalized.secretDirectory
        )}`
      );
    }

    await this.runDuckDBQuery("SET TimeZone='UTC'");
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

  public async *runSQLStream(
    sql: string,
    {rowLimit, abortSignal, queryMetadata}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const defaultOptions = this.readQueryOptions();
    rowLimit ??= defaultOptions.rowLimit;
    await this.setup();
    if (!this.connection) {
      throw new Error('Connection not open');
    }

    const comment = queryMetadata ? queryMetadataComment(queryMetadata) : '';
    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    const result = await this.connection.stream(comment + statements[0]);

    let index = 0;
    for await (const chunk of result.yieldRowObjectJson()) {
      for (const row of chunk) {
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
  }

  async close(): Promise<void> {
    if (this.normalized.effectiveShareable) {
      await this.detachShareableFile();
      if (this.ownedInstance) {
        try {
          this.ownedInstance.closeSync();
        } catch {
          // Best effort during shutdown.
        }
        this.ownedInstance = null;
      }
    } else {
      this.detachInstance();
    }
    this.connection = null;
    this.isSetup = undefined;
    this.setupError = undefined;
    this.attached = false;
    this.closed = true;
  }

  async idle(): Promise<void> {
    // No-op for in-memory: closing the instance silently destroys state.
    if (this.normalized.databasePath === ':memory:') return;

    if (this.normalized.effectiveShareable) {
      // Shareable mode: keep the in-memory primary (and its temp tables,
      // schema cache, etc.) alive; just DETACH the real file so the OS
      // file lock is released. Next `setup()` re-runs `setupOnce()`, which
      // re-ATTACHes lazily on first use.
      await this.detachShareableFile();
      this.isSetup = undefined;
      return;
    }

    this.detachInstance();
    this.connection = null;
    this.isSetup = undefined;
    this.setupError = undefined;
    // Reattach is deferred — `setup()` detects the null connection on next
    // use and runs a fresh init() then. Doing it eagerly here would
    // re-acquire the lock immediately and defeat the point of idling.
  }

  private async detachShareableFile(): Promise<void> {
    if (!this.normalized.effectiveShareable) return;
    if (!this.attached || !this.connection) return;
    try {
      await this.connection.run('USE memory.main');
      await this.connection.run(`DETACH ${SHAREABLE_ATTACH_ALIAS}`);
      this.attached = false;
    } catch {
      // If DETACH fails the lock stays held; surfacing this error would
      // mask the user's original op error. We leave `this.attached` as
      // `true` so a later `attachIfShareable()` doesn't try to ATTACH on
      // top of a still-attached alias.
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
  private detachInstance(): void {
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
      activeDB.connections = activeDB.connections.filter(
        connection => connection !== this.connection
      );
      if (activeDB.connections.length === 0) {
        activeDB.instance.closeSync();
        delete DuckDBConnection.activeDBs[this.shareKey];
      }
    }
  }

  /**
   * Forcefully close all cached DuckDB instances. Useful for test cleanup
   * to release file locks between test runs.
   */
  static closeAllInstances(): void {
    for (const key of Object.keys(DuckDBConnection.activeDBs)) {
      try {
        DuckDBConnection.activeDBs[key].instance.closeSync();
      } catch {
        // Ignore errors during cleanup
      }
    }
    DuckDBConnection.activeDBs = {};
  }
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
