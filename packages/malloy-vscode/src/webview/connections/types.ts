

export interface BigQueryConnection {
  name: string;
  type: "bigquery";
  projectId?: string;
}

export interface PostgresConnection {
  name: string;
  type: "postgres";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export type Connection = BigQueryConnection | PostgresConnection;