/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryRecord,
  QueryRunStats,
  StreamingConnection,
  SQLSourceDef,
  SQLSourceRequest,
  TableSourceDef,
  RunSQLOptions,
  TestableConnection,
} from '@malloydata/malloy';
import {makeDigest} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';
import type {
  Connection,
  ConnectionAttributes,
  PostSqlsourceRequest,
  RawAxiosRequestConfig,
} from './client';
import {Configuration, ConnectionsApi, ConnectionsTestApi} from './client';
import {AxiosError} from 'axios';

interface PublisherConnectionOptions {
  connectionUri: string;
  accessToken?: string;
}

export class PublisherConnection
  extends BaseConnection
  implements
    Connection,
    StreamingConnection,
    TestableConnection,
    PersistSQLResults
{
  public readonly name: string;
  public readonly projectName: string;
  private connectionsApi: ConnectionsApi;
  private connectionsTestApi: ConnectionsTestApi;
  private connectionAttributes: ConnectionAttributes;
  private connectionData: Connection;
  private accessToken: string | undefined;

  static async create(name: string, options: PublisherConnectionOptions) {
    const url = new URL(options.connectionUri);
    const urlParts = url.pathname.split('/');
    if (urlParts.length !== 7) {
      const fmt = '/api/v0/projects/{projectName}/connections/{connectionName}';
      throw new Error(
        `Invalid connection URI: ${options.connectionUri}. Expected format: ${fmt}`
      );
    }
    const apiTag = urlParts[1];
    const versionTag = urlParts[2];
    const projectName = urlParts[4];
    const connectionName = urlParts[6];

    if (name !== connectionName) {
      throw new Error(
        `Connection name mismatch: ${name} !== ${connectionName}. Connection name must match the URI path.`
      );
    }
    const apiUrl = `${url.origin}/${apiTag}/${versionTag}`;
    const configuration = new Configuration({
      basePath: apiUrl,
      baseOptions: {
        timeout: 600000,
      },
    });
    const connectionsApi = new ConnectionsApi(configuration);
    const connectionsTestApi = new ConnectionsTestApi(configuration);
    const response = await connectionsApi.getConnection(projectName, name, {
      headers: PublisherConnection.getAuthHeaders(options.accessToken),
    });
    if (!response || !response.data) {
      throw new Error(
        `Failed to get connection: ${name} from project: ${projectName}`
      );
    }
    const connectionData = response.data as Connection;
    const connectionAttributes =
      connectionData.attributes as ConnectionAttributes;
    const connection = new PublisherConnection(
      name,
      projectName,
      connectionsApi,
      connectionsTestApi,
      connectionAttributes,
      connectionData,
      options.accessToken
    );
    await connection.test();
    return connection;
  }

  private static getAuthHeaders(
    accessToken: string | undefined
  ): RawAxiosRequestConfig['headers'] {
    return {
      ...(accessToken && {Authorization: `Bearer ${accessToken}`}),
    };
  }

  private constructor(
    name: string,
    projectName: string,
    connectionsApi: ConnectionsApi,
    connectionsTestApi: ConnectionsTestApi,
    connectionAttributes: ConnectionAttributes,
    connectionData: Connection,
    accessToken: string | undefined
  ) {
    super();
    this.name = name;
    this.projectName = projectName;
    this.connectionsApi = connectionsApi;
    this.connectionsTestApi = connectionsTestApi;
    this.connectionAttributes = connectionAttributes;
    this.connectionData = connectionData;
    this.accessToken = accessToken;
  }

  public get dialectName(): string {
    return this.connectionAttributes.dialectName as string;
  }

  public isPool(): this is PooledConnection {
    return this.connectionAttributes.isPool as boolean;
  }

  public canPersist(): this is PersistSQLResults {
    return this.connectionAttributes.canPersist as boolean;
  }

  public canStream(): this is StreamingConnection {
    return this.connectionAttributes.canStream as boolean;
  }

  public getDigest(): string {
    const data = `publisher:${this.projectName}:${this.name}`;
    return makeDigest(data);
  }

  public async fetchTableSchema(
    _tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    let result = {} as TableSourceDef;
    try {
      const response = await this.connectionsApi.getTable(
        this.projectName,
        this.name,
        tablePath.split('.')[0],
        tablePath,
        {
          headers: PublisherConnection.getAuthHeaders(this.accessToken),
        }
      );
      result = JSON.parse(response.data.source as string) as TableSourceDef;
    } catch (error: AxiosError | unknown) {
      this.extractAndThrowError(
        error,
        `Failed to fetch table schema for ${tablePath}`
      );
    }
    return result;
  }

  public async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef> {
    let result = {} as SQLSourceDef;
    try {
      const request: PostSqlsourceRequest = {
        sqlStatement: sqlRef.selectStr,
      };
      const response = await this.connectionsApi.postSqlsource(
        this.projectName,
        this.name,
        request,
        {
          headers: PublisherConnection.getAuthHeaders(this.accessToken),
        }
      );
      result = JSON.parse(response.data.source as string) as SQLSourceDef;
    } catch (error: AxiosError | unknown) {
      this.extractAndThrowError(
        error,
        'Failed to fetch select schema for SQL query'
      );
    }
    return result;
  }

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    // Most connection types don't support cost estimation.
    return {};
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    let result = {} as MalloyQueryData;
    try {
      // TODO: Add support for abortSignal.
      options.abortSignal = undefined;
      const request: PostSqlsourceRequest = {
        sqlStatement: sql,
      };
      const response = await this.connectionsApi.postQuerydata(
        this.projectName,
        this.name,
        request,
        JSON.stringify(options),
        {
          headers: PublisherConnection.getAuthHeaders(this.accessToken),
        }
      );
      result = JSON.parse(response.data.data as string) as MalloyQueryData;
    } catch (error: AxiosError | unknown) {
      this.extractAndThrowError(error, 'Failed to execute SQL query');
    }
    return result;
  }

  public async *runSQLStream(
    sqlCommand: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    try {
      // TODO: Add support for abortSignal.
      options.abortSignal = undefined;
      // TODO: Add real streaming support to publisher API.
      const request: PostSqlsourceRequest = {
        sqlStatement: sqlCommand,
      };
      const response = await this.connectionsApi.postQuerydata(
        this.projectName,
        this.name,
        request,
        JSON.stringify(options),
        {
          headers: PublisherConnection.getAuthHeaders(this.accessToken),
        }
      );
      const queryData = JSON.parse(
        response.data.data as string
      ) as MalloyQueryData;
      for (const row of queryData.rows) {
        yield row;
      }
    } catch (error: AxiosError | unknown) {
      this.extractAndThrowError(error, 'Failed to execute streaming SQL query');
      return;
    }
  }

  public async test(): Promise<void> {
    try {
      await this.connectionsTestApi.testConnectionConfiguration(
        this.connectionData,
        {
          headers: PublisherConnection.getAuthHeaders(this.accessToken),
        }
      );
    } catch (error: AxiosError | unknown) {
      this.extractAndThrowError(
        error,
        'Failed to test connection configuration'
      );
    }
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    let result = '';
    try {
      const request: PostSqlsourceRequest = {
        sqlStatement: sqlCommand,
      };
      const response = await this.connectionsApi.postTemporarytable(
        this.projectName,
        this.name,
        request,
        {
          headers: PublisherConnection.getAuthHeaders(this.accessToken),
        }
      );
      result = response.data.table as string;
    } catch (error: AxiosError | unknown) {
      this.extractAndThrowError(error, 'Failed to manifest temporary table');
    }
    return result;
  }

  public async close(): Promise<void> {
    // Can't close the remote connection.
    return;
  }

  private extractAndThrowError(
    error: AxiosError | unknown,
    defaultMessage: string
  ): void {
    if (error instanceof AxiosError) {
      const errorMessage =
        error?.response?.data?.message || error?.message || defaultMessage;
      throw new Error(errorMessage);
    }
    throw error;
  }
}
