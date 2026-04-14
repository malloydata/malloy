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

import type {
  RunSQLOptions,
  MalloyQueryData,
  QueryRunStats,
  Connection,
  PersistSQLResults,
  StreamingConnection,
  PooledConnection,
  SQLSourceDef,
  TableSourceDef,
  StructDef,
  QueryRecord,
  TestableConnection,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {SnowflakeDialect, sqlKey, makeDigest} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {SnowflakeExecutor} from './snowflake_executor';
import {
  accumulateVariantPath,
  buildTopLevelField,
  createVariantSchemaState,
  PathParser,
  seedTopLevelShape,
} from './snowflake_variant_schema';
import type {NestedColumn} from './snowflake_variant_schema';
import {parseSnowflakeTableName} from './snowflake_table_name';
import type {ConnectionOptions} from 'snowflake-sdk';
import type {Options as PoolOptions} from 'generic-pool';

type namespace = {database: string; schema: string};

/**
 * Output of the INFORMATION_SCHEMA.TABLES probe. Undefined when the
 * probe didn't run (non-parseable name) or couldn't find numeric size
 * info (views, missing permissions).
 */
export interface TableSizeProbe {
  bytes: number;
  rowCount: number;
}

/**
 * Three-way tier that drives variant schema sampling. Extracted as a
 * pure function so cost-policy decisions are unit-testable.
 *
 *   full-scan-then-sample: probe confirmed a small base table. One
 *     full scan catches rare fields. On failure, fall through to the
 *     sample chain rather than accept opaque variant.
 *
 *   tablesample-only: probe confirmed a base table above the small
 *     threshold. TABLESAMPLE BLOCK is safe (reads a few micro
 *     partitions). Plain LIMIT without a WHERE is unsafe on large
 *     partitioned tables, so we skip the LIMIT fallback — we'd rather
 *     degrade to variant than issue a runaway query.
 *
 *   tablesample-then-limit: probe gave no size info (views, temp
 *     views, exotic names). We can't distinguish a small view from a
 *     view over a petabyte table, so we do best-effort sampling. This
 *     is the acknowledged "can't help you" case from the design doc.
 */
export type SampleStrategy =
  | 'full-scan-then-sample'
  | 'tablesample-only'
  | 'tablesample-then-limit';

export function pickSampleStrategy(
  probe: TableSizeProbe | undefined,
  fullScanMaxBytes: number
): SampleStrategy {
  if (probe === undefined) return 'tablesample-then-limit';
  if (probe.bytes <= fullScanMaxBytes) return 'full-scan-then-sample';
  return 'tablesample-only';
}

export interface SnowflakeConnectionOptions {
  // snowflake sdk connection options
  connOptions?: ConnectionOptions;
  // generic pool options to help maintain a pool of connections to snowflake
  poolOptions?: PoolOptions;

  // the database and schema where we can perform temporary table operations.
  // for example, if we want to create a temp table for fetching schema of an sql block
  // we could use this database & schema instead of the main database & schema
  scratchSpace?: namespace;

  queryOptions?: RunSQLOptions;

  // Timeout for the statement
  timeoutMs?: number;

  // Timeout for the variant schema sampling query (default 2 minutes)
  schemaSampleTimeoutMs?: number;

  // Row limit used inside the variant schema sample (default 1000). When the
  // probe reports the table is small enough to full-scan, this limit is
  // ignored.
  schemaSampleRowLimit?: number;

  // Byte threshold below which variant schema inference skips sampling and
  // full-scans the table instead (default 100 MB). A full scan catches rare
  // fields that a sample would miss.
  schemaSampleFullScanMaxBytes?: number;

  // SQL statements to run when a connection is acquired from the pool
  setupSQL?: string;
}

/**
 * Default statement timeoutMs value, 10 Mins
 */
const TIMEOUT_MS = 1000 * 60 * 10;

export class SnowflakeConnection
  extends BaseConnection
  implements
    Connection,
    PooledConnection,
    PersistSQLResults,
    StreamingConnection,
    TestableConnection
{
  private readonly dialect = new SnowflakeDialect();
  private executor: SnowflakeExecutor;
  private connOptions: ConnectionOptions;

  // the database & schema where we do temporary operations like creating a temp table
  private scratchSpace?: namespace;
  private queryOptions: RunSQLOptions;
  private timeoutMs: number;
  private schemaSampleTimeoutMs: number;
  private schemaSampleRowLimit: number;
  private schemaSampleFullScanMaxBytes: number;
  private setupSQL: string | undefined;

  constructor(
    public readonly name: string,
    options?: SnowflakeConnectionOptions
  ) {
    super();
    let connOptions = options?.connOptions;
    if (!connOptions || Object.keys(connOptions).length === 0) {
      // try to get connection options from ~/.snowflake/connections.toml
      connOptions = SnowflakeExecutor.getConnectionOptionsFromToml();
    }
    this.connOptions = connOptions ?? {};
    this.setupSQL = options?.setupSQL;
    this.executor = new SnowflakeExecutor(
      connOptions,
      options?.poolOptions,
      this.setupSQL
    );
    this.scratchSpace = options?.scratchSpace;
    this.queryOptions = options?.queryOptions ?? {};
    this.timeoutMs = options?.timeoutMs ?? TIMEOUT_MS;
    this.schemaSampleTimeoutMs = options?.schemaSampleTimeoutMs ?? 15_000;
    this.schemaSampleRowLimit = options?.schemaSampleRowLimit ?? 1000;
    this.schemaSampleFullScanMaxBytes =
      options?.schemaSampleFullScanMaxBytes ?? 100_000_000;
  }

  get dialectName(): string {
    return 'snowflake';
  }

  // TODO: make it support nesting soon
  public get supportsNesting(): boolean {
    return false;
  }

  public isPool(): this is PooledConnection {
    return true;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public getDigest(): string {
    const scratch = this.scratchSpace
      ? `${this.scratchSpace.database}:${this.scratchSpace.schema}`
      : '';
    return makeDigest(
      'snowflake',
      this.connOptions.account,
      this.connOptions.username,
      this.connOptions.role,
      this.connOptions.database,
      this.connOptions.schema,
      scratch,
      this.setupSQL
    );
  }

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  public async drain(): Promise<void> {
    await this.executor.done();
  }

  async close(): Promise<void> {
    await this.drain();
  }

  private getTempViewName(sqlCommand: string): string {
    const hash = makeDigest(sqlCommand);
    return `tt${hash.slice(0, this.dialect.maxIdentifierLength - 2)}`;
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    const rowLimit = options?.rowLimit ?? this.queryOptions?.rowLimit;
    let rows = await this.executor.batch(sql, options, this.timeoutMs);
    if (rowLimit !== undefined && rows.length > rowLimit) {
      rows = rows.slice(0, rowLimit);
    }
    return {rows, totalRows: rows.length};
  }

  public async *runSQLStream(
    sqlCommand: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const streamQueryOptions = {
      ...this.queryOptions,
      ...options,
    };

    for await (const row of await this.executor.stream(
      sqlCommand,
      streamQueryOptions
    )) {
      yield row;
    }
  }

  public async test(): Promise<void> {
    await this.executor.batch('SELECT 1 as one');
  }

  private async schemaFromTablePath(
    tablePath: string,
    structDef: StructDef
  ): Promise<void> {
    const infoQuery = `DESCRIBE TABLE ${tablePath}`;
    const rows = await this.executor.batch(infoQuery);
    const nestedColumns: NestedColumn[] = [];
    const notVariant = new Map<string, boolean>();
    for (const row of rows) {
      // data types look like `VARCHAR(1234)` or `NUMBER(10,2)`
      const fullType = (row['type'] as string).toLocaleLowerCase();
      const baseType = fullType.split('(')[0];
      const name = row['name'] as string;

      if (
        baseType === 'variant' ||
        baseType === 'array' ||
        baseType === 'object'
      ) {
        nestedColumns.push({kind: baseType, name});
      } else {
        notVariant.set(name, true);
        // For NUMBER types, pass full string so dialect can inspect scale
        // For other types, just use the base type
        const typeForMapping = ['number', 'numeric', 'decimal', 'dec'].includes(
          baseType
        )
          ? fullType
          : baseType;
        const malloyType = this.dialect.sqlTypeToMalloyType(typeForMapping);
        structDef.fields.push({...malloyType, name});
      }
    }
    // VARIANT, ARRAY, and OBJECT columns don't have schema in metadata —
    // we have to sample actual data and inspect it to discover the
    // structure. Cost control happens in two places:
    //   1. project only the nested columns (via object_construct), so
    //      bytes-on-wire are bounded by actual variant content.
    //   2. tier the sampling strategy by probeTableSize (see
    //      pickSampleStrategy) — small base tables get a full scan;
    //      large base tables get TABLESAMPLE only (no unsafe LIMIT
    //      fallback); unknown-size sources (views, temp views) get
    //      the best-effort TABLESAMPLE→LIMIT chain.
    if (nestedColumns.length > 0) {
      const variantArgs = nestedColumns
        .map(v => `'${v.name}', "${v.name}"`)
        .join(', ');
      // Flatten sampled rows and emit each distinct (path, type) pair.
      // Conflicting pairs at the same path flow through to mergeShape,
      // which collapses them to variant — that is how we honestly
      // surface mixed-type fields to the user.
      const makeSampleQuery = (sampleClause: string) => `
        select
          regexp_replace(path, '\\\\[[0-9]+\\\\]', '[*]') as path,
          case
            when typeof(value) = 'INTEGER' then 'decimal'
            when typeof(value) = 'DOUBLE' then 'decimal'
          else lower(typeof(value)) end as type
        from
          (${sampleClause})
            ,table(flatten(input => o, recursive => true)) as meta
        where typeof(value) != 'NULL_VALUE'
        group by 1, 2
        order by 1;
      `;
      const projectVariants = `select object_construct(${variantArgs}) o`;
      const probe = await this.probeTableSize(tablePath);
      const strategy = pickSampleStrategy(
        probe,
        this.schemaSampleFullScanMaxBytes
      );
      const n = this.schemaSampleRowLimit;
      let fieldPathRows: QueryRecord[] | undefined;

      if (strategy === 'full-scan-then-sample') {
        // Small base table: one full scan catches rare fields that
        // sampling would miss. tryBatch so a failure doesn't poison
        // the pool connection (temp views live on it). On failure we
        // fall through to the sample path so a slow or timed-out full
        // scan still gets partial structure.
        fieldPathRows =
          (await this.executor.tryBatch(
            makeSampleQuery(`${projectVariants} from ${tablePath}`),
            {},
            this.schemaSampleTimeoutMs
          )) ?? undefined;
      }

      if (fieldPathRows === undefined) {
        const tablesampleQuery = makeSampleQuery(
          `${projectVariants} from ${tablePath} TABLESAMPLE BLOCK (1) limit ${n}`
        );
        if (strategy === 'tablesample-only') {
          // Known-large base table: TABLESAMPLE is safe (reads a few
          // micro-partitions), plain LIMIT without a WHERE can be
          // catastrophic on large partitioned tables. If TABLESAMPLE
          // fails here we accept variant rather than risk an unbounded
          // scan.
          fieldPathRows =
            (await this.executor.tryBatch(
              tablesampleQuery,
              {},
              this.schemaSampleTimeoutMs
            )) ?? undefined;
        } else {
          // Unknown size (view, temp view, non-parseable name) or
          // full-scan fallback: best-effort TABLESAMPLE→LIMIT chain.
          // The LIMIT fallback is the acknowledged "can't help" case
          // for views over large partitioned tables.
          fieldPathRows = await this.runSchemaSample(
            tablesampleQuery,
            makeSampleQuery(`${projectVariants} from ${tablePath} limit ${n}`)
          );
        }
      }

      const state = createVariantSchemaState();
      // Snowflake nested-schema inference follows these rules:
      // - top-level ARRAY/OBJECT from DESCRIBE are authoritative
      // - descendant paths imply ancestor shape
      // - conflicting shapes degrade only that prefix to variant
      // - every top-level nested column still produces a field
      for (const nestedColumn of nestedColumns) {
        seedTopLevelShape(state, nestedColumn);
      }

      if (fieldPathRows !== undefined) {
        for (const f of fieldPathRows) {
          const pathString = f['PATH']?.valueOf().toString();
          const fieldType = f['TYPE']?.valueOf().toString();
          if (pathString === undefined || fieldType === undefined) continue;
          const pathParser = new PathParser(pathString);
          const segments = pathParser.segments();
          const topLevel = segments[0];
          if (topLevel?.kind !== 'name' || notVariant.get(topLevel.name)) {
            continue;
          }
          accumulateVariantPath(state, segments, fieldType);
        }
      }

      // Always emit one field per top-level nested column from DESCRIBE, even
      // if sampling produced no usable descendant paths.
      for (const nestedColumn of nestedColumns) {
        structDef.fields.push(
          buildTopLevelField(nestedColumn, state, this.dialect)
        );
      }
    }
  }

  /**
   * Cheap metadata probe: ask INFORMATION_SCHEMA.TABLES for the row count
   * and byte size of tablePath. Returns undefined when the name doesn't
   * parse as a two- or three-part identifier, when the probe query fails,
   * or when the row has no numeric BYTES (views and external tables
   * typically report NULL).
   *
   * Two-part `schema.table` names use the current database's
   * INFORMATION_SCHEMA; three-part `db.schema.table` names address
   * INFORMATION_SCHEMA in the named database. Identifiers are parsed
   * with Snowflake's quoting rules so bare parts case-fold to upper and
   * quoted parts are compared verbatim against the catalog.
   */
  private async probeTableSize(
    tablePath: string
  ): Promise<TableSizeProbe | undefined> {
    const parsed = parseSnowflakeTableName(tablePath);
    if (parsed === undefined || parsed.schema === undefined) return undefined;
    const quoteLit = (s: string) => s.replace(/'/g, "''");
    const dbQualifier = parsed.database ? `${parsed.database.sql}.` : '';
    const rows = await this.executor.tryBatch(
      `select row_count as rc, bytes as by
       from ${dbQualifier}information_schema.tables
       where table_schema = '${quoteLit(parsed.schema.literal)}'
         and table_name = '${quoteLit(parsed.table.literal)}'
       limit 1`,
      {},
      this.schemaSampleTimeoutMs
    );
    if (!rows || rows.length === 0) return undefined;
    const row = rows[0];
    const bytesRaw = row['BY'] ?? row['by'];
    const rowsRaw = row['RC'] ?? row['rc'];
    // Views and external tables surface null BYTES / ROW_COUNT; treat
    // that as "unknown size" so we don't classify them as small and
    // launch a full scan against something potentially huge.
    if (bytesRaw === null || bytesRaw === undefined) return undefined;
    if (rowsRaw === null || rowsRaw === undefined) return undefined;
    const bytes = Number(bytesRaw);
    const rowCount = Number(rowsRaw);
    if (!Number.isFinite(bytes) || !Number.isFinite(rowCount)) return undefined;
    return {bytes, rowCount};
  }

  /**
   * Try to run a schema sampling query, with fallback.
   * First tries the primary query (e.g. using TABLESAMPLE for speed).
   * If that fails or returns no rows, tries the fallback query (plain
   * LIMIT). If both fail or time out, returns undefined so the caller
   * can degrade to sql native types.
   *
   * Uses tryBatch for the primary query so that a failure (e.g.
   * TABLESAMPLE on a view) doesn't destroy the pool connection —
   * session-scoped temp views would be lost otherwise.
   */
  private async runSchemaSample(
    primaryQuery: string,
    fallbackQuery: string
  ): Promise<QueryRecord[] | undefined> {
    // tryBatch catches errors inside the pool callback, preserving the
    // connection and any session state (temp views, session params).
    const rows = await this.executor.tryBatch(
      primaryQuery,
      {},
      this.schemaSampleTimeoutMs
    );
    if (rows && rows.length > 0) {
      return rows;
    }
    // Primary failed or returned no rows — try the fallback.
    // Also use tryBatch so a timeout doesn't destroy the connection.
    return (
      (await this.executor.tryBatch(
        fallbackQuery,
        {},
        this.schemaSampleTimeoutMs
      )) ?? undefined
    );
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const structDef: TableSourceDef = {
      type: 'table',
      dialect: 'snowflake',
      name: tableKey,
      tablePath,
      connection: this.name,
      fields: [],
    };
    await this.schemaFromTablePath(tablePath, structDef);
    return structDef;
  }

  async fetchSelectSchema(sqlRef: SQLSourceRequest): Promise<SQLSourceDef> {
    const structDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };
    // create temp table with same schema as the query
    const tempTableName = this.getTempViewName(sqlRef.selectStr);
    await this.runSQL(
      `CREATE OR REPLACE TEMP VIEW ${tempTableName} AS (${sqlRef.selectStr});`
    );

    await this.schemaFromTablePath(tempTableName, structDef);
    return structDef;
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const tableName = this.getTempViewName(sqlCommand);
    const cmd = `CREATE OR REPLACE TEMP TABLE ${tableName} AS (${sqlCommand});`;
    await this.runSQL(cmd);
    return tableName;
  }
}
