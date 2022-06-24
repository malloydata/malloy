import { DuckDBConnection } from "@malloydata/db-duckdb";
import {
  Connection,
  FixedConnectionMap,
  LookupConnection,
} from "@malloydata/malloy";

export class DynamicConnectionManager implements LookupConnection<Connection> {
  private _duckdb: DuckDBConnection | null = null;

  constructor(
    private fixedConnectionMap: FixedConnectionMap,
    private workingPath: string
  ) {}

  async lookupConnection(
    connectionName?: string | undefined
  ): Promise<Connection> {
    try {
      return await this.fixedConnectionMap.lookupConnection(connectionName);
    } catch (err) {
      if (connectionName === "duckdb") {
        if (!this._duckdb) {
          this._duckdb = new DuckDBConnection(
            "duckdb",
            ":memory:",
            this.workingPath
          );
        }
        return this._duckdb;
      }
      throw err;
    }
  }
}
