/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {v5 as uuidv5} from 'uuid';
import type {InvalidationKey, URLReader} from '../../runtime_types';
import type {Connection, LookupConnection} from '../../connection/types';

export function hashForInvalidationKey(input: string): string {
  const MALLOY_UUID = '76c17e9d-f3ce-5f2d-bfde-98ad3d2a37f6';
  return uuidv5(input, MALLOY_UUID);
}

export function isInternalURL(url: string): boolean {
  return url.startsWith('internal://');
}

export async function readURL(
  urlReader: URLReader,
  url: URL
): Promise<{contents: string; invalidationKey: InvalidationKey}> {
  const result = await urlReader.readURL(url);
  const {contents, invalidationKey} =
    typeof result === 'string'
      ? {contents: result, invalidationKey: undefined}
      : result;
  return {
    contents,
    invalidationKey: isInternalURL(url.toString())
      ? null
      : invalidationKey ?? hashForInvalidationKey(contents),
  };
}

export async function getInvalidationKey(
  urlReader: URLReader,
  url: URL
): Promise<InvalidationKey> {
  if (isInternalURL(url.toString())) {
    return null;
  }
  if (urlReader.getInvalidationKey !== undefined) {
    return await urlReader.getInvalidationKey(url);
  }
  return (await readURL(urlReader, url)).invalidationKey;
}

export class EmptyURLReader implements URLReader {
  async readURL(
    _url: URL
  ): Promise<{contents: string; invalidationKey: InvalidationKey}> {
    throw new Error('No files.');
  }

  async getInvalidationKey(_url: URL): Promise<InvalidationKey> {
    throw new Error('No files.');
  }
}

/**
 * A URL reader backed by an in-memory mapping of URL contents.
 */
export class InMemoryURLReader implements URLReader {
  constructor(protected files: Map<string, string>) {}

  public async readURL(
    url: URL
  ): Promise<{contents: string; invalidationKey: InvalidationKey}> {
    const file = this.files.get(url.toString());
    if (file !== undefined) {
      return Promise.resolve({
        contents: file,
        invalidationKey: this.invalidationKey(url, file),
      });
    } else {
      throw new Error(`File not found '${url}'`);
    }
  }

  public async getInvalidationKey(url: URL): Promise<InvalidationKey> {
    const file = this.files.get(url.toString());
    if (file !== undefined) {
      return Promise.resolve(this.invalidationKey(url, file));
    } else {
      throw new Error(`File not found '${url}'`);
    }
  }

  private invalidationKey(url: URL, contents: string): InvalidationKey {
    if (isInternalURL(url.toString())) {
      return null;
    }
    return hashForInvalidationKey(contents);
  }
}

/**
 * A fixed mapping of connection names to connections.
 */
export class FixedConnectionMap implements LookupConnection<Connection> {
  constructor(
    private connections: Map<string, Connection>,
    private defaultConnectionName?: string
  ) {}

  /**
   * Get a connection by name.
   *
   * @param connectionName The name of the connection to look up.
   * @return A `Connection`
   * @throws An `Error` if no connection with the given name exists.
   */
  public async getConnection(connectionName?: string): Promise<Connection> {
    if (connectionName === undefined) {
      if (this.defaultConnectionName !== undefined) {
        connectionName = this.defaultConnectionName;
      } else {
        throw new Error('No default connection.');
      }
    }

    const connection = this.connections.get(connectionName);
    if (connection !== undefined) {
      return Promise.resolve(connection);
    } else {
      throw new Error(`No connection found with name ${connectionName}.`);
    }
  }

  /**
   * Gets a list of registered connections.
   *
   * @return The list of registered connections.
   */
  listConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  public async lookupConnection(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }

  public static fromArray(connections: Connection[]): FixedConnectionMap {
    return new FixedConnectionMap(
      new Map(connections.map(connection => [connection.name, connection]))
    );
  }
}
