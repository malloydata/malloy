import type { Connection, MalloyQueryData, QueryDataRow, Result, RunSQLOptions, ModelCache } from '@malloydata/malloy';
import { SingleConnectionRuntime, InMemoryURLReader, CacheManager } from '@malloydata/malloy';
import { BigQueryConnection } from '@malloydata/db-bigquery';
import { DuckDBConnection } from '@malloydata/db-duckdb';
import { DuckDBWASMConnection } from '@malloydata/db-duckdb/wasm';
import { SnowflakeConnection } from '@malloydata/db-snowflake';
import { PooledPostgresConnection } from '@malloydata/db-postgres';
import { MySQLConnection } from '@malloydata/db-mysql/src/mysql_connection';
export declare class SnowflakeTestConnection extends SnowflakeConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class BigQueryTestConnection extends BigQueryConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class MySQLTestConnection extends MySQLConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class PostgresTestConnection extends PooledPostgresConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class DuckDBTestConnection extends DuckDBConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class DuckDBWASMTestConnection extends DuckDBWASMConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class TestCacheManager extends CacheManager {
    readonly _modelCache: ModelCache;
    constructor(_modelCache: ModelCache);
}
export declare class TestURLReader extends InMemoryURLReader {
    constructor();
    setFile(url: URL, contents: string): void;
    deleteFile(url: URL): void;
}
export declare function rows(qr: Result): QueryDataRow[];
export declare function runtimeFor(dbName: string): SingleConnectionRuntime;
export declare function testRuntimeFor(connection: Connection): SingleConnectionRuntime<Connection>;
/**
 * All databases which should be tested by default. Experimental dialects
 * should not be in this list. Use MALLOY_DATABASE=dialect_name to test those
 */
export declare const allDatabases: string[];
type RuntimeDatabaseNames = (typeof allDatabases)[number];
export declare class RuntimeList {
    runtimeMap: Map<string, SingleConnectionRuntime<Connection>>;
    runtimeList: Array<[string, SingleConnectionRuntime]>;
    constructor();
    constructor(databaseList: RuntimeDatabaseNames[]);
    constructor(externalConnections: SingleConnectionRuntime[]);
    closeAll(): Promise<void>;
}
export {};
