/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Connection,
  MalloyQueryData,
  PersistSQLResults,
  QueryRunStats,
  QueryData,
  SQLSourceDef,
  TableSourceDef,
  SQLSourceRequest,
  QueryOptionsReader,
  RunSQLOptions,
  StructDef,
  AtomicTypeDef,
  FieldDef,
  RecordTypeDef,
} from '@malloydata/malloy';
import {
  DatabricksDialect,
  sqlKey,
  makeDigest,
  mkFieldDef,
} from '@malloydata/malloy';
import {TinyParser} from '@malloydata/malloy/internal';
import {BaseConnection} from '@malloydata/malloy/connection';
import {DBSQLClient, DBSQLLogger, LogLevel} from '@databricks/sql';

// Suppress noisy SDK logging by default
const quietLogger = new DBSQLLogger({level: LogLevel.error});

class DatabricksTypeParser extends TinyParser {
  constructor(
    typeStr: string,
    private readonly dialect: DatabricksDialect
  ) {
    super(typeStr, {
      space: /^\s+/,
      char: /^[<>:,()]/,
      id: /^\w+/,
    });
  }

  typeDef(): AtomicTypeDef {
    const typToken = this.read();
    if (typToken.type === 'eof') {
      throw this.parseError('Unexpected EOF parsing type');
    }
    const typText = typToken.text.toLowerCase();

    if (typText === 'struct' && this.match('<')) {
      const fields: FieldDef[] = [];
      for (;;) {
        const name = this.expect('id');
        this.expect(':');
        const fieldType = this.typeDef();
        fields.push(mkFieldDef(fieldType, name.text));
        if (this.match('>')) break;
        this.expect(',');
      }
      return {type: 'record', fields} as RecordTypeDef;
    }

    if (typText === 'array' && this.match('<')) {
      const elType = this.typeDef();
      this.expect('>');
      return elType.type === 'record'
        ? {
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            fields: elType.fields,
          }
        : {type: 'array', elementTypeDef: elType};
    }

    if (typText === 'map' && this.match('<')) {
      this.typeDef(); // key type
      this.expect(',');
      this.typeDef(); // value type
      this.expect('>');
      return {type: 'sql native'};
    }

    // Atomic type — parse parameters for DECIMAL, skip for others
    if (typToken.type === 'id') {
      if (typText === 'decimal' && this.match('(')) {
        this.expect('id'); // precision
        let numberType: 'integer' | 'float' = 'integer';
        if (this.match(',')) {
          const scale = this.expect('id');
          if (scale.text !== '0') numberType = 'float';
        }
        this.expect(')');
        return {type: 'number', numberType};
      }
      if (this.match('(')) {
        let depth = 1;
        while (depth > 0) {
          const t = this.read();
          if (t.text === '(') depth++;
          else if (t.text === ')') depth--;
        }
      }
      return this.dialect.sqlTypeToMalloyType(typText);
    }

    throw this.parseError(`Unexpected '${typToken.text}' while parsing type`);
  }
}

export interface DatabricksConfiguration {
  host: string;
  path: string;
  token?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  defaultCatalog?: string;
  defaultSchema?: string;
  setupSQL?: string;
}

export class DatabricksConnection
  extends BaseConnection
  implements Connection, PersistSQLResults
{
  private readonly dialect = new DatabricksDialect();
  private client?: DBSQLClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session?: any;
  private connectPromise?: Promise<void>;
  config: DatabricksConfiguration;
  queryOptions: QueryOptionsReader | undefined;
  public name: string;

  get dialectName(): string {
    return this.dialect.name;
  }

  constructor(
    name: string,
    config: DatabricksConfiguration,
    queryOptions?: QueryOptionsReader
  ) {
    super();
    this.config = config;
    this.queryOptions = queryOptions;
    this.name = name;
  }

  private async ensureConnected(): Promise<void> {
    if (this.session) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this.doConnect();
    return this.connectPromise;
  }

  private async doConnect(): Promise<void> {
    this.client = new DBSQLClient({logger: quietLogger});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectOptions: any = {
      host: this.config.host,
      path: this.config.path,
    };

    if (this.config.oauthClientId && this.config.oauthClientSecret) {
      connectOptions.authType = 'databricks-oauth';
      connectOptions.oauthClientId = this.config.oauthClientId;
      connectOptions.oauthClientSecret = this.config.oauthClientSecret;
    } else if (this.config.token) {
      connectOptions.token = this.config.token;
    }

    await this.client.connect(connectOptions);
    this.session = await this.client.openSession();

    // Malloy timestamps are UTC wallclock
    await this.executeRaw("SET TIME ZONE 'UTC'");

    // Set catalog and schema if configured
    if (this.config.defaultCatalog) {
      await this.executeRaw(`USE CATALOG ${this.config.defaultCatalog}`);
    }
    if (this.config.defaultSchema) {
      await this.executeRaw(`USE SCHEMA ${this.config.defaultSchema}`);
    }

    // Run user-provided setup SQL
    if (this.config.setupSQL) {
      for (const stmt of this.config.setupSQL.split(';\n')) {
        const trimmed = stmt.trim();
        if (trimmed) {
          await this.executeRaw(trimmed);
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeRaw(sql: string): Promise<any[]> {
    await this.ensureConnected();
    const operation = await this.session.executeStatement(sql, {
      runAsync: true,
    });
    const result = await operation.fetchAll();
    await operation.close();
    return result;
  }

  async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand);
    const tableName = `tt${hash.slice(0, this.dialect.maxIdentifierLength - 2)}`;
    const cmd = `CREATE TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand})`;
    await this.executeRaw(cmd);
    return tableName;
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1');
  }

  async runSQL(sql: string, options?: RunSQLOptions): Promise<MalloyQueryData> {
    const result = await this.runRawSQL(sql);
    if (options?.rowLimit && result.rows.length > options.rowLimit) {
      return {
        rows: result.rows.slice(0, options.rowLimit),
        totalRows: result.totalRows,
      };
    }
    return result;
  }

  public getDigest(): string {
    const {host, path, defaultCatalog, defaultSchema} = this.config;
    return makeDigest(
      'databricks',
      host,
      path,
      defaultCatalog,
      defaultSchema,
      this.config.setupSQL
    );
  }

  canPersist(): this is PersistSQLResults {
    return true;
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = undefined;
    }
    if (this.client) {
      await this.client.close();
      this.client = undefined;
    }
    this.connectPromise = undefined;
  }

  async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  async fetchTableSchema(
    tableName: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableName,
      tablePath,
      dialect: this.dialectName,
      connection: this.name,
      fields: [],
    };

    try {
      const quotedPath = this.dialect.quoteTablePath(tablePath);
      const result = await this.runRawSQL(`DESCRIBE TABLE ${quotedPath}`);
      this.fillStructDefFromDescribe(result, structDef);
      return structDef;
    } catch (e) {
      return `Error fetching schema for ${tablePath}: ${e.message}`;
    }
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

    try {
      // Use DESCRIBE on a subquery via a temporary view
      const tempViewName = `_malloy_tmp_${makeDigest(sqlRef.selectStr).slice(0, 20)}`;
      await this.executeRaw(
        `CREATE OR REPLACE TEMPORARY VIEW ${tempViewName} AS (${sqlRef.selectStr})`
      );
      const result = await this.runRawSQL(`DESCRIBE TABLE ${tempViewName}`);
      this.fillStructDefFromDescribe(result, structDef);
      await this.executeRaw(`DROP VIEW IF EXISTS ${tempViewName}`);
      return structDef;
    } catch (e) {
      return `Error fetching schema for SQL block: ${e.message}`;
    }
  }

  private fillStructDefFromDescribe(
    result: MalloyQueryData,
    structDef: StructDef
  ): void {
    for (const row of result.rows) {
      const colName = row['col_name'] as string;
      const dataType = row['data_type'] as string;

      // DESCRIBE TABLE includes partition info and blank separators; skip them
      if (!colName || colName.startsWith('#') || colName.trim() === '') {
        continue;
      }

      const parser = new DatabricksTypeParser(dataType, this.dialect);
      const malloyType = parser.typeDef();
      structDef.fields.push(mkFieldDef(malloyType, colName));
    }
  }

  async runRawSQL(sql: string): Promise<MalloyQueryData> {
    try {
      const rows = (await this.executeRaw(sql)) as QueryData;
      return {rows, totalRows: rows.length};
    } catch (e) {
      throw new Error(`Databricks SQL error: ${e.message}`);
    }
  }
}
