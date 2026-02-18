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
  resolveSecret,
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
    registerConnectionType('secretdb', {
      factory: (config: ConnectionConfig) =>
        mockConnection(config.name, config),
      properties: [
        {name: 'host', displayName: 'Host', type: 'string', optional: true},
        {
          name: 'password',
          displayName: 'Password',
          type: 'password',
          optional: true,
        },
        {
          name: 'token',
          displayName: 'Token',
          type: 'secret',
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

  describe('resolveSecret', () => {
    test('passes through plain strings', () => {
      expect(resolveSecret('my-token')).toBe('my-token');
    });

    test('resolves env references', () => {
      process.env['TEST_SECRET_VALUE'] = 'from-env';
      try {
        expect(resolveSecret({env: 'TEST_SECRET_VALUE'})).toBe('from-env');
      } finally {
        delete process.env['TEST_SECRET_VALUE'];
      }
    });

    test('returns undefined for missing env var', () => {
      delete process.env['NONEXISTENT_SECRET_VAR'];
      expect(resolveSecret({env: 'NONEXISTENT_SECRET_VAR'})).toBeUndefined();
    });

    test('returns undefined for non-string/non-object values', () => {
      expect(resolveSecret(42)).toBeUndefined();
      expect(resolveSecret(true)).toBeUndefined();
      expect(resolveSecret(null)).toBeUndefined();
      expect(resolveSecret(undefined)).toBeUndefined();
    });

    test('returns undefined for unrecognized object shapes', () => {
      expect(resolveSecret({vault: 'path/to/secret'})).toBeUndefined();
    });
  });

  describe('secret resolution in createConnectionsFromConfig', () => {
    test('resolves password env reference', async () => {
      process.env['TEST_DB_PASSWORD'] = 'secret-pw';
      try {
        const config = {
          connections: {
            mydb: {is: 'secretdb', password: {env: 'TEST_DB_PASSWORD'}},
          },
        };
        const lookup = createConnectionsFromConfig(config);
        const conn = (await lookup.lookupConnection('mydb')) as unknown as {
          _config: ConnectionConfig;
        };
        expect(conn._config['password']).toBe('secret-pw');
      } finally {
        delete process.env['TEST_DB_PASSWORD'];
      }
    });

    test('resolves secret env reference', async () => {
      process.env['TEST_API_TOKEN'] = 'my-token';
      try {
        const config = {
          connections: {
            mydb: {is: 'secretdb', token: {env: 'TEST_API_TOKEN'}},
          },
        };
        const lookup = createConnectionsFromConfig(config);
        const conn = (await lookup.lookupConnection('mydb')) as unknown as {
          _config: ConnectionConfig;
        };
        expect(conn._config['token']).toBe('my-token');
      } finally {
        delete process.env['TEST_API_TOKEN'];
      }
    });

    test('passes through plain string for sensitive fields', async () => {
      const config = {
        connections: {
          mydb: {is: 'secretdb', password: 'plain-pw', token: 'plain-tok'},
        },
      };
      const lookup = createConnectionsFromConfig(config);
      const conn = (await lookup.lookupConnection('mydb')) as unknown as {
        _config: ConnectionConfig;
      };
      expect(conn._config['password']).toBe('plain-pw');
      expect(conn._config['token']).toBe('plain-tok');
    });

    test('omits sensitive field when env var is missing', async () => {
      delete process.env['MISSING_VAR'];
      const config = {
        connections: {
          mydb: {is: 'secretdb', password: {env: 'MISSING_VAR'}},
        },
      };
      const lookup = createConnectionsFromConfig(config);
      const conn = (await lookup.lookupConnection('mydb')) as unknown as {
        _config: ConnectionConfig;
      };
      expect(conn._config['password']).toBeUndefined();
    });

    test('does not resolve env references on non-sensitive fields', async () => {
      process.env['TEST_HOST_VAR'] = 'resolved-host';
      try {
        const config = {
          connections: {
            mydb: {
              is: 'secretdb' as const,
              host: {env: 'TEST_HOST_VAR'} as unknown as string,
            },
          },
        };
        const lookup = createConnectionsFromConfig(config);
        const conn = (await lookup.lookupConnection('mydb')) as unknown as {
          _config: ConnectionConfig;
        };
        expect(conn._config['host']).toBeUndefined();
      } finally {
        delete process.env['TEST_HOST_VAR'];
      }
    });
  });
});
