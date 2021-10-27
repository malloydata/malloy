interface BigQueryConnectionSpec {
  name: string;
  type: "bigquery";
  // projectId?: string;
}

interface PostgresConnectionSpec {
  name: string;
  type: "postgres";
  // host?: string;
  // port?: number;
  // username?: string;
  // password?: string;
  // database?: string;
}

export type ConnectionSpec = BigQueryConnectionSpec | PostgresConnectionSpec;

const DEFAULT_CONNECTION_SPECS: ConnectionSpec[] = [
  { type: "bigquery", name: "bigquery-env" },
  { type: "postgres", name: "postgres-env" },
];

export class Config {
  connections: Map<string, ConnectionSpec>;

  private constructor({
    connections = [],
  }: {
    connections?: ConnectionSpec[];
  }) {
    this.connections = new Map();
    for (const connection of [...DEFAULT_CONNECTION_SPECS, ...connections]) {
      this.connections.set(connection.name, connection);
    }
  }

  static fromString(configFile?: string): Config {
    const rawConfig = configFile ? JSON.parse(configFile) : {};

    let connections: ConnectionSpec[] | undefined;
    if ("connections" in rawConfig) {
      if (!(rawConfig.connections instanceof Array)) {
        throw new Error("Invalid value for config 'connections'.");
      }

      connections = rawConfig.connections.map(loadConnectionSpec);
    }

    return new Config({ connections });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadConnectionSpec(raw: any): ConnectionSpec {
  if (!("type" in raw)) {
    throw new Error("Connection 'type' is required.");
  }

  if (typeof raw.type !== "string") {
    throw new Error("Connection 'type' must be a string.");
  }
  if (!("name" in raw)) {
    throw new Error("Connection 'name' is required.");
  }

  if (typeof raw.name !== "string") {
    throw new Error("Connection 'name' must be a string.");
  }

  switch (raw.type) {
    case "bigquery":
      return { type: raw.type, name: raw.name };
    case "postgres":
      return { type: raw.type, name: raw.name };
    default:
      throw new Error(`Unknown connection type '${raw.type}'.`);
  }
}
