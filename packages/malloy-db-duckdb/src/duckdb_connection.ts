/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
import {makeDigest} from '@malloydata/malloy';
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
  filesystemPolicy?: 'open' | 'sandboxed';
  networkPolicy?: 'open' | 'closed';
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
}

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
    if (this.setupError) {
      throw this.setupError;
    }

    await this.connecting;
    if (this.setupError) {
      throw this.setupError;
    }

    if (!this.isSetup) {
      this.isSetup = this.setupOnce();
    }
    await this.isSetup;
  }

  private async setupOnce(): Promise<void> {
    await this.applyFinalBaseline();

    if (this.normalized.setupSQL) {
      for (const statement of splitSetupSQL(this.normalized.setupSQL)) {
        await this.runDuckDBQuery(statement);
      }
    }

    if (this.normalized.lockConfiguration) {
      await this.runDuckDBQuery('SET lock_configuration=true');
    }
  }

  private buildInstanceOptions(): Record<string, string> {
    const options: Record<string, string> = {
      custom_user_agent: `Malloy/${packageJson.version}`,
    };

    if (this.normalized.motherDuckToken !== undefined) {
      options['motherduck_token'] = this.normalized.motherDuckToken;
    }
    if (this.normalized.readOnly) {
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
    if (this.normalized.networkPolicy === 'closed') {
      await this.loadExtension('json', {allowInstall: false, required: true});
      await this.loadExtension('icu', {allowInstall: false, required: true});
      return;
    }

    const allowInstall = this.normalized.enableExternalAccess !== false;
    await this.loadExtension('json', {allowInstall, required: false});
    await this.loadExtension('icu', {allowInstall, required: false});

    if (this.shouldLoadHttpfs()) {
      await this.loadExtension('httpfs', {allowInstall, required: false});
    }

    for (const extension of this.normalized.additionalExtensions) {
      await this.loadExtension(extension, {allowInstall, required: false});
    }

    if (this.isMotherDuck) {
      await this.loadExtension('motherduck', {allowInstall, required: false});
    }
  }

  private shouldLoadHttpfs(): boolean {
    if (this.normalized.networkPolicy === 'closed') {
      return false;
    }
    return this.normalized.enableExternalAccess !== false;
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
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const defaultOptions = this.readQueryOptions();
    rowLimit ??= defaultOptions.rowLimit;
    await this.setup();
    if (!this.connection) {
      throw new Error('Connection not open');
    }

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    const result = await this.connection.stream(statements[0]);

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
