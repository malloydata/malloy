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

// LTNOTE: we need this extension to be installed to correctly index
//  postgres data...  We should probably do this on connection creation...
//
//     create extension if not exists tsm_system_rows
//

import type {
  Connection,
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryData,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLSourceDef,
  TableSourceDef,
  StreamingConnection,
  StructDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  PostgresDialect,
  mkArrayDef,
  sqlKey,
  makeDigest,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {Client, Pool} from 'pg';
import type {FieldDef} from 'pg';
import QueryStream from 'pg-query-stream';

interface PostgresConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  connectionString?: string;
}

interface InfoSchemaColumn {
  columnName: string;
  dataType: string; // c.data_type    (e.g. 'ARRAY', 'integer', 'USER-DEFINED')
  elementType: string | null; // e.data_type    (or NULL for scalars)
}

/** internal shape of pg_type we care about */
interface PgTypeRow {
  oid: number;
  typname: string;
  typtype: string; // 'b'=base, 'd'=domain, 'e'=enum, 'c'=composite, 'r'=range, 'm'=multirange, 'p'=pseudo
  typcategory: string; // 'A'=array
  typelem: number; // element OID if array
  typbasetype: number; // base OID if domain
  formatted: string; // format_type(oid,NULL)
}

type PostgresConnectionConfigurationReader =
  | PostgresConnectionConfiguration
  | (() => Promise<PostgresConnectionConfiguration>);

const DEFAULT_PAGE_SIZE = 1000;
const SCHEMA_PAGE_SIZE = 1000;

export interface PostgresConnectionOptions
  extends ConnectionConfig,
    PostgresConnectionConfiguration {}

export class PostgresConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  private queryOptionsReader: QueryOptionsReader = {};
  private configReader: PostgresConnectionConfigurationReader = {};

  private readonly dialect = new PostgresDialect();

  constructor(
    options: PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  );
  constructor(
    arg: string | PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
      if (configReader) {
        this.configReader = configReader;
      }
    } else {
      const {name, ...configReader} = arg;
      this.name = name;
      this.configReader = configReader;
    }
    if (queryOptionsReader) {
      this.queryOptionsReader = queryOptionsReader;
    }
  }

  private async readQueryConfig(): Promise<RunSQLOptions> {
    if (this.queryOptionsReader instanceof Function) {
      return this.queryOptionsReader();
    } else {
      return this.queryOptionsReader;
    }
  }

  protected async readConfig(): Promise<PostgresConnectionConfiguration> {
    if (this.configReader instanceof Function) {
      return this.configReader();
    } else {
      return this.configReader;
    }
  }

  get dialectName(): string {
    return 'postgres';
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public getDigest(): string {
    // If configReader is an object (not a function), use its properties
    if (typeof this.configReader !== 'function') {
      const {host, port, databaseName, connectionString} = this.configReader;
      const data = `postgres:${host ?? ''}:${port ?? ''}:${databaseName ?? ''}:${connectionString ?? ''}`;
      return makeDigest(data);
    }
    // Fall back to connection name if config is async
    return makeDigest(`postgres:${this.name}`);
  }

  public get supportsNesting(): boolean {
    return true;
  }

  protected async getClient(): Promise<Client> {
    const {
      username: user,
      password,
      databaseName: database,
      port,
      host,
      connectionString,
    } = await this.readConfig();
    return new Client({
      user,
      password,
      database,
      port,
      host,
      connectionString,
    });
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const client = await this.getClient();
    await client.connect();
    await this.connectionSetup(client);

    let result = await client.query(sqlCommand);
    if (Array.isArray(result)) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    await client.end();
    return {
      rows: result.rows as QueryData,
      totalRows: result.rows.length,
    };
  }

  async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const structDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };
    const client = await this.getClient();
    await client.connect();
    await this.connectionSetup(client);
    // 1) Get row-descriptor without fetching data
    const res = await client.query({
      text: `SELECT * FROM (${sqlRef.selectStr}) _t LIMIT 0`,
    });

    // 2) Resolve every OID we might touch (field, array element, domain base)
    const neededOids = new Set<number>();

    res.fields.forEach(f => neededOids.add(f.dataTypeID));
    // we'll add more OIDs later (typelem / typebasetype) lazily

    // helper to fetch pg_type rows on demand, with cache
    const pgTypeCache = new Map<number, PgTypeRow>();

    const loadTypes = async (oids: number[]) => {
      if (oids.length === 0) return;
      const params = oids.map((_, i) => `$${i + 1}`).join(',');
      const {rows} = await client.query<PgTypeRow>(
        `
      SELECT
        oid,
        typname,
        typtype,
        typcategory,
        typelem,
        typbasetype,
        format_type(oid, NULL) AS formatted
      FROM pg_type
      WHERE oid IN (${params})
      `,
        oids
      );
      rows.forEach(r => pgTypeCache.set(r.oid, r));
    };

    // Prime the cache
    await loadTypes([...neededOids]);

    // 3) recursive mapper → info-schema compliant strings
    const mapDataType = async (oid: number): Promise<string> => {
      let t = pgTypeCache.get(oid);
      if (!t) {
        await loadTypes([oid]);
        t = pgTypeCache.get(oid)!;
      }

      // ARRAY?
      if (t.typcategory === 'A') return 'ARRAY';

      // DOMAIN?  recurse to its base type
      if (t.typtype === 'd') return mapDataType(t.typbasetype);

      // ENUM, COMPOSITE, RANGE, MULTIRANGE, PSEUDO  → USER-DEFINED
      if (['e', 'c', 'r', 'm', 'p'].includes(t.typtype)) return 'USER-DEFINED';

      // built-in scalar or base type of domain
      return t.formatted;
    };

    // helper to resolve element_type (NULL for scalars)
    const mapElementType = async (oid: number): Promise<string | null> => {
      let t = pgTypeCache.get(oid);
      if (!t) {
        await loadTypes([oid]);
        t = pgTypeCache.get(oid)!;
      }
      if (t.typcategory !== 'A') return null; // not an array

      // Ensure element row cached
      if (!pgTypeCache.has(t.typelem)) await loadTypes([t.typelem]);
      return mapDataType(t.typelem);
    };

    // 4) Build final array in original column order
    const result: InfoSchemaColumn[] = [];
    for (const field of res.fields as FieldDef[]) {
      result.push({
        columnName: field.name,
        dataType: await mapDataType(field.dataTypeID),
        elementType: await mapElementType(field.dataTypeID),
      });
    }
    for (const row of result) {
      const postgresDataType = row.dataType;
      const name = row.columnName;
      if (postgresDataType === 'ARRAY') {
        const elementType = this.dialect.sqlTypeToMalloyType(
          row.elementType as string
        );
        structDef.fields.push(mkArrayDef(elementType, name));
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(postgresDataType);
        structDef.fields.push({...malloyType, name});
      }
    }
    await client.end();
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const {rows, totalRows} = await this.runPostgresQuery(
      infoQuery,
      SCHEMA_PAGE_SIZE,
      0,
      false
    );
    if (!totalRows) {
      throw new Error('Unable to read schema.');
    }
    for (const row of rows) {
      const postgresDataType = row['data_type'] as string;
      const name = row['column_name'] as string;
      if (postgresDataType === 'ARRAY') {
        const elementType = this.dialect.sqlTypeToMalloyType(
          row['element_type'] as string
        );
        structDef.fields.push(mkArrayDef(elementType, name));
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(postgresDataType);
        structDef.fields.push({...malloyType, name});
      }
    }
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    const structDef: StructDef = {
      type: 'table',
      name: tableKey,
      dialect: 'postgres',
      tablePath,
      connection: this.name,
      fields: [],
    };
    const [schema, table] = tablePath.split('.');
    if (table === undefined) {
      return 'Default schema not yet supported in Postgres';
    }
    const infoQuery = `
      SELECT column_name, c.data_type, e.data_type as element_type
      FROM information_schema.columns c LEFT JOIN information_schema.element_types e
        ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)
          = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))
        WHERE table_name = '${table}'
          AND table_schema = '${schema}'
    `;

    try {
      await this.schemaFromQuery(infoQuery, structDef);
    } catch (error) {
      return `Error fetching schema for ${tablePath}: ${error.message}`;
    }
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runSQL('SELECT 1');
  }

  public async connectionSetup(client: Client): Promise<void> {
    await client.query("SET TIME ZONE 'UTC'");
  }

  public async runSQL(
    sql: string,
    {rowLimit}: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const config = await this.readQueryConfig();

    return this.runPostgresQuery(
      sql,
      rowLimit ?? config.rowLimit ?? DEFAULT_PAGE_SIZE,
      rowIndex,
      true
    );
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const query = new QueryStream(sqlCommand);
    const client = await this.getClient();
    await client.connect();
    const rowStream = client.query(query);
    let index = 0;
    for await (const row of rowStream) {
      yield row.row as QueryDataRow;
      index += 1;
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        query.destroy();
        break;
      }
    }
    await client.end();
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand);
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runPostgresQuery(cmd, 1000, 0, false);
    return tableName;
  }

  async close(): Promise<void> {
    return;
  }
}

export class PooledPostgresConnection
  extends PostgresConnection
  implements PooledConnection
{
  private _pool: Pool | undefined;

  constructor(
    options: PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  );
  constructor(
    arg: string | PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  ) {
    if (typeof arg === 'string') {
      super(arg, queryOptionsReader, configReader);
    } else {
      super(arg, queryOptionsReader);
    }
  }

  public isPool(): this is PooledConnection {
    return true;
  }

  public async drain(): Promise<void> {
    await this._pool?.end();
  }

  async getPool(): Promise<Pool> {
    if (!this._pool) {
      const {
        username: user,
        password,
        databaseName: database,
        port,
        host,
        connectionString,
      } = await this.readConfig();
      this._pool = new Pool({
        user,
        password,
        database,
        port,
        host,
        connectionString,
      });
      this._pool.on('acquire', client => client.query("SET TIME ZONE 'UTC'"));
    }
    return this._pool;
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const pool = await this.getPool();
    let result = await pool.query(sqlCommand);

    if (Array.isArray(result)) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    return {
      rows: result.rows as QueryData,
      totalRows: result.rows.length,
    };
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const query = new QueryStream(sqlCommand);
    let index = 0;
    // This is a strange hack... `this.pool.query(query)` seems to return the wrong
    // type. Because `query` is a `QueryStream`, the result is supposed to be a
    // `QueryStream` as well, but it's not. So instead, we get a client and call
    // `client.query(query)`, which does what it's supposed to.
    const pool = await this.getPool();
    const client = await pool.connect();
    const resultStream: QueryStream = client.query(query);
    for await (const row of resultStream) {
      yield row.row as QueryDataRow;
      index += 1;
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        query.destroy();
        break;
      }
    }
    client.release();
  }

  async close(): Promise<void> {
    await this.drain();
  }
}
