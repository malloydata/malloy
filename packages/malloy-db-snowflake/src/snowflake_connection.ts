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
  Dialect,
  RecordDef,
  AtomicFieldDef,
  ArrayDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  SnowflakeDialect,
  TinyParser,
  mkArrayDef,
  sqlKey,
  makeDigest,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {SnowflakeExecutor} from './snowflake_executor';
import type {ConnectionOptions} from 'snowflake-sdk';
import type {Options as PoolOptions} from 'generic-pool';

type namespace = {database: string; schema: string};

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

  // SQL statements to run when a connection is acquired from the pool
  setupSQL?: string;
}

type PathChain =
  | {arrayRef: true; next?: PathChain}
  | {name: string; next?: PathChain};

class SnowField {
  constructor(
    readonly name: string,
    readonly type: string,
    readonly dialect: Dialect
  ) {}
  fieldDef(): AtomicFieldDef {
    return {
      ...this.dialect.sqlTypeToMalloyType(this.type),
      name: this.name,
    };
  }
  walk(_path: PathChain, _fieldType: string): void {
    throw new Error(
      'SNOWWFLAKE SCHEMA PARSE ERROR: Should not walk through fields'
    );
  }
  static make(name: string, fieldType: string, d: Dialect) {
    if (fieldType === 'array') {
      return new SnowArray(name, d);
    } else if (fieldType === 'object') {
      return new SnowObject(name, d);
    }
    return new SnowField(name, fieldType, d);
  }
}

class SnowObject extends SnowField {
  fieldMap = new Map<string, SnowField>();
  constructor(name: string, d: Dialect) {
    super(name, 'object', d);
  }

  get fields(): AtomicFieldDef[] {
    const fields: AtomicFieldDef[] = [];
    for (const [_, fieldObj] of this.fieldMap) {
      fields.push(fieldObj.fieldDef());
    }
    return fields;
  }

  fieldDef(): RecordDef {
    const rec: RecordDef = {
      type: 'record',
      name: this.name,
      fields: this.fields,
      join: 'one',
    };
    return rec;
  }

  walk(path: PathChain, fieldType: string) {
    if ('name' in path) {
      const field = this.fieldMap.get(path.name);
      if (path.next) {
        if (field) {
          field.walk(path.next, fieldType);
          return;
        }
        throw new Error(
          'SNOWFLAKE SCHEMA PARSER ERROR: Walk through undefined'
        );
      } else {
        // If we get multiple type for a field, ignore them, should
        // which will do until we support viarant data
        if (!field) {
          this.fieldMap.set(
            path.name,
            SnowField.make(path.name, fieldType, this.dialect)
          );
          return;
        }
      }
    }
    throw new Error(
      'SNOWFLAKE SCHEMA PARSER ERROR: Walk object reference through array reference'
    );
  }
}

class SnowArray extends SnowField {
  arrayOf = 'unknown';
  objectChild?: SnowObject;
  arrayChild?: SnowArray;
  constructor(name: string, d: Dialect) {
    super(name, 'array', d);
  }

  isArrayOf(type: string) {
    if (this.arrayOf !== 'unknown') {
      this.arrayOf = 'variant';
      return;
    }
    this.arrayOf = type;
    if (type === 'object') {
      this.objectChild = new SnowObject('', this.dialect);
    } else if (type === 'array') {
      this.arrayChild = new SnowArray('', this.dialect);
    }
  }

  fieldDef(): ArrayDef {
    if (this.objectChild) {
      const t = mkArrayDef(
        {type: 'record', fields: this.objectChild.fields},
        this.name
      );
      return t;
    }
    if (this.arrayChild) {
      return mkArrayDef(this.arrayChild.fieldDef(), this.name);
    }
    return mkArrayDef(
      this.dialect.sqlTypeToMalloyType(this.arrayOf),
      this.name
    );
  }

  walk(path: PathChain, fieldType: string) {
    if ('arrayRef' in path) {
      if (path.next) {
        const next = this.arrayChild || this.objectChild;
        if (next) {
          next.walk(path.next, fieldType);
          return;
        }
        throw new Error(
          'SNOWFLAKE SCHEMA PARSER ERROR: Array walk through leaf'
        );
      } else {
        this.isArrayOf(fieldType);
        return;
      }
    }
    throw new Error('SNOWFLAKE SCHEMA PARSER ERROR: Array walk through name');
  }
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
    const variants: string[] = [];
    const notVariant = new Map<string, boolean>();
    for (const row of rows) {
      // data types look like `VARCHAR(1234)` or `NUMBER(10,2)`
      const fullType = (row['type'] as string).toLocaleLowerCase();
      const baseType = fullType.split('(')[0];
      const name = row['name'] as string;

      if (['variant', 'array', 'object'].includes(baseType)) {
        variants.push(name);
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
    // we have to sample actual data and inspect it to discover the structure.
    // This is inherently heuristic (we only look at 100 rows) and can be
    // slow on large partitioned tables or expensive views.
    if (variants.length > 0) {
      const variantArgs = variants.map(v => `'${v}', "${v}"`).join(', ');
      // Build the analysis query that flattens sampled rows and detects
      // the type of each leaf path. We only construct from variant columns
      // (not *) to avoid flattening the entire row on wide tables.
      // Paths with multiple types across the sample are dropped (HAVING
      // count(*) <= 1), and nulls are ignored.
      const makeSampleQuery = (sampleClause: string) => `
        select path, min(type) as type
        from (
          select
            regexp_replace(path, '\\\\[[0-9]+\\\\]', '[*]') as path,
            case
              when typeof(value) = 'INTEGER' then 'decimal'
              when typeof(value) = 'DOUBLE' then 'decimal'
            else lower(typeof(value)) end as type
          from
            (${sampleClause})
              ,table(flatten(input => o, recursive => true)) as meta
          group by 1,2
        )
        where type != 'null_value'
        group BY 1
        having count(*) <=1
        order by path;
      `;
      const limitClause =
        `select object_construct(${variantArgs}) o` +
        ` from ${tablePath} limit 100`;
      // Try TABLESAMPLE first — it picks random micro-partitions without
      // scanning the whole table, which avoids the full-scan problem on
      // large partitioned tables. TABLESAMPLE only works on base tables,
      // not views, so if it fails we fall back to a plain LIMIT 100.
      const tablesampleClause =
        `select object_construct(${variantArgs}) o` +
        ` from ${tablePath} TABLESAMPLE BLOCK (1) limit 100`;
      const fieldPathRows = await this.runSchemaSample(
        makeSampleQuery(tablesampleClause),
        makeSampleQuery(limitClause)
      );

      if (fieldPathRows === undefined) {
        // Both attempts failed or timed out — treat variants as opaque.
        for (const name of variants) {
          structDef.fields.push({type: 'sql native', name});
        }
      } else {
        // Take the schema in list form and convert it into a tree.
        const rootObject = new SnowObject('__root__', this.dialect);
        for (const f of fieldPathRows) {
          const pathString = f['PATH']?.valueOf().toString();
          const fieldType = f['TYPE']?.valueOf().toString();
          if (pathString === undefined || fieldType === undefined) continue;
          const pathParser = new PathParser(pathString);
          const path = pathParser.pathChain();
          if ('name' in path && notVariant.get(path.name)) {
            continue;
          }
          rootObject.walk(path, fieldType);
        }
        structDef.fields.push(...rootObject.fields);
      }
    }
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

export class PathParser extends TinyParser {
  constructor(pathName: string) {
    super(pathName, {
      quoted: /^'(\\'|[^'])*'/,
      array_of: /^\[\*]/,
      char: /^[[.\]]/,
      number: /^\d+/,
      word: /^\w+/,
    });
  }

  getName() {
    const nameStart = this.next();
    if (nameStart.type === 'word') {
      return nameStart.text;
    }
    if (nameStart.type === '[') {
      const quotedName = this.next('quoted');
      this.next(']');
      return quotedName.text;
    }
    throw this.parseError('Expected column name');
  }

  pathChain(): PathChain {
    const chain: PathChain = {name: this.getName()};
    let node: PathChain = chain;
    for (;;) {
      const sep = this.next();
      if (sep.type === 'eof') {
        return chain;
      }
      if (sep.type === '.') {
        node.next = {name: this.next('word').text};
        node = node.next;
      } else if (sep.type === 'array_of') {
        node.next = {arrayRef: true};
        node = node.next;
      } else if (sep.type === '[') {
        // Actually a dot access through a quoted name
        const quoted = this.next('quoted');
        node.next = {name: quoted.text};
        node = node.next;
        this.next(']');
      } else {
        throw this.parseError(`Unexpected ${sep.type}`);
      }
    }
  }
}
