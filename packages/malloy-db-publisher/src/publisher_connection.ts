
import type {
  Connection,
  ConnectionConfig,
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
} from '@malloydata/malloy';
import { BaseConnection } from '@malloydata/malloy/connection';

interface PublisherConnectionConfiguration {
  connectionUri?: string;
  accessToken?: string;
}

type PublisherConnectionConfigurationReader =
  | PublisherConnectionConfiguration
  | (() => Promise<PublisherConnectionConfiguration>);

export interface PublisherConnectionOptions
  extends ConnectionConfig,
  PublisherConnectionConfiguration { }

interface ConnectionAttributes {
  dialectName: string;
  isPool: false;
  canPersist: false;
  canStream: true;
  supportsNesting: false;
}

export class PublisherConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults {
  public readonly name: string;
  private configReader: PublisherConnectionConfigurationReader = {};

  // TODO: Replace with connection type from publisher.
  private attributes: ConnectionAttributes;

  constructor(
    options: PublisherConnectionOptions,
  );
  constructor(
    name: string,
    configReader?: PublisherConnectionConfigurationReader
  );
  constructor(
    arg: string | PublisherConnectionOptions,
    configReader?: PublisherConnectionConfigurationReader
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
      if (configReader) {
        this.configReader = configReader;
      }
    } else {
      const { name, ...configReader } = arg;
      this.name = name;
      this.configReader = configReader;
    }

    // TODO: Implement -- fetch this info from the publisher
    this.attributes = {
      dialectName: 'publisher',
      isPool: false,
      canPersist: false,
      canStream: true,
      supportsNesting: false,
    };
  }

  public get dialectName(): string {
    return this.attributes.dialectName;
  }

  public isPool(): this is PooledConnection {
    return this.attributes.isPool;
  }

  public canPersist(): this is PersistSQLResults {
    return this.attributes.canPersist;
  }

  public canStream(): this is StreamingConnection {
    return this.attributes.canStream;
  }

  public get supportsNesting(): boolean {
    return this.attributes.supportsNesting;
  }

  private async readConfig(): Promise<PublisherConnectionConfiguration> {
    if (this.configReader instanceof Function) {
      return this.configReader();
    } else {
      return this.configReader;
    }
  }

  public async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    return "TODO";
  }

  public async fetchSelectSchema(sqlRef: SQLSourceRequest): Promise<SQLSourceDef | string> {
    return "TODO";
  }

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    /// TODO: Implement me
    return {
      rows: [],
      totalRows: 0,
    };
  }

  public async * runSQLStream(
    sqlCommand: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    // TODO: Implement
  }

  public async test(): Promise<void> {
    // TODO: Implement
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    return "TODO";
  }

  public async close(): Promise<void> {
    return;
  }
}
