import { ConnectionConfig } from "../common";

export interface MalloyConfig {
  /** Maximum number of top-level rows to fetch when running queries. */
  rowLimit: number;
  /** Path to directory to save downloaded results */
  downloadsPath: string;
  /** Connections for Malloy to use to access data when compiling and querying. */
  connections: ConnectionConfig[];
}
