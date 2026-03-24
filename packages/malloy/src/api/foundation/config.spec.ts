/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyConfig} from './config';
import {registerConnectionType} from '../../connection/registry';
import type {ConnectionConfig, Connection} from '../../connection/types';

function mockConnection(name: string): Connection {
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
  } as unknown as Connection;
}

describe('MalloyConfig.log', () => {
  beforeEach(() => {
    registerConnectionType('mockdb', {
      displayName: 'MockDB',
      factory: async (config: ConnectionConfig) => mockConnection(config.name),
      properties: [
        {name: 'host', displayName: 'Host', type: 'string', optional: true},
        {name: 'port', displayName: 'Port', type: 'number', optional: true},
        {
          name: 'databasePath',
          displayName: 'Database Path',
          type: 'string',
          optional: true,
        },
      ],
    });
    registerConnectionType('jsondb', {
      displayName: 'JsonDB',
      factory: async (config: ConnectionConfig) => mockConnection(config.name),
      properties: [
        {name: 'host', displayName: 'Host', type: 'string', optional: true},
        {name: 'ssl', displayName: 'SSL', type: 'json', optional: true},
      ],
    });
  });

  function configLog(json: string) {
    return new MalloyConfig(json).log;
  }

  it('accepts a valid config', () => {
    expect(
      configLog(JSON.stringify({connections: {mydb: {is: 'mockdb'}}}))
    ).toEqual([]);
  });

  it('reports JSON parse errors', () => {
    const log = configLog('not json at all');
    expect(log).toHaveLength(1);
    expect(log[0].severity).toBe('error');
    expect(log[0].code).toBe('config-validation');
    expect(log[0].message).toContain('Invalid JSON');
  });

  it('reports non-object config', () => {
    const log = configLog('"just a string"');
    expect(log).toHaveLength(1);
    expect(log[0].severity).toBe('error');
    expect(log[0].message).toContain('not a JSON object');
  });

  it('warns on unknown top-level keys', () => {
    const log = configLog(JSON.stringify({connections: {}, notAKey: 'hello'}));
    expect(log).toHaveLength(1);
    expect(log[0].severity).toBe('warn');
    expect(log[0].message).toContain('unknown config key');
  });

  it('warns on unknown connection type', () => {
    const log = configLog(
      JSON.stringify({connections: {mydb: {is: 'faketype'}}})
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('unknown connection type');
  });

  it('warns on missing "is" field', () => {
    const log = configLog(JSON.stringify({connections: {mydb: {}}}));
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('missing required "is"');
  });

  it('warns on unknown property for a connection type', () => {
    const log = configLog(
      JSON.stringify({connections: {mydb: {is: 'mockdb', notARealProp: 'x'}}})
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('unknown property');
  });

  it('suggests closest match for misspelled property', () => {
    const log = configLog(
      JSON.stringify({
        connections: {mydb: {is: 'mockdb', databsePath: '/tmp/test.db'}},
      })
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('Did you mean "databasePath"');
  });

  it('suggests closest match for misspelled connection type', () => {
    const log = configLog(
      JSON.stringify({connections: {mydb: {is: 'mockbd'}}})
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('Did you mean "mockdb"');
  });

  it('suggests closest match for misspelled top-level key', () => {
    const log = configLog(JSON.stringify({conections: {}}));
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('Did you mean "connections"');
  });

  it('warns on wrong value type', () => {
    const log = configLog(
      JSON.stringify({connections: {mydb: {is: 'mockdb', databasePath: 123}}})
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('should be a string');
  });

  it('accepts env var references when variable is set', () => {
    process.env['TEST_VALIDATE_DB_PATH'] = '/tmp/test.db';
    try {
      const log = configLog(
        JSON.stringify({
          connections: {
            mydb: {is: 'mockdb', databasePath: {env: 'TEST_VALIDATE_DB_PATH'}},
          },
        })
      );
      expect(log).toEqual([]);
    } finally {
      delete process.env['TEST_VALIDATE_DB_PATH'];
    }
  });

  it('warns when env var reference points to unset variable', () => {
    delete process.env['DEFINITELY_NOT_SET_12345'];
    const log = configLog(
      JSON.stringify({
        connections: {
          mydb: {
            is: 'mockdb',
            databasePath: {env: 'DEFINITELY_NOT_SET_12345'},
          },
        },
      })
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('DEFINITELY_NOT_SET_12345');
    expect(log[0].message).toContain('not set');
  });

  it('accepts valid manifestPath', () => {
    expect(configLog(JSON.stringify({manifestPath: 'custom/path'}))).toEqual(
      []
    );
  });

  it('returns no warnings for empty config', () => {
    expect(configLog('{}')).toEqual([]);
  });

  it('accepts virtualMap as a valid top-level key', () => {
    expect(
      configLog(JSON.stringify({virtualMap: {someFile: 'someContent'}}))
    ).toEqual([]);
  });

  it('warns when connections is not an object', () => {
    const log = configLog(JSON.stringify({connections: ''}));
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('should be an object');
  });

  it('does not treat objects with extra keys as env refs', () => {
    const log = configLog(
      JSON.stringify({
        connections: {
          mydb: {is: 'mockdb', databasePath: {env: 'X', extra: true}},
        },
      })
    );
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('should be a string');
  });

  it('does not warn about env refs on json-type properties', () => {
    const log = configLog(
      JSON.stringify({
        connections: {mydb: {is: 'jsondb', ssl: {env: 'UNSET_ENV_FOR_TEST'}}},
      })
    );
    const sslWarnings = log.filter(w => w.message.includes('.ssl'));
    expect(sslWarnings).toEqual([]);
  });
});
