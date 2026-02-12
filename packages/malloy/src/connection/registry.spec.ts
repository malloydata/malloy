/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  registerConnectionType,
  getConnectionProperties,
  getRegisteredConnectionTypes,
  readConnectionsConfig,
  writeConnectionsConfig,
  createConnectionsFromConfig,
} from './registry';
import type {ConnectionConfig, Connection} from './types';

// Minimal mock connection for testing
function mockConnection(name: string, config: ConnectionConfig): Connection {
  return {
    name,
    dialectName: 'mock',
    getDigest: () => 'mock-digest',
    fetchSchemaForTables: jest.fn(),
    fetchSchemaForSQLStruct: jest.fn(),
    runSQL: jest.fn(),
    isPool: () => false,
    canPersist: () => false,
    canStream: () => false,
    close: jest.fn(),
    estimateQueryCost: jest.fn(),
    fetchMetadata: jest.fn(),
    fetchTableMetadata: jest.fn(),
    _config: config, // Stash config for assertions
  } as unknown as Connection & {_config: ConnectionConfig};
}

describe('connection registry', () => {
  beforeEach(() => {
    // Register mock types for testing
    registerConnectionType('mockdb', {
      factory: (config: ConnectionConfig) =>
        mockConnection(config.name, config),
      properties: [
        {name: 'host', displayName: 'Host', type: 'string', optional: true},
        {name: 'port', displayName: 'Port', type: 'number', optional: true},
      ],
    });
    registerConnectionType('mockdb2', {
      factory: (config: ConnectionConfig) =>
        mockConnection(config.name, config),
      properties: [],
    });
  });

  test('getConnectionProperties returns properties for registered type', () => {
    const props = getConnectionProperties('mockdb');
    expect(props).toBeDefined();
    expect(props).toHaveLength(2);
    expect(props![0].name).toBe('host');
    expect(props![0].type).toBe('string');
    expect(props![1].name).toBe('port');
    expect(props![1].type).toBe('number');
  });

  test('getConnectionProperties returns undefined for unknown type', () => {
    expect(getConnectionProperties('nonexistent')).toBeUndefined();
  });

  test('getRegisteredConnectionTypes returns registered type names', () => {
    const types = getRegisteredConnectionTypes();
    expect(types).toContain('mockdb');
    expect(types).toContain('mockdb2');
  });

  test('readConnectionsConfig parses valid JSON', () => {
    const json = JSON.stringify({
      connections: {
        mydb: {is: 'mockdb', host: 'localhost', port: 5432},
      },
    });
    const config = readConnectionsConfig(json);
    expect(config.connections['mydb']['is']).toBe('mockdb');
    expect(config.connections['mydb']['host']).toBe('localhost');
    expect(config.connections['mydb']['port']).toBe(5432);
  });

  test('readConnectionsConfig throws on missing is field', () => {
    const json = JSON.stringify({
      connections: {
        mydb: {host: 'localhost'},
      },
    });
    expect(() => readConnectionsConfig(json)).toThrow(
      /missing required "is" property/
    );
  });

  test('readConnectionsConfig throws on missing connections object', () => {
    expect(() => readConnectionsConfig('{}')).toThrow(
      /missing "connections" object/
    );
  });

  test('writeConnectionsConfig produces 2-space indented JSON', () => {
    const config = {
      connections: {
        mydb: {is: 'mockdb', host: 'localhost'},
      },
    };
    const json = writeConnectionsConfig(config);
    expect(json).toBe(JSON.stringify(config, null, 2));
  });

  test('writeConnectionsConfig round-trips through readConnectionsConfig', () => {
    const original = {
      connections: {
        mydb: {is: 'mockdb', host: 'localhost', port: 5432, readOnly: true},
        other: {is: 'mockdb2'},
      },
    };
    const json = writeConnectionsConfig(original);
    const parsed = readConnectionsConfig(json);
    expect(parsed).toEqual(original);
  });

  test('createConnectionsFromConfig creates working connections', async () => {
    const config = {
      connections: {
        mydb: {is: 'mockdb', host: 'localhost'},
      },
    };
    const lookup = createConnectionsFromConfig(config);
    const conn = await lookup.lookupConnection('mydb');
    expect(conn.name).toBe('mydb');
  });

  test('createConnectionsFromConfig passes properties to factory', async () => {
    const config = {
      connections: {
        mydb: {is: 'mockdb', host: 'localhost', port: 5432},
      },
    };
    const lookup = createConnectionsFromConfig(config);
    const conn = (await lookup.lookupConnection('mydb')) as unknown as {
      _config: ConnectionConfig;
    };
    expect(conn._config['host']).toBe('localhost');
    expect(conn._config['port']).toBe(5432);
  });

  test('createConnectionsFromConfig default connection is first entry', async () => {
    const config = {
      connections: {
        first: {is: 'mockdb'},
        second: {is: 'mockdb2'},
      },
    };
    const lookup = createConnectionsFromConfig(config);
    const conn = await lookup.lookupConnection();
    expect(conn.name).toBe('first');
  });

  test('createConnectionsFromConfig throws for unregistered type', async () => {
    const config = {
      connections: {
        mydb: {is: 'unknowndb'},
      },
    };
    const lookup = createConnectionsFromConfig(config);
    await expect(lookup.lookupConnection('mydb')).rejects.toThrow(
      /No registered connection type "unknowndb"/
    );
  });

  test('createConnectionsFromConfig throws for unknown connection name', async () => {
    const config = {
      connections: {
        mydb: {is: 'mockdb'},
      },
    };
    const lookup = createConnectionsFromConfig(config);
    await expect(lookup.lookupConnection('other')).rejects.toThrow(
      /No connection named "other"/
    );
  });

  test('createConnectionsFromConfig throws when no connections defined', async () => {
    const config = {connections: {}};
    const lookup = createConnectionsFromConfig(config);
    await expect(lookup.lookupConnection()).rejects.toThrow(
      /No connections defined/
    );
  });

  test('createConnectionsFromConfig caches connections', async () => {
    const config = {
      connections: {
        mydb: {is: 'mockdb'},
      },
    };
    const lookup = createConnectionsFromConfig(config);
    const conn1 = await lookup.lookupConnection('mydb');
    const conn2 = await lookup.lookupConnection('mydb');
    expect(conn1).toBe(conn2);
  });
});
