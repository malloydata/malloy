import type {RunSQLOptions} from '../run_sql_options';
import type {
  Annotation,
  MalloyQueryData,
  QueryDataRow,
  QueryRunStats,
  SQLSourceDef,
  TableSourceDef,
} from '../model/malloy_types';
import type {Dialect} from '../dialect';
import type {SQLSourceRequest} from '../lang/translate-response';

/**
 * Options passed to fetchSchema methods.
 */
export interface FetchSchemaOptions {
  // Fetch a fresh copy of the schema instead of using cache
  refreshTimestamp?: number;
  /* This is an experimental feature */
  modelAnnotation?: Annotation;
}

/**
 * An object capable of reading schemas for given table names.
 */
export interface InfoConnection {
  // TODO should we really be exposing StructDef like this?
  // TODO should this be a Map instead of a Record in the public interface?
  /**
   * Fetch schemas for multiple tables.
   *
   * @param tables The names of tables to fetch schemas for, represented
   * as a map of keys to table names.
   * @return A mapping of table keys to schemas.
   */
  fetchSchemaForTables(
    tables: Record<string, string>,
    options: FetchSchemaOptions
  ): Promise<{
    schemas: Record<string, TableSourceDef>;
    errors: Record<string, string>;
  }>;

  /**
   * Fetch schemas an SQL blocks
   *
   * @param block The SQL blocks to fetch schemas for.
   * @return A mapping of SQL block names to schemas.
   */

  fetchSchemaForSQLStruct(
    sentence: SQLSourceRequest,
    options: FetchSchemaOptions
  ): Promise<
    | {structDef: SQLSourceDef; error?: undefined}
    | {error: string; structDef?: undefined}
  >;

  /**
   * The name of the connection.
   */
  get name(): string;
  get dialectName(): string;

  /**
   * Get a digest identifying this connection's target database.
   * Used for cache key computation in persist manifests.
   */
  getDigest(): string;
}

export type ConnectionParameterValue =
  | string
  | number
  | boolean
  | Array<ConnectionParameterValue>;

export interface ConnectionParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  isOptional?: boolean;
  isSecret?: boolean;
  defaultValue?: ConnectionParameterValue;
}

export type ConnectionConfigSchema = ConnectionParameter[];

export interface ConnectionConfig {
  name: string;
  [key: string]: ConnectionParameterValue | undefined;
}

export interface ConnectionFactory {
  connectionName: string;
  configSchema: ConnectionConfigSchema;
  createConnection(
    connectionConfig: ConnectionConfig,
    dialectRegistrar?: (dialect: Dialect) => void
  ): Connection & TestableConnection;
}

export interface ConnectionMetadata {
  url?: string;
}

export interface TableMetadata {
  url?: string;
}

/**
 * An object capable of running SQL.
 */
export interface Connection extends InfoConnection {
  /**
   * Run some SQL and yield results.
   *
   * @param sql The SQL to run.
   * @param options.pageSize Maximum number of results to return at once.
   * @return The rows of data resulting from running the given SQL query
   * and the total number of rows available.
   */
  runSQL(sql: string, options?: RunSQLOptions): Promise<MalloyQueryData>;

  // TODO feature-sql-block Comment
  isPool(): this is PooledConnection;

  canPersist(): this is PersistSQLResults;

  canStream(): this is StreamingConnection;

  close(): Promise<void>;

  estimateQueryCost(sqlCommand: string): Promise<QueryRunStats>;

  fetchMetadata: () => Promise<ConnectionMetadata>;

  fetchTableMetadata: (tablePath: string) => Promise<TableMetadata>;
}

// TODO feature-sql-block Comment
export interface TestableConnection extends Connection {
  // TODO feature-sql-block Comment
  test(): Promise<void>;
}

export interface PooledConnection extends Connection {
  // Most pool implementations require a specific call to release connection handles. If a Connection is a
  // PooledConnection, drain() should be called when connection usage is over
  drain(): Promise<void>;
  isPool(): this is PooledConnection;
}

export interface PersistSQLResults extends Connection {
  manifestTemporaryTable(sqlCommand: string): Promise<string>;
}

export interface StreamingConnection extends Connection {
  runSQLStream(
    sqlCommand: string,
    options?: RunSQLOptions
  ): AsyncIterableIterator<QueryDataRow>;
}

/**
 * A mapping of connection names to connections.
 */
export interface LookupConnection<T extends InfoConnection> {
  /**
   * @param connectionName The name of the connection for which a `Connection` is required.
   * @return A promise to a `Connection` for the connection named `connectionName`.
   */
  lookupConnection(connectionName?: string): Promise<T>;
}
