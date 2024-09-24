import {
  MalloyQueryData,
  QueryRunStats,
  SQLSourceDef,
  TableSourceDef,
} from '../model/malloy_types';
import {RunSQLOptions} from '../run_sql_options';
import {
  Connection,
  FetchSchemaOptions,
  PersistSQLResults,
  PooledConnection,
  StreamingConnection,
} from './types';

export abstract class BaseConnection implements Connection {
  abstract runSQL(
    sql: string,
    options?: RunSQLOptions | undefined
  ): Promise<MalloyQueryData>;

  abstract get name(): string;

  abstract get dialectName(): string;

  abstract fetchSchemaForSQLStruct(
    sqlStruct: SQLSourceDef,
    options: FetchSchemaOptions
  ): Promise<
    | {structDef: SQLSourceDef; error?: undefined}
    | {error: string; structDef?: undefined}
  >;

  abstract fetchSchemaForTables(
    tables: Record<string, string>,
    options: FetchSchemaOptions
  ): Promise<{
    schemas: Record<string, TableSourceDef>;
    errors: Record<string, string>;
  }>;

  isPool(): this is PooledConnection {
    return false;
  }

  canPersist(): this is PersistSQLResults {
    return false;
  }

  canStream(): this is StreamingConnection {
    return false;
  }

  async close(): Promise<void> {}

  async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  async fetchMetadata() {
    return {};
  }

  async fetchTableMetadata(_tablePath: string) {
    return {};
  }
}
