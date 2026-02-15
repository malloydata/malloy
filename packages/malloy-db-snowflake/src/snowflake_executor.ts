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
  SnowflakeError,
  RowStatement,
  Connection,
  ConnectionOptions,
} from 'snowflake-sdk';
import snowflake from 'snowflake-sdk';
import type {Pool, Options as PoolOptions} from 'generic-pool';
import * as toml from 'toml';
import * as fs from 'fs';
import * as path from 'path';
import type {Readable} from 'stream';
import type {QueryData, QueryRecord, RunSQLOptions} from '@malloydata/malloy';
import {toAsyncGenerator} from '@malloydata/malloy';

// Disable snowflake-sdk logging by default (issue #2565)
snowflake.configure({logLevel: 'OFF'});

export interface ConnectionConfigFile {
  // a toml file with snowflake connection settings
  // if not provided, we will try to read ~/.snowflake/config
  config_file_path?: string;
  // the name of connection in the config file
  // if not provided, we will try to use the "default" connection
  connection_name?: string;
}

// function columnNameToLowerCase(row: QueryRecord): QueryRecord {
//   const ret: QueryRecord = {};
//   for (const key in row) {
//     ret[key.toLowerCase()] = row[key];
//   }
//   return ret;
// }

export class SnowflakeExecutor {
  private static defaultPoolOptions_: PoolOptions = {
    min: 1,
    max: 1,
    // ensure we validate a connection before giving it to a client
    testOnBorrow: true,
    testOnReturn: true,
  };
  private static defaultConnectionOptions = {
    clientSessionKeepAlive: true, // default = false
    clientSessionKeepAliveHeartbeatFrequency: 900, // default = 3600
    // Return integers as native JS BigInt to preserve precision
    jsTreatIntegerAsBigInt: true,
  };

  private pool_: Pool<Connection>;
  private setupSQL: string | undefined;
  constructor(
    connOptions: ConnectionOptions,
    poolOptions?: PoolOptions,
    setupSQL?: string
  ) {
    this.setupSQL = setupSQL;
    this.pool_ = snowflake.createPool(connOptions, {
      ...SnowflakeExecutor.defaultPoolOptions_,
      ...(poolOptions ?? {}),
    });
  }

  public static getConnectionOptionsFromEnv(): ConnectionOptions | undefined {
    const account = process.env['SNOWFLAKE_ACCOUNT'];
    if (account) {
      const username = process.env['SNOWFLAKE_USER'];
      const password = process.env['SNOWFLAKE_PASSWORD'];
      const warehouse = process.env['SNOWFLAKE_WAREHOUSE'];
      const database = process.env['SNOWFLAKE_DATABASE'];
      const schema = process.env['SNOWFLAKE_SCHEMA'];
      return {
        account,
        username,
        password,
        warehouse,
        database,
        schema,
        // Return integers as native JS BigInt to preserve precision
        jsTreatIntegerAsBigInt: true,
      };
    }
    return undefined;
  }

  public static getConnectionOptionsFromToml(
    options?: ConnectionConfigFile
  ): ConnectionOptions {
    let location: string | undefined = options?.config_file_path;
    if (location === undefined) {
      const homeDir = process.env['HOME'] || process.env['USERPROFILE'];
      if (homeDir === undefined) {
        throw new Error('could not find a path to connections.toml');
      }
      location = path.join(homeDir, '.snowflake', 'connections.toml');
    }

    if (!fs.existsSync(location)) {
      throw new Error(
        `provided snowflake connection config file: ${location} does not exist`
      );
    }

    const tomlData = fs.readFileSync(location, 'utf-8');
    const connections = toml.parse(tomlData);
    const tomlConnectionName = options?.connection_name ?? 'default';
    const connection = connections[tomlConnectionName];
    if (connection === undefined) {
      throw new Error(
        `provided snowflake connection name: ${tomlConnectionName} does not exist at ${location}`
      );
    }

    // sometimes the connection file uses "user" instead of "username"
    // because the python api expects 'user'
    connection['username'] = connection['username'] ?? connection['user'];
    if (!connection || !connection.account || !connection.username) {
      throw new Error(
        `provided snowflake connection config file at ${location} is not valid`
      );
    }

    return {
      // some basic options we configure by default but can be overriden
      ...SnowflakeExecutor.defaultConnectionOptions,
      account: connection.account,
      username: connection.username,
      ...connection,
    };
  }

  public async done() {
    await this.pool_.drain().then(() => {
      this.pool_.clear();
    });
  }

  public async _execute(
    sqlText: string,
    conn: Connection,
    options?: RunSQLOptions,
    timeoutMs?: number
  ): Promise<QueryData> {
    let _statement: RowStatement | undefined;
    const cancel = () => {
      _statement?.cancel();
    };
    const timeoutId = timeoutMs ? setTimeout(cancel, timeoutMs) : undefined;
    options?.abortSignal?.addEventListener('abort', cancel);
    return await new Promise((resolve, reject) => {
      _statement = conn.execute({
        sqlText,
        complete: (
          err: SnowflakeError | undefined,
          _stmt: RowStatement,
          rows?: QueryData
        ) => {
          options?.abortSignal?.removeEventListener('abort', cancel);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (err) {
            reject(err);
          } else if (rows) {
            resolve(rows);
          }
        },
      });
    });
  }

  private async _setSessionParams(conn: Connection) {
    // set some default session parameters
    // ensure we do not ignore case for quoted identifiers
    await this._execute(
      'ALTER SESSION SET QUOTED_IDENTIFIERS_IGNORE_CASE = FALSE;',
      conn
    );
    // set utc as the default timezone which is the malloy convention
    await this._execute("ALTER SESSION SET TIMEZONE = 'UTC';", conn);
    // ensure week starts on Sunday which is the malloy convention
    await this._execute('ALTER SESSION SET WEEK_START = 7;', conn);
    // so javascript can parse the dates
    await this._execute(
      "ALTER SESSION SET TIMESTAMP_NTZ_OUTPUT_FORMAT='YYYY-MM-DDTHH24:MI:SS.FF3TZH:TZM';",
      conn
    );
    if (this.setupSQL) {
      for (const stmt of this.setupSQL.split(';\n')) {
        const trimmed = stmt.trim();
        if (trimmed) {
          await this._execute(trimmed, conn);
        }
      }
    }
  }

  public async batch(
    sqlText: string,
    options?: RunSQLOptions,
    timeoutMs?: number
  ): Promise<QueryData> {
    return await this.pool_.use(async (conn: Connection) => {
      await this._setSessionParams(conn);
      return await this._execute(sqlText, conn, options, timeoutMs);
    });
  }

  public async stream(
    sqlText: string,
    options?: RunSQLOptions
  ): Promise<AsyncIterableIterator<QueryRecord>> {
    const pool: Pool<Connection> = this.pool_;
    return await pool.acquire().then(async (conn: Connection) => {
      await this._setSessionParams(conn);

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText,
          streamResult: true,
          complete: (err: SnowflakeError | undefined, stmt: RowStatement) => {
            if (err) {
              reject(err);
            }

            const stream: Readable = stmt.streamRows();
            function streamSnowflake(
              onError: (error: Error) => void,
              onData: (data: QueryRecord) => void,
              onEnd: () => void
            ) {
              function handleEnd() {
                onEnd();
                pool.release(conn);
              }

              let index = 0;
              function handleData(this: Readable, row: QueryRecord) {
                onData(row);
                index += 1;
                if (
                  options?.rowLimit !== undefined &&
                  index >= options.rowLimit
                ) {
                  onEnd();
                }
              }
              stream.on('error', onError);
              stream.on('data', handleData);
              stream.on('end', handleEnd);
            }
            return resolve(toAsyncGenerator<QueryRecord>(streamSnowflake));
          },
        });
      });
    });
  }
}
