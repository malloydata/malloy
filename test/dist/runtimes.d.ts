import { Result, MalloyQueryData, SingleConnectionRuntime } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { PooledPostgresConnection } from "@malloydata/db-postgres";
import { DuckDBConnection } from "@malloydata/db-duckdb";
import { RunSQLOptions } from "@malloydata/malloy/src/malloy";
export declare const duckdbBug3721 = true;
export declare class BigQueryTestConnection extends BigQueryConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class PostgresTestConnection extends PooledPostgresConnection {
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare class DuckDBTestConnection extends DuckDBConnection {
    constructor(name: string);
    runSQL(sqlCommand: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
}
export declare function rows(qr: Result): any[];
declare const allDatabases: string[];
declare type RuntimeDatabaseNames = typeof allDatabases[number];
export declare class RuntimeList {
    bqConnection: BigQueryTestConnection;
    runtimeMap: Map<string, SingleConnectionRuntime<import("@malloydata/malloy/src").Connection>>;
    constructor(databaseList?: RuntimeDatabaseNames[] | undefined);
    closeAll(): Promise<void>;
}
export {};
