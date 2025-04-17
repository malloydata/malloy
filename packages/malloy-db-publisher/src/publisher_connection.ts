import type {
  Connection,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryDataRow,
  QueryRunStats,
  StreamingConnection,
  SQLSourceDef,
  SQLSourceRequest,
  TableSourceDef,
  RunSQLOptions,
  TestableConnection,
} from '@malloydata/malloy';
import { BaseConnection } from '@malloydata/malloy/connection';
import { Configuration, ConnectionAttributes, ConnectionsApi } from './client';
import { AxiosRequestConfig } from 'axios';

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
  PersistSQLResults {
  public readonly name: string;
  public readonly projectName: string;
  private connectionsApi: ConnectionsApi;
  private connectionAttributes: ConnectionAttributes;
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
    });
    const connectionsApi = new ConnectionsApi(configuration);
    const response = await connectionsApi.getConnection(
      projectName, name,
      {
        headers: PublisherConnection.getAuthHeaders(options.accessToken),
      });
    const connectionAttributes = response.data
      .attributes as ConnectionAttributes;
    const connection = new PublisherConnection(
      name,
      projectName,
      connectionsApi,
      connectionAttributes,
      options.accessToken
    );
    await connection.test();
    return connection;
  }

  private static getAuthHeaders(
    accessToken: string | undefined,
  ): AxiosRequestConfig["headers"] {
    return {
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    };
  }

  private constructor(
    name: string,
    projectName: string,
    connectionsApi: ConnectionsApi,
    connectionAttributes: ConnectionAttributes,
    accessToken: string | undefined
  ) {
    super();
    this.name = name;
    this.projectName = projectName;
    this.connectionsApi = connectionsApi;
    this.connectionAttributes = connectionAttributes;
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

  public async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const response = await this.connectionsApi.getTablesource(
      this.projectName,
      this.name,
      tableKey,
      tablePath,
      {
        headers: PublisherConnection.getAuthHeaders(this.accessToken),
      }
    );
    return JSON.parse(response.data) as TableSourceDef;
  }

  public async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef> {
    const response = await this.connectionsApi.getSqlsource(
      this.projectName,
      this.name,
      sqlRef.selectStr,
      {
        headers: PublisherConnection.getAuthHeaders(this.accessToken),
      }
    );
    return JSON.parse(response.data) as SQLSourceDef;
  }

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    // Most connection types don't support cost estimation.
    return {};
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    // TODO: Add support for abortSignal.
    options.abortSignal = undefined;
    const response = await this.connectionsApi.getQuerydata(
      this.projectName,
      this.name,
      sql,
      JSON.stringify(options),
      {
        headers: PublisherConnection.getAuthHeaders(this.accessToken),
      }
    );
    return JSON.parse(response.data) as MalloyQueryData;
  }

  public async * runSQLStream(
    sqlCommand: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    // TODO: Add support for abortSignal.
    options.abortSignal = undefined;
    // TODO: Add real streaming support to publisher API.
    const response = await this.connectionsApi.getQuerydata(
      this.projectName,
      this.name,
      sqlCommand,
      JSON.stringify(options),
      {
        headers: PublisherConnection.getAuthHeaders(this.accessToken),
      }
    );
    const queryData = JSON.parse(response.data) as MalloyQueryData;
    for (const row of queryData.rows) {
      yield row;
    }
  }

  public async test(): Promise<void> {
    await this.connectionsApi.getTest(this.projectName, this.name);
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const response = await this.connectionsApi.getTemporarytable(
      this.projectName,
      this.name,
      sqlCommand,
      {
        headers: PublisherConnection.getAuthHeaders(this.accessToken),
      }
    );
    return response.data;
  }

  public async close(): Promise<void> {
    // Can't close remote connection.
    return;
  }
}
