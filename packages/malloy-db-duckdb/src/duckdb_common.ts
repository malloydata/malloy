/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryRecord,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  StreamingConnection,
  StructDef,
  TestableConnection,
  TemporaryTableRunOptions,
  SQLSourceDef,
  TableSourceDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  DuckDBDialect,
  makeDigest,
  mkFieldDef,
  sqlKey,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

export interface DuckDBQueryOptions {
  rowLimit: number;
}

const MAX_GENERATION_CACHED_TEMPORARY_TABLES = 16;

interface GenerationCachedTemporaryTable {
  readonly tableName: string;
  readonly generation: string | undefined;
}

const unquoteName = (name: string) => {
  const match = /^"(.*)"$/.exec(name);
  if (match) {
    return match[1].replace('""', '"');
  }
  return name;
};

export abstract class DuckDBCommon
  extends BaseConnection
  implements TestableConnection, PersistSQLResults, StreamingConnection
{
  protected isMotherDuck = false;
  protected motherDuckToken: string | undefined;
  protected setupSQL: string | undefined;
  private scopedTemporaryTableSequence = 0;
  private readonly generationCachedTemporaryTables = new Map<
    string,
    GenerationCachedTemporaryTable
  >();

  private readonly dialect = new DuckDBDialect();
  static DEFAULT_QUERY_OPTIONS: DuckDBQueryOptions = {
    rowLimit: 10,
  };

  public readonly name: string = 'duckdb_common';

  get dialectName(): string {
    return this.dialect.name;
  }

  protected readQueryOptions(): DuckDBQueryOptions {
    const options = DuckDBCommon.DEFAULT_QUERY_OPTIONS;
    if (this.queryOptions) {
      if (this.queryOptions instanceof Function) {
        return {...options, ...this.queryOptions()};
      } else {
        return {...options, ...this.queryOptions};
      }
    } else {
      return options;
    }
  }

  constructor(protected queryOptions?: QueryOptionsReader) {
    super();
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public abstract getDigest(): string;

  protected abstract setup(): Promise<void>;

  protected abstract runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}>;

  /**
   * Wrap one complete logical database operation. Native DuckDB overrides
   * this with its FIFO lifecycle scheduler; WASM and other implementations
   * keep the no-op default.
   */
  protected async withConnectionOperation<T>(
    operation: () => Promise<T>,
    _context: {sql?: string} = {}
  ): Promise<T> {
    return operation();
  }

  /** Attachment/data generation used to fence persisted TEMP snapshots. */
  protected persistenceGeneration(): string | undefined {
    return undefined;
  }

  /** Track backend-owned TEMP artifacts for scoped or terminal cleanup. */
  protected registerManifestTemporaryTable(_tableName: string): void {}

  /** Stop tracking a TEMP artifact after scoped cleanup is proven complete. */
  protected unregisterManifestTemporaryTable(_tableName: string): void {}

  /** Backend-specific validation for SQL submitted through the public API. */
  protected async validateUserSQL(_sql: string): Promise<void> {}

  /** Ensure a scoped TEMP consumer cannot escape cleanup with DDL or DML. */
  protected async validateTemporaryTableConsumerSQL(
    _sql: string
  ): Promise<void> {}

  public async runRawSQL(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}> {
    return this.withConnectionOperation(
      async () => {
        await this.setup();
        await this.validateUserSQL(sql);
        return this.runDuckDBQuery(sql);
      },
      {sql}
    );
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    return this.withConnectionOperation(
      () => this.runSQLUnlocked(sql, options),
      {sql}
    );
  }

  private async runSQLUnlocked(
    sql: string,
    options: RunSQLOptions
  ): Promise<MalloyQueryData> {
    await this.setup();
    const defaultOptions = this.readQueryOptions();
    const rowLimit = options.rowLimit ?? defaultOptions.rowLimit;

    const statements = sql.split('-- hack: split on this');
    while (statements.length > 1) {
      await this.validateUserSQL(statements[0]);
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    await this.validateUserSQL(statements[0]);
    const retVal = await this.runDuckDBQuery(statements[0]);
    let result = retVal.rows;
    if (result.length > rowLimit) {
      result = result.slice(0, rowLimit);
    }
    return {rows: result, totalRows: result.length};
  }

  public abstract runSQLStream(
    sql: string,
    options: RunSQLOptions
  ): AsyncIterableIterator<QueryRecord>;

  async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const sqlDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };
    await this.schemaFromQuery(
      `DESCRIBE SELECT * FROM (${sqlRef.selectStr})`,
      sqlDef
    );
    return sqlDef;
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  fillStructDefFromTypeMap(
    structDef: StructDef,
    typeMap: {[name: string]: string}
  ) {
    for (const fieldName in typeMap) {
      // Remove quotes from field name
      const name = unquoteName(fieldName);
      const dbType = typeMap[fieldName];
      const malloyType = this.dialect.parseDuckDBType(dbType);
      structDef.fields.push(mkFieldDef(malloyType, name));
    }
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const typeMap: {[key: string]: string} = {};

    const result = await this.runRawSQL(infoQuery);
    for (const row of result.rows) {
      typeMap[row['column_name'] as string] = row['column_type'] as string;
    }
    this.fillStructDefFromTypeMap(structDef, typeMap);
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableKey,
      dialect: this.dialectName,
      tablePath,
      connection: this.name,
      fields: [],
    };

    const infoQuery = `DESCRIBE SELECT * FROM ${tablePath}`;
    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }

  canStream(): this is StreamingConnection {
    return true;
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1');
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    return this.withConnectionOperation(
      () => this.manifestTemporaryTableUnlocked(sqlCommand),
      {sql: sqlCommand}
    );
  }

  protected async runSQLWithScopedTemporaryTable(
    sqlCommand: string,
    buildConsumerSQL: (tableName: string) => string,
    options: TemporaryTableRunOptions = {}
  ): Promise<MalloyQueryData> {
    return this.withConnectionOperation(async () => {
      if (options.temporaryTableCache === 'connection-generation') {
        return this.runSQLWithGenerationCachedTemporaryTable(
          sqlCommand,
          buildConsumerSQL,
          options
        );
      }
      let tableName: string | undefined;
      let result: MalloyQueryData | undefined;
      let operationError: Error | undefined;
      try {
        tableName = await this.manifestTemporaryTableUnlocked(
          sqlCommand,
          `scoped:${++this.scopedTemporaryTableSequence}`,
          registeredName => {
            // The callback runs before native execution. If CREATE takes
            // effect but result materialization rejects afterwards, the
            // scoped operation still owns an exact name to reclaim now.
            tableName = registeredName;
          }
        );
        const consumerSQL = buildConsumerSQL(tableName);
        await this.validateTemporaryTableConsumerSQL(consumerSQL);
        result = await this.runSQLUnlocked(consumerSQL, options);
      } catch (error) {
        operationError = asError(error);
      }

      let cleanupError: Error | undefined;
      if (tableName !== undefined) {
        try {
          const drop = `DROP TABLE IF EXISTS ${tableName}`;
          await this.validateUserSQL(drop);
          await this.runDuckDBQuery(drop);
          this.unregisterManifestTemporaryTable(tableName);
        } catch (error) {
          // The unique scoped name is never reused. Keep it registered so
          // terminal connection cleanup remains the final reclamation fence.
          cleanupError = asError(error);
        }
      }

      if (operationError && cleanupError) {
        throw new Error(
          `DuckDB scoped TEMP operation and cleanup both failed: ${operationError.message}; ${cleanupError.message}`
        );
      }
      if (operationError) throw operationError;
      if (cleanupError) throw cleanupError;
      return result as MalloyQueryData;
    });
  }

  private async runSQLWithGenerationCachedTemporaryTable(
    sqlCommand: string,
    buildConsumerSQL: (tableName: string) => string,
    options: TemporaryTableRunOptions
  ): Promise<MalloyQueryData> {
    await this.setup();
    const cacheKey = makeDigest(sqlCommand);
    const generation = this.persistenceGeneration();
    let cached = this.generationCachedTemporaryTables.get(cacheKey);

    if (cached === undefined || cached.generation !== generation) {
      const prefix = 'ttc';
      const tableName = `${prefix}${cacheKey.slice(
        0,
        this.dialect.maxIdentifierLength - prefix.length
      )}`;
      const cmd = `CREATE OR REPLACE TEMPORARY TABLE ${tableName} AS (${sqlCommand});`;
      await this.validateUserSQL(cmd);
      this.registerManifestTemporaryTable(tableName);
      await this.runDuckDBQuery(cmd);
      cached = {tableName, generation};
      this.generationCachedTemporaryTables.delete(cacheKey);
      this.generationCachedTemporaryTables.set(cacheKey, cached);
      await this.evictGenerationCachedTemporaryTables();
    } else {
      // Map insertion order is the LRU list. A hit becomes most-recently used.
      this.generationCachedTemporaryTables.delete(cacheKey);
      this.generationCachedTemporaryTables.set(cacheKey, cached);
    }

    const consumerSQL = buildConsumerSQL(cached.tableName);
    await this.validateTemporaryTableConsumerSQL(consumerSQL);
    return this.runSQLUnlocked(consumerSQL, options);
  }

  private async evictGenerationCachedTemporaryTables(): Promise<void> {
    while (
      this.generationCachedTemporaryTables.size >
      MAX_GENERATION_CACHED_TEMPORARY_TABLES
    ) {
      const oldestKey = this.generationCachedTemporaryTables.keys().next()
        .value as string | undefined;
      if (oldestKey === undefined) return;
      const oldest = this.generationCachedTemporaryTables.get(oldestKey);
      this.generationCachedTemporaryTables.delete(oldestKey);
      if (oldest === undefined) continue;
      const drop = `DROP TABLE IF EXISTS ${oldest.tableName}`;
      await this.validateUserSQL(drop);
      await this.runDuckDBQuery(drop);
      this.unregisterManifestTemporaryTable(oldest.tableName);
    }
  }

  private async manifestTemporaryTableUnlocked(
    sqlCommand: string,
    scope?: string,
    onRegistered?: (tableName: string) => void
  ): Promise<string> {
    await this.setup();
    const generation = this.persistenceGeneration();
    const digestParts = [sqlCommand];
    if (generation !== undefined) digestParts.push(generation);
    if (scope !== undefined) digestParts.push(scope);
    const hash = makeDigest(...digestParts);
    const prefix = scope === undefined ? 'tt' : 'tts';
    const tableName = `${prefix}${hash.slice(
      0,
      this.dialect.maxIdentifierLength - prefix.length
    )}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    await this.validateUserSQL(cmd);
    // Register before native execution. If DuckDB applies the CREATE but a
    // wrapper rejects afterwards, lifecycle cleanup must still know that
    // this TEMP object may exist. DROP IF EXISTS makes pre-registration safe
    // when execution fails before the side effect.
    this.registerManifestTemporaryTable(tableName);
    onRegistered?.(tableName);
    await this.runDuckDBQuery(cmd);
    return tableName;
  }

  public abstract close(): Promise<void>;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
