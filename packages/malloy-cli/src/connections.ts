import { Connection, ConnectionMultiplexer, FixedConnections } from "malloy";
import { Options } from "./options";
import { Config, ConnectionSpec } from "./config";
import { BigQueryConnection } from "malloy-db-bigquery";
import { PostgresConnection } from "malloy-db-postgres";

export function getConnections(
  options: Options,
  config: Config
): ConnectionMultiplexer {
  const connections = new Map();
  {
    config.connections.forEach((spec) => {
      connections.set(spec.name, constructConnection(spec));
    });
  }
  if (options.defaultConnectionName !== undefined) {
    if (!connections.has(options.defaultConnectionName)) {
      const availableConnections = [...connections.keys()]
        .map((name) => `'${name}'`)
        .join(", ");
      throw new Error(
        `Specified default connection '${options.defaultConnectionName}' does not exist.\nAvailable connections are: ${availableConnections}.`
      );
    }
  }
  return new FixedConnections(connections, options.defaultConnectionName);
}

function constructConnection(spec: ConnectionSpec): Connection {
  switch (spec.type) {
    case "bigquery":
      return new BigQueryConnection(spec.name);
    case "postgres":
      return new PostgresConnection(spec.name);
  }
}
