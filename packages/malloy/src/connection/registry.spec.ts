/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  registerConnectionType,
  getConnectionProperties,
  getConnectionTypeDisplayName,
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
      displayName: 'MockDB',
      factory: async (config: ConnectionConfig) =>
        mockConnection(config.name, config),
      properties: [
        {name: 'host', displayName: 'Host', type: 'string', optional: true},
        {name: 'port', displayName: 'Port', type: 'number', optional: true},
      ],
    });
    registerConnectionType('mockdb2', {
      displayName: 'MockDB 2',
      factory: async (config: ConnectionConfig) =>
        mockConnection(config.name, config),
      properties: [],
    });
    registerConnectionType('jsondb', {
      displayName: 'JsonDB',
      factory: async (config: ConnectionConfig) =>
        mockConnection(config.name, config),
      properties: [
        {name: 'host', displayName: 'Host', type: 'string', optional: true},
        {name: 'ssl', displayName: 'SSL', type: 'json', optional: true},
        {
          name: 'headers',
          displayName: 'Headers',
          type: 'json',
          optional: true,
        },
      ],
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

  test('getConnectionTypeDisplayName returns display name for registered type', () => {
    expect(getConnectionTypeDisplayName('mockdb')).toBe('MockDB');
    expect(getConnectionTypeDisplayName('mockdb2')).toBe('MockDB 2');
  });

  test('getConnectionTypeDisplayName returns undefined for unknown type', () => {
    expect(getConnectionTypeDisplayName('nonexistent')).toBeUndefined();
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

  test('readConnectionsConfig drops entries missing is field', () => {
    const json = JSON.stringify({
      connections: {
        mydb: {host: 'localhost'},
      },
    });
    const config = readConnectionsConfig(json);
    expect(Object.keys(config.connections)).toHaveLength(0);
  });

  test('readConnectionsConfig handles missing connections object', () => {
    const config = readConnectionsConfig('{}');
    expect(Object.keys(config.connections)).toHaveLength(0);
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

  test('quarantines a connection when post-creation callback cleanup fails', async () => {
    const first = mockConnection('orphan', {name: 'orphan'});
    const second = mockConnection('orphan', {name: 'orphan'});
    const cleanupFailure = new Error('injected orphan cleanup failure');
    const firstClose = first.close as jest.MockedFunction<Connection['close']>;
    firstClose
      .mockRejectedValueOnce(cleanupFailure)
      .mockResolvedValueOnce(undefined);
    const factory = jest
      .fn<Promise<Connection>, [ConnectionConfig]>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    registerConnectionType('callback-cleanup', {
      displayName: 'Callback cleanup',
      factory,
      properties: [],
    });
    const callbackFailure = new Error('injected post-creation failure');
    const callback = jest.fn().mockImplementationOnce(() => {
      throw callbackFailure;
    });
    const lookup = createConnectionsFromConfig(
      {connections: {orphan: {is: 'callback-cleanup'}}},
      callback
    );

    await expect(lookup.lookupConnection('orphan')).rejects.toThrow(
      /post-creation callback failed and cleanup also failed/
    );
    await expect(lookup.lookupConnection('orphan')).rejects.toThrow(
      /is quarantined/
    );
    expect(factory).toHaveBeenCalledTimes(1);

    await expect(lookup.close()).resolves.toBeUndefined();
    await expect(lookup.lookupConnection('orphan')).resolves.toBe(second);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  test('a failing alias callback does not close an already active identity', async () => {
    const shared = mockConnection('shared', {name: 'shared'});
    const sharedClose = shared.close as jest.MockedFunction<
      Connection['close']
    >;
    sharedClose.mockResolvedValue(undefined);
    const factory = jest.fn(async () => shared);
    registerConnectionType('shared-callback-identity', {
      displayName: 'Shared callback identity',
      factory,
      properties: [],
    });
    const callbackFailure = new Error('injected second-alias callback failure');
    const callback = jest.fn((name: string) => {
      if (name === 'second') throw callbackFailure;
    });
    const lookup = createConnectionsFromConfig(
      {
        connections: {
          first: {is: 'shared-callback-identity'},
          second: {is: 'shared-callback-identity'},
        },
      },
      callback
    );

    await expect(lookup.lookupConnection('first')).resolves.toBe(shared);
    await expect(lookup.lookupConnection('second')).rejects.toBe(
      callbackFailure
    );
    expect(sharedClose).not.toHaveBeenCalled();
    await expect(lookup.lookupConnection('first')).resolves.toBe(shared);
  });

  test('successful callback-failure cleanup permanently retires the identity', async () => {
    const retired = mockConnection('retired', {name: 'retired'});
    const retiredClose = retired.close as jest.MockedFunction<
      Connection['close']
    >;
    retiredClose.mockResolvedValue(undefined);
    const factory = jest.fn(async () => retired);
    registerConnectionType('retired-callback-identity', {
      displayName: 'Retired callback identity',
      factory,
      properties: [],
    });
    const callbackFailure = new Error('injected initial callback failure');
    const callback = jest.fn((name: string) => {
      if (name === 'first') throw callbackFailure;
    });
    const lookup = createConnectionsFromConfig(
      {
        connections: {
          first: {is: 'retired-callback-identity'},
          second: {is: 'retired-callback-identity'},
        },
      },
      callback
    );

    await expect(lookup.lookupConnection('first')).rejects.toBe(
      callbackFailure
    );
    expect(retiredClose).toHaveBeenCalledTimes(1);
    await expect(lookup.lookupConnection('second')).rejects.toThrow(
      /retired connection identity/
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(retiredClose).toHaveBeenCalledTimes(1);
  });

  describe('JSON config values', () => {
    test('passes JSON objects through to factory', async () => {
      const sslConfig = {rejectUnauthorized: false};
      const headers = {'X-Custom': 'value'};
      const config = {
        connections: {
          mydb: {
            is: 'jsondb',
            host: 'localhost',
            ssl: sslConfig,
            headers,
          },
        },
      };
      const lookup = createConnectionsFromConfig(config);
      const conn = (await lookup.lookupConnection('mydb')) as unknown as {
        _config: ConnectionConfig;
      };
      expect(conn._config['host']).toBe('localhost');
      expect(conn._config['ssl']).toEqual({rejectUnauthorized: false});
      expect(conn._config['headers']).toEqual({'X-Custom': 'value'});
    });

    test('round-trips JSON values through read/write', () => {
      const original = {
        connections: {
          mydb: {
            is: 'jsondb',
            host: 'localhost',
            ssl: {rejectUnauthorized: false},
            headers: {'X-Tag': 'test'},
          },
        },
      };
      const json = writeConnectionsConfig(original);
      const parsed = readConnectionsConfig(json);
      expect(parsed).toEqual(original);
    });
  });
});
