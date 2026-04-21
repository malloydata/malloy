/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyConfig} from './config';
import {contextOverlay} from './config_overlays';
import {discoverConfig} from './config_discover';
import {
  createConnectionsFromConfig,
  registerConnectionType,
} from '../../connection/registry';
import type {ConnectionConfig, Connection} from '../../connection/types';
import type {URLReader} from '../../runtime_types';

let capturedStrictMode: unknown;
let strictFactoryCalls = 0;

function mockConnection(name: string, dialectName = 'mock'): Connection {
  return {
    name,
    dialectName,
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

/**
 * Build a minimal URLReader backed by an in-memory map of URL→contents.
 * POJO values are JSON-stringified; string values are returned raw (useful
 * for injecting malformed JSON). Unknown URLs throw, which `discoverConfig`
 * interprets as "not found".
 */
function mockReader(files: Record<string, unknown>): URLReader {
  return {
    async readURL(url: URL): Promise<string> {
      const key = url.toString();
      if (!(key in files)) {
        throw new Error(`Not found: ${key}`);
      }
      const value = files[key];
      return typeof value === 'string' ? value : JSON.stringify(value);
    },
  };
}

beforeEach(() => {
  capturedStrictMode = undefined;
  strictFactoryCalls = 0;
  registerConnectionType('mockdb', {
    displayName: 'MockDB',
    factory: async (config: ConnectionConfig) =>
      mockConnection(config.name, 'mockdb-dialect'),
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
    factory: async (config: ConnectionConfig) =>
      mockConnection(config.name, 'jsondb-dialect'),
    properties: [
      {name: 'host', displayName: 'Host', type: 'string', optional: true},
      {name: 'ssl', displayName: 'SSL', type: 'json', optional: true},
    ],
  });
  registerConnectionType('strictdb', {
    displayName: 'StrictDB',
    factory: async (config: ConnectionConfig) => {
      strictFactoryCalls += 1;
      capturedStrictMode = config['mode'];
      return mockConnection(config.name, 'strictdb-dialect');
    },
    properties: [
      {
        name: 'mode',
        displayName: 'Mode',
        type: 'string',
        optional: true,
        requireLiteralString: true,
      },
    ],
  });
});

describe('MalloyConfig.log validation warnings', () => {
  function configLog(pojo: object) {
    return new MalloyConfig(pojo).log;
  }

  it('accepts a valid config', () => {
    expect(configLog({connections: {mydb: {is: 'mockdb'}}})).toEqual([]);
  });

  it('reports JSON parse errors (string form)', () => {
    const log = new MalloyConfig('not json at all').log;
    expect(log).toHaveLength(1);
    expect(log[0].severity).toBe('error');
    expect(log[0].code).toBe('config-validation');
    expect(log[0].message).toContain('Invalid JSON');
  });

  it('reports non-object config', () => {
    const log = new MalloyConfig('"just a string"').log;
    expect(log).toHaveLength(1);
    expect(log[0].severity).toBe('error');
    expect(log[0].message).toContain('not a JSON object');
  });

  it('warns on unknown top-level keys', () => {
    const log = configLog({connections: {}, notAKey: 'hello'});
    expect(log).toHaveLength(1);
    expect(log[0].severity).toBe('warn');
    expect(log[0].message).toContain('unknown config key');
  });

  it('warns on unknown connection type', () => {
    const log = configLog({connections: {mydb: {is: 'faketype'}}});
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('unknown connection type');
  });

  it('warns on missing "is" field', () => {
    const log = configLog({connections: {mydb: {}}});
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('missing required "is"');
  });

  it('warns on unknown property for a connection type', () => {
    const log = configLog({
      connections: {mydb: {is: 'mockdb', notARealProp: 'x'}},
    });
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('unknown property');
  });

  it('suggests closest match for misspelled property', () => {
    const log = configLog({
      connections: {mydb: {is: 'mockdb', databsePath: '/tmp/test.db'}},
    });
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('Did you mean "databasePath"');
  });

  it('suggests closest match for misspelled connection type', () => {
    const log = configLog({connections: {mydb: {is: 'mockbd'}}});
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('Did you mean "mockdb"');
  });

  it('suggests closest match for misspelled top-level key', () => {
    const log = configLog({conections: {}});
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('Did you mean "connections"');
  });

  it('warns on wrong value type', () => {
    const log = configLog({
      connections: {mydb: {is: 'mockdb', databasePath: 123}},
    });
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('should be a string');
  });

  it('accepts valid manifestPath', () => {
    expect(configLog({manifestPath: 'custom/path'})).toEqual([]);
  });

  it('returns no warnings for empty config', () => {
    expect(configLog({})).toEqual([]);
  });

  it('accepts virtualMap as a valid top-level key', () => {
    expect(configLog({virtualMap: {someFile: 'someContent'}})).toEqual([]);
  });

  it('warns when connections is not an object', () => {
    const log = configLog({connections: ''});
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('should be an object');
  });

  it('does not treat objects with extra keys as references', () => {
    const log = configLog({
      connections: {
        mydb: {is: 'mockdb', databasePath: {env: 'X', extra: true}},
      },
    });
    expect(log).toHaveLength(1);
    expect(log[0].message).toContain('should be a string');
  });

  it('does not warn about reference shapes on json-type properties', () => {
    const log = configLog({
      connections: {mydb: {is: 'jsondb', ssl: {env: 'UNSET_ENV_FOR_TEST'}}},
    });
    const sslWarnings = log.filter(w => w.message.includes('.ssl'));
    expect(sslWarnings).toEqual([]);
  });
});

describe('MalloyConfig constructor forms', () => {
  it('accepts a POJO as the first argument', () => {
    const config = new MalloyConfig({
      connections: {mydb: {is: 'mockdb'}},
    });
    expect(config.log).toEqual([]);
  });

  it('accepts a JSON string as the first argument', () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {mydb: {is: 'mockdb'}}})
    );
    expect(config.log).toEqual([]);
  });

  it('exposes manifestPath as a readonly field', () => {
    const config = new MalloyConfig({manifestPath: 'my/manifest'});
    expect(config.manifestPath).toBe('my/manifest');
  });

  it('exposes virtualMap converted to Map-of-Maps', () => {
    const config = new MalloyConfig({
      virtualMap: {duckdb: {flights: 'malloytest.flights'}},
    });
    expect(config.virtualMap?.get('duckdb')?.get('flights')).toBe(
      'malloytest.flights'
    );
  });
});

describe('MalloyConfig manifestURL resolution', () => {
  function configWith(
    pojo: object,
    configURL: string | undefined
  ): MalloyConfig {
    return new MalloyConfig(
      pojo,
      configURL === undefined
        ? undefined
        : {config: contextOverlay({configURL})}
    );
  }

  it('defaults to MANIFESTS/ next to the config file', () => {
    const config = configWith(
      {},
      'file:///home/user/project/malloy-config.json'
    );
    expect(config.manifestURL?.toString()).toBe(
      'file:///home/user/project/MANIFESTS/malloy-manifest.json'
    );
  });

  it('honors an explicit relative manifestPath', () => {
    const config = configWith(
      {manifestPath: 'build/MANIFESTS'},
      'file:///home/user/project/malloy-config.json'
    );
    expect(config.manifestURL?.toString()).toBe(
      'file:///home/user/project/build/MANIFESTS/malloy-manifest.json'
    );
  });

  it('honors a parent-relative manifestPath', () => {
    const config = configWith(
      {manifestPath: '../shared/MANIFESTS'},
      'file:///home/user/project/malloy-config.json'
    );
    expect(config.manifestURL?.toString()).toBe(
      'file:///home/user/shared/MANIFESTS/malloy-manifest.json'
    );
  });

  it('honors an absolute filesystem-style manifestPath', () => {
    const config = configWith(
      {manifestPath: '/project/malloy/MANIFESTS'},
      'file:///home/user/whatever/malloy-config.json'
    );
    expect(config.manifestURL?.toString()).toBe(
      'file:///project/malloy/MANIFESTS/malloy-manifest.json'
    );
  });

  it('honors a full URL manifestPath, ignoring the configURL base', () => {
    const config = configWith(
      {manifestPath: 'file:///elsewhere/stuff'},
      'file:///home/user/project/malloy-config.json'
    );
    expect(config.manifestURL?.toString()).toBe(
      'file:///elsewhere/stuff/malloy-manifest.json'
    );
  });

  it('handles a trailing slash on manifestPath', () => {
    const config = configWith(
      {manifestPath: 'MANIFESTS/'},
      'file:///home/user/project/malloy-config.json'
    );
    expect(config.manifestURL?.toString()).toBe(
      'file:///home/user/project/MANIFESTS/malloy-manifest.json'
    );
  });

  it('is undefined when no configURL is in the overlays', () => {
    const config = new MalloyConfig({});
    expect(config.manifestURL).toBeUndefined();
  });

  it('is undefined when overlays are present but configURL is missing', () => {
    const config = new MalloyConfig(
      {},
      {config: contextOverlay({rootDirectory: 'file:///home/user/project/'})}
    );
    expect(config.manifestURL).toBeUndefined();
  });

  it('warns loudly when the config overlay returns a Promise for configURL', () => {
    const config = new MalloyConfig(
      {},
      {config: async () => 'file:///home/user/project/malloy-config.json'}
    );
    expect(config.manifestURL).toBeUndefined();
    const warnings = config.log.filter(l => l.code === 'config-overlay');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('Promise');
    expect(warnings[0].message).toContain('configURL');
  });

  it('keeps manifestPath as the raw string for app inspection', () => {
    const config = configWith(
      {manifestPath: 'build/MANIFESTS'},
      'file:///home/user/project/malloy-config.json'
    );
    expect(config.manifestPath).toBe('build/MANIFESTS');
  });
});

describe('MalloyConfig overlay resolution', () => {
  it('resolves env references via the default stack', async () => {
    process.env['TEST_DB_PATH_ENV'] = '/tmp/test.db';
    try {
      const config = new MalloyConfig({
        connections: {
          mydb: {is: 'mockdb', databasePath: {env: 'TEST_DB_PATH_ENV'}},
        },
      });
      expect(config.log).toEqual([]);
      const conn = await config.connections.lookupConnection('mydb');
      expect(conn.name).toBe('mydb');
    } finally {
      delete process.env['TEST_DB_PATH_ENV'];
    }
  });

  it('silently drops unresolved env references', () => {
    delete process.env['DEFINITELY_NOT_SET_12345'];
    const config = new MalloyConfig({
      connections: {
        mydb: {
          is: 'mockdb',
          databasePath: {env: 'DEFINITELY_NOT_SET_12345'},
        },
      },
    });
    // Silent drop: the reference resolves to undefined and the field is
    // omitted. No warning in the log.
    expect(config.log).toEqual([]);
  });

  it('warns on unknown overlay source at lookup time', async () => {
    const config = new MalloyConfig({
      connections: {
        mydb: {is: 'mockdb', databasePath: {nosuch: 'whatever'}},
      },
    });
    // Reference resolution is deferred — no warning yet.
    expect(config.log.filter(l => l.code === 'config-overlay')).toHaveLength(0);
    await config.connections.lookupConnection('mydb');
    const warnings = config.log.filter(l => l.code === 'config-overlay');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('unknown overlay source "nosuch"');
  });

  it('supports async overlays returning a Promise', async () => {
    const config = new MalloyConfig(
      {
        connections: {
          mydb: {is: 'mockdb', databasePath: {secret: 'db_path'}},
        },
      },
      {
        secret: async path =>
          path[0] === 'db_path' ? '/async/path' : undefined,
      }
    );
    expect(config.log).toEqual([]);
    const conn = (await config.connections.lookupConnection(
      'mydb'
    )) as unknown as {name: string};
    expect(conn.name).toBe('mydb');
  });

  it('resolves {config: ...} references from a host-supplied stack', () => {
    const config = new MalloyConfig(
      {
        connections: {
          mydb: {is: 'mockdb', databasePath: {config: 'rootDirectory'}},
        },
      },
      {config: contextOverlay({rootDirectory: '/project'})}
    );
    expect(config.log).toEqual([]);
  });

  it('passes reference-shaped values through on json-typed slots', async () => {
    const config = new MalloyConfig({
      connections: {
        mydb: {is: 'jsondb', ssl: {env: 'SOME_ENV_VAR'}},
      },
    });
    expect(config.log).toEqual([]);
    // ssl is json-typed — the object passes through literally, no env lookup.
    const conn = (await config.connections.lookupConnection(
      'mydb'
    )) as unknown as {name: string};
    expect(conn.name).toBe('mydb');
  });
});

describe('MalloyConfig wrapConnections', () => {
  it('replaces the connections lookup in place', async () => {
    const config = new MalloyConfig({
      connections: {mydb: {is: 'mockdb'}},
    });
    const fake = mockConnection('wrapped');
    config.wrapConnections(() => ({
      lookupConnection: async () => fake,
    }));
    const conn = await config.connections.lookupConnection('mydb');
    expect(conn.name).toBe('wrapped');
  });
});

describe('discoverConfig', () => {
  it('walks up from start to find a config at the ceiling', async () => {
    const reader = mockReader({
      'file:///project/malloy-config.json': {
        connections: {mydb: {is: 'mockdb'}},
      },
    });
    const config = await discoverConfig(
      new URL('file:///project/sub/deep/'),
      new URL('file:///project/'),
      reader
    );
    expect(config).not.toBeNull();
    // Resolved config exposes the connection.
    expect(config?.log).toEqual([]);
    const conn = await config!.connections.lookupConnection('mydb');
    expect(conn.name).toBe('mydb');
  });

  it('resolves manifestURL relative to the matched config file', async () => {
    const reader = mockReader({
      'file:///project/sub/malloy-config.json': {
        connections: {mydb: {is: 'mockdb'}},
      },
    });
    const config = await discoverConfig(
      new URL('file:///project/sub/deep/'),
      new URL('file:///project/'),
      reader
    );
    // manifestURL hangs off the file that matched, not the ceiling.
    expect(config?.manifestURL?.toString()).toBe(
      'file:///project/sub/MANIFESTS/malloy-manifest.json'
    );
  });

  it('returns null when startURL is not under the ceiling', async () => {
    const reader = mockReader({
      'file:///project/malloy-config.json': {connections: {}},
    });
    const config = await discoverConfig(
      new URL('file:///elsewhere/'),
      new URL('file:///project/'),
      reader
    );
    expect(config).toBeNull();
  });

  it('throws when a matched config file has malformed JSON', async () => {
    const reader = mockReader({
      'file:///project/malloy-config.json': '{not valid json',
    });
    await expect(
      discoverConfig(
        new URL('file:///project/'),
        new URL('file:///project/'),
        reader
      )
    ).rejects.toThrow(/Malformed JSON.*malloy-config\.json/);
  });

  it('local supersedes shared entirely when both exist', async () => {
    const reader = mockReader({
      'file:///project/malloy-config.json': {
        connections: {
          shared_only: {is: 'mockdb', host: 'shared-host'},
          both: {is: 'mockdb', host: 'from-shared'},
        },
      },
      'file:///project/malloy-config-local.json': {
        connections: {
          local_only: {is: 'mockdb'},
          both: {is: 'mockdb', host: 'from-local'},
        },
      },
    });
    const config = await discoverConfig(
      new URL('file:///project/'),
      new URL('file:///project/'),
      reader
    );
    expect(config).not.toBeNull();
    expect(config?.log).toEqual([]);
    // Only local's connections are present — shared is not merged in.
    await config!.connections.lookupConnection('local_only');
    await config!.connections.lookupConnection('both');
    await expect(
      config!.connections.lookupConnection('shared_only')
    ).rejects.toThrow();
    // manifestURL hangs off the local file's directory.
    expect(config?.manifestURL?.toString()).toBe(
      'file:///project/MANIFESTS/malloy-manifest.json'
    );
  });

  it('merges caller-supplied extraOverlays on top of discovery overlays', async () => {
    const reader = mockReader({
      'file:///project/malloy-config.json': {
        connections: {
          mydb: {
            is: 'mockdb',
            databasePath: {session: 'dbPath'},
          },
        },
      },
    });
    const config = await discoverConfig(
      new URL('file:///project/'),
      new URL('file:///project/'),
      reader,
      {session: () => '/tmp/session.db'}
    );
    expect(config?.log).toEqual([]);
    // Session overlay was merged in alongside discovery's `config` overlay.
    // And manifestURL still resolves — extraOverlays did not clobber
    // discovery's `config` entry.
    expect(config?.manifestURL?.toString()).toBe(
      'file:///project/MANIFESTS/malloy-manifest.json'
    );
  });
});

describe('MalloyConfig property defaults and includeDefaultConnections', () => {
  let capturedRoot: unknown;
  let capturedFlavor: unknown;

  beforeEach(() => {
    capturedRoot = undefined;
    capturedFlavor = undefined;
    registerConnectionType('refdb', {
      displayName: 'RefDB',
      factory: async (config: ConnectionConfig) => {
        capturedRoot = config['root'];
        capturedFlavor = config['flavor'];
        return mockConnection(config.name, 'refdb-dialect');
      },
      properties: [
        {
          name: 'root',
          displayName: 'Root',
          type: 'string',
          optional: true,
          default: {config: 'rootDirectory'},
        },
        {
          name: 'flavor',
          displayName: 'Flavor',
          type: 'string',
          optional: true,
          default: 'vanilla',
        },
      ],
    });
  });

  it('fabricates an entry for a registered type not present in connections', async () => {
    const config = new MalloyConfig({includeDefaultConnections: true});
    expect(config.log).toEqual([]);
    // mockdb wasn't listed, so fabrication adds a {is: 'mockdb'} entry.
    const conn = await config.connections.lookupConnection('mockdb');
    expect(conn.name).toBe('mockdb');
    expect(conn.dialectName).toBe('mockdb-dialect');
  });

  it('does not fabricate when the type is already used', async () => {
    const config = new MalloyConfig({
      connections: {mydb: {is: 'mockdb'}},
      includeDefaultConnections: true,
    });
    // mockdb is used by 'mydb', so no auto-added connection named 'mockdb'.
    await expect(
      config.connections.lookupConnection('mockdb')
    ).rejects.toThrow();
    const conn = await config.connections.lookupConnection('mydb');
    expect(conn.name).toBe('mydb');
  });

  it('does not clobber a user-named connection that collides with a type name', async () => {
    const config = new MalloyConfig({
      connections: {mockdb: {is: 'jsondb'}},
      includeDefaultConnections: true,
    });
    // The user's 'mockdb'-named entry (actually a jsondb) is preserved;
    // fabrication must not overwrite it with a mockdb-type default.
    const conn = await config.connections.lookupConnection('mockdb');
    expect(conn.dialectName).toBe('jsondb-dialect');
  });

  it('applies reference-shaped property defaults to fabricated entries', async () => {
    const config = new MalloyConfig(
      {includeDefaultConnections: true},
      {config: contextOverlay({rootDirectory: '/my/project'})}
    );
    // refdb's `root` default is {config: 'rootDirectory'}. Fabrication
    // creates the bare entry; applyPropertyDefaults then fills in `root`.
    await config.connections.lookupConnection('refdb');
    expect(capturedRoot).toBe('/my/project');
  });

  it('applies property defaults to user-listed entries too', async () => {
    const config = new MalloyConfig(
      {connections: {myref: {is: 'refdb'}}},
      {config: contextOverlay({rootDirectory: '/my/project'})}
    );
    // This is the fix for the earlier bug: property defaults used to only
    // fire during fabrication, leaving explicit entries underconfigured.
    // A user-listed refdb with no `root` should still pick up the default.
    await config.connections.lookupConnection('myref');
    expect(capturedRoot).toBe('/my/project');
  });

  it('user-specified values override property defaults', async () => {
    const config = new MalloyConfig(
      {connections: {myref: {is: 'refdb', root: '/explicit'}}},
      {config: contextOverlay({rootDirectory: '/my/project'})}
    );
    await config.connections.lookupConnection('myref');
    expect(capturedRoot).toBe('/explicit');
  });

  it('applies literal property defaults to user-listed entries', async () => {
    // refdb's `flavor` property has `default: 'vanilla'` — a literal, not
    // a reference. A user-listed refdb without flavor should pick it up.
    const config = new MalloyConfig({connections: {myref: {is: 'refdb'}}});
    expect(config.log).toEqual([]);
    await config.connections.lookupConnection('myref');
    expect(capturedFlavor).toBe('vanilla');
  });

  it('silently drops unresolved reference-shaped defaults', async () => {
    // No `rootDirectory` in the config overlay (default overlay returns
    // undefined for everything) — refdb's `root` default resolves to
    // undefined and the property is silently omitted, no warning in the
    // log. The `flavor` literal default still fires independently.
    const config = new MalloyConfig({connections: {myref: {is: 'refdb'}}});
    expect(config.log).toEqual([]);
    await config.connections.lookupConnection('myref');
    expect(capturedRoot).toBeUndefined();
    expect(capturedFlavor).toBe('vanilla');
  });
});

describe('MalloyConfig fail-closed literal string properties', () => {
  it('passes through exact literal strings', async () => {
    const config = new MalloyConfig({
      connections: {strict: {is: 'strictdb', mode: 'sandboxed'}},
    });

    await config.connections.lookupConnection('strict');
    expect(capturedStrictMode).toBe('sandboxed');
    expect(strictFactoryCalls).toBe(1);
  });

  it('does not silently drop mistyped values', async () => {
    const config = new MalloyConfig({
      connections: {strict: {is: 'strictdb', mode: true}},
    });

    await expect(config.connections.lookupConnection('strict')).rejects.toThrow(
      'Connection "strict" property "mode" must be a literal string'
    );
    expect(capturedStrictMode).toBeUndefined();
    expect(strictFactoryCalls).toBe(0);
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.strict.mode: must be a literal string, got boolean'
    );
  });

  it('does not accept reference-shaped values', async () => {
    const config = new MalloyConfig({
      connections: {strict: {is: 'strictdb', mode: {env: 'STRICT_MODE'}}},
    });

    await expect(config.connections.lookupConnection('strict')).rejects.toThrow(
      'Connection "strict" property "mode" must be a literal string'
    );
    expect(capturedStrictMode).toBeUndefined();
    expect(strictFactoryCalls).toBe(0);
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.strict.mode: must be a literal string and cannot use an overlay reference'
    );
  });

  it('enforces literal string properties in resolved registry configs', async () => {
    const lookup = createConnectionsFromConfig({
      connections: {strict: {is: 'strictdb', mode: {env: 'STRICT_MODE'}}},
    });

    await expect(lookup.lookupConnection('strict')).rejects.toThrow(
      'Connection "strict" property "mode" must be a literal string'
    );
    expect(capturedStrictMode).toBeUndefined();
    expect(strictFactoryCalls).toBe(0);
  });
});
