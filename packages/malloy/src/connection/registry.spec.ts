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
  resolveValue,
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
    registerConnectionType('secretdb', {
      displayName: 'SecretDB',
      factory: async (config: ConnectionConfig) =>
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

  describe('resolveValue', () => {
    test('resolves env references', () => {
      process.env['TEST_SECRET_VALUE'] = 'from-env';
      try {
        expect(resolveValue({env: 'TEST_SECRET_VALUE'})).toBe('from-env');
      } finally {
        delete process.env['TEST_SECRET_VALUE'];
      }
    });

    test('returns undefined for missing env var', () => {
      delete process.env['NONEXISTENT_SECRET_VAR'];
      expect(resolveValue({env: 'NONEXISTENT_SECRET_VAR'})).toBeUndefined();
    });
  });

  describe('env resolution in createConnectionsFromConfig', () => {
    test('resolves env reference on password field', async () => {
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

    test('resolves env reference on secret field', async () => {
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

    test('resolves env reference on string field', async () => {
      process.env['TEST_HOST_VAR'] = 'resolved-host';
      try {
        const config = {
          connections: {
            mydb: {is: 'secretdb', host: {env: 'TEST_HOST_VAR'}},
          },
        };
        const lookup = createConnectionsFromConfig(config);
        const conn = (await lookup.lookupConnection('mydb')) as unknown as {
          _config: ConnectionConfig;
        };
        expect(conn._config['host']).toBe('resolved-host');
      } finally {
        delete process.env['TEST_HOST_VAR'];
      }
    });

    test('passes through plain string values', async () => {
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

    test('omits field when env var is missing', async () => {
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

    test('does not treat JSON objects as env references', async () => {
      const config = {
        connections: {
          mydb: {
            is: 'jsondb',
            ssl: {rejectUnauthorized: false, ca: 'cert-data'},
          },
        },
      };
      const lookup = createConnectionsFromConfig(config);
      const conn = (await lookup.lookupConnection('mydb')) as unknown as {
        _config: ConnectionConfig;
      };
      // Should pass through as-is, not attempt env resolution
      expect(conn._config['ssl']).toEqual({
        rejectUnauthorized: false,
        ca: 'cert-data',
      });
    });

    test('does not resolve {env: "..."} on json-typed properties', async () => {
      process.env['production'] = 'should-not-resolve';
      try {
        const config = {
          connections: {
            mydb: {
              is: 'jsondb',
              ssl: {env: 'production'},
            },
          },
        };
        const lookup = createConnectionsFromConfig(config);
        const conn = (await lookup.lookupConnection('mydb')) as unknown as {
          _config: ConnectionConfig;
        };
        // ssl is type:'json', so {env: "production"} is data, not a ValueRef
        expect(conn._config['ssl']).toEqual({env: 'production'});
      } finally {
        delete process.env['production'];
      }
    });

    test('still resolves single-key env references', async () => {
      process.env['TEST_JSON_HOST'] = 'from-env';
      try {
        const config = {
          connections: {
            mydb: {is: 'jsondb', host: {env: 'TEST_JSON_HOST'}},
          },
        };
        const lookup = createConnectionsFromConfig(config);
        const conn = (await lookup.lookupConnection('mydb')) as unknown as {
          _config: ConnectionConfig;
        };
        expect(conn._config['host']).toBe('from-env');
      } finally {
        delete process.env['TEST_JSON_HOST'];
      }
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
