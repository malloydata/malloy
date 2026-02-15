/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Connection,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryRunStats,
  RunSQLOptions,
  StreamingConnection,
  StructDef,
  QueryOptionsReader,
  QueryData,
  SQLSourceDef,
  TableSourceDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {MySQLDialect, sqlKey, makeDigest} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';
import {randomUUID} from 'crypto';
import * as MYSQL from 'mysql2/promise';

export interface MySQLConfiguration {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  setupSQL?: string;
}

export class MySQLExecutor {
  public static getConnectionOptionsFromEnv(): MySQLConfiguration {
    const user = process.env['MYSQL_USER'];
    if (user) {
      const host = process.env['MYSQL_HOST'];
      const port = Number(process.env['MYSQL_PORT']);
      const password = process.env['MYSQL_PASSWORD'];
      const database = process.env['MYSQL_DATABASE'];
      return {
        host,
        port,
        user,
        password,
        database,
      };
    }
    return {};
  }
}

export class MySQLConnection
  extends BaseConnection
  implements Connection, PersistSQLResults
{
  private readonly dialect = new MySQLDialect();
  private connection?: MYSQL.Connection;
  config: MySQLConfiguration;
  queryOptions: QueryOptionsReader | undefined;
  public name: string;

  get dialectName(): string {
    return this.dialect.name;
  }

  constructor(
    name: string,
    config: MySQLConfiguration,
    queryOptions?: QueryOptionsReader
  ) {
    super();
    this.config = config;
    this.queryOptions = queryOptions;
    this.name = name;

    // TODO: handle when connection fails.
  }

  async getClient() {
    if (!this.connection) {
      this.connection = await MYSQL.createConnection({
        host: this.config.host,
        port: this.config.port ?? 3306,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        multipleStatements: true,
        decimalNumbers: true,
        supportBigNumbers: true,
        timezone: '+00:00',
      });
      await this.connection.query(
        // LTNOTE: Need to make the group_concat_max_len configurable.
        "set @@session.time_zone = 'UTC';" +
          // LTNOTE: for nesting this is the max buffer size.  Currently set to 10M, have to figure out perf implications.
          'SET SESSION group_concat_max_len = 10000000;' +
          // Need this to make NULL LAST in order by (ISNULL(exp) can't appear in an ORDER BY without it)
          "SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));"
      );
      if (this.config.setupSQL) {
        for (const stmt of this.config.setupSQL.split(';\n')) {
          const trimmed = stmt.trim();
          if (trimmed) {
            await this.connection.query(trimmed);
          }
        }
      }
    }
    return this.connection;
  }

  async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand);
    const tableName = `tt${hash.slice(0, this.dialect.maxIdentifierLength - 2)}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runRawSQL(cmd);
    return tableName;
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1');
  }

  runSQL(sql: string, _options?: RunSQLOptions): Promise<MalloyQueryData> {
    // TODO: what are options here?
    return this.runRawSQL(sql);
  }

  isPool(): this is PooledConnection {
    return false;
  }

  public getDigest(): string {
    const {host, port, user, database} = this.config;
    return makeDigest(
      'mysql',
      host ?? '',
      String(port ?? 3306),
      user ?? '',
      database ?? '',
      this.config.setupSQL ?? ''
    );
  }

  canPersist(): this is PersistSQLResults {
    return true;
  }

  canStream(): this is StreamingConnection {
    // TODO: implement;
    throw new Error('Method not implemented.2');
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection.end();
    }
    return undefined;
  }

  estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    // TODO: implement;
    throw new Error('Method not implemented.3');
  }

  // get name(): string {
  //   return connectionFactory.connectionName;
  // }

  // TODO: make sure this is exercised.
  async fetchTableSchema(tableName: string, tablePath: string) {
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableName,
      tablePath,
      dialect: this.dialectName,
      connection: this.name,
      fields: [],
    };

    const quotedTablePath = tablePath.match(/[:*/]/)
      ? `\`${tablePath}\``
      : tablePath;
    const infoQuery = `DESCRIBE ${quotedTablePath}`;
    const result = await this.runRawSQL(infoQuery);
    await this.schemaFromResult(result, structDef);
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

    const tempTableName = `tmp${randomUUID()}`.replace(/-/g, '');

    const client = await this.getClient();
    await client.query(
      `CREATE TEMPORARY TABLE ${tempTableName} AS (${sqlRef.selectStr});`
    );
    const [results, _fields] = await client.query(`DESCRIBE ${tempTableName};`);

    // console.log(results); // results contains rows returned by server
    // console.log(fields); // fields contains extra meta data about results, if available

    const rows = results as QueryData;

    this.schemaFromResult({rows, totalRows: rows.length}, structDef);
    return structDef;
  }

  private async schemaFromResult(
    result: MalloyQueryData,
    structDef: StructDef
  ): Promise<void> {
    const typeMap: {[key: string]: string} = {};

    for (const row of result.rows) {
      typeMap[row['Field'] as string] = row['Type'] as string;
    }
    this.fillStructDefFromTypeMap(structDef, typeMap);
  }

  async runRawSQL(
    sql: string,
    _options?: RunSQLOptions
  ): Promise<MalloyQueryData> {
    // TODO: what are options here?
    const client = await this.getClient();

    try {
      const [results, _fields] = await client.query(sql);

      // console.log(results); // results contains rows returned by server
      // console.log(fields); // fields contains extra meta data about results, if available

      const rows = results as QueryData;

      return {rows, totalRows: rows.length};
    } catch (e) {
      throw new Error(e);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static removeNulls(jsonObj: any): any {
    if (Array.isArray(jsonObj)) {
      return MySQLConnection.removeNullsArray(jsonObj);
    }
    return MySQLConnection.removeNullsObject(jsonObj);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static removeNullsObject(jsonObj: Record<string, any>): Record<string, any> {
    for (const key in jsonObj) {
      if (Array.isArray(jsonObj[key])) {
        jsonObj[key] = MySQLConnection.removeNullsArray(jsonObj[key]);
      } else if (typeof jsonObj === 'object') {
        jsonObj[key] = MySQLConnection.removeNullsObject(jsonObj[key]);
      }
    }
    return jsonObj;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static removeNullsArray(jsonArray: any[]): any[] {
    const metadata = jsonArray
      .filter(MySQLConnection.checkIsMalloyMetadata)
      .shift();
    if (!metadata) {
      return jsonArray;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredArray = jsonArray
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element: any) =>
          element !== null && !MySQLConnection.checkIsMalloyMetadata(element)
      )
      .map(MySQLConnection.removeNulls);

    if (metadata['limit']) {
      return filteredArray.slice(0, metadata['limit']);
    }

    return filteredArray;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static checkIsMalloyMetadata(jsonObj: any) {
    return (
      jsonObj !== null &&
      typeof jsonObj === 'object' &&
      jsonObj['_is_malloy_metadata']
    );
  }

  private fillStructDefFromTypeMap(
    structDef: StructDef,
    typeMap: {[name: string]: string}
  ) {
    for (const fieldName in typeMap) {
      let mySqlType = typeMap[fieldName].toLocaleLowerCase();
      mySqlType = mySqlType.trim().split('(')[0];
      const malloyType = this.dialect.sqlTypeToMalloyType(mySqlType);
      // no arrays or records exist in mysql
      structDef.fields.push({...malloyType, name: fieldName});
    }
  }
}
