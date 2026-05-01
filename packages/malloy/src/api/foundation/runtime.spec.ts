/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BaseConnection} from '../../connection/base_connection';
import {MalloyConfig} from './config';
import {contextOverlay} from './config_overlays';
import {Runtime} from './runtime';
import {registerConnectionType} from '../../connection/registry';
import type {ConnectionConfig} from '../../connection/types';
import type {URLReader} from '../../runtime_types';
import type {BuildManifest} from '../../model/malloy_types';

class MockConnection extends BaseConnection {
  constructor(public readonly name: string) {
    super();
  }
  get dialectName() {
    return 'mock';
  }
  getDigest() {
    return 'mock-digest';
  }
  runSQL = jest.fn(async () => ({rows: [], totalRows: 0}));
  fetchTableSchema = jest.fn();
  fetchSelectSchema = jest.fn();
  close = jest.fn(async () => undefined);
  idle = jest.fn(async () => undefined);
}

function mockConnection(name: string): MockConnection {
  return new MockConnection(name);
}

beforeEach(() => {
  registerConnectionType('mockdb', {
    displayName: 'MockDB',
    factory: async (cfg: ConnectionConfig) => mockConnection(cfg.name),
    properties: [],
  });
});

/**
 * Build a counting URLReader that returns canned contents for known URLs
 * and throws otherwise. The `calls` array records the URL strings the
 * runtime asked it to read, in order — handy for asserting cache behavior.
 */
function countingReader(files: Record<string, unknown>): {
  reader: URLReader;
  calls: string[];
} {
  const calls: string[] = [];
  const reader: URLReader = {
    async readURL(url: URL): Promise<string> {
      const key = url.toString();
      calls.push(key);
      if (!(key in files)) throw new Error(`Not found: ${key}`);
      const value = files[key];
      return typeof value === 'string' ? value : JSON.stringify(value);
    },
  };
  return {reader, calls};
}

const sampleManifest: BuildManifest = {
  entries: {abc123: {tableName: 'persisted_abc'}},
};

function configWithManifestURL(): MalloyConfig {
  return new MalloyConfig(
    {connections: {mydb: {is: 'mockdb'}}},
    {
      config: contextOverlay({
        configURL: 'file:///home/user/project/malloy-config.json',
      }),
    }
  );
}

describe('Runtime build manifest resolution', () => {
  it('lazily reads from config.manifestURL on first request', async () => {
    const config = configWithManifestURL();
    const {reader, calls} = countingReader({
      'file:///home/user/project/MANIFESTS/malloy-manifest.json':
        sampleManifest,
    });
    const runtime = new Runtime({config, urlReader: reader});

    // No reads at construction time.
    expect(calls).toEqual([]);

    const result = await runtime._resolveBuildManifest();
    expect(result?.entries['abc123']?.tableName).toBe('persisted_abc');
    expect(calls).toEqual([
      'file:///home/user/project/MANIFESTS/malloy-manifest.json',
    ]);
  });

  it('caches the read across multiple calls', async () => {
    const config = configWithManifestURL();
    const {reader, calls} = countingReader({
      'file:///home/user/project/MANIFESTS/malloy-manifest.json':
        sampleManifest,
    });
    const runtime = new Runtime({config, urlReader: reader});

    await runtime._resolveBuildManifest();
    await runtime._resolveBuildManifest();
    await runtime._resolveBuildManifest();
    expect(calls).toHaveLength(1);
  });

  it('soft-misses to undefined when the manifest file is missing', async () => {
    const config = configWithManifestURL();
    const {reader} = countingReader({}); // empty — every read throws
    const runtime = new Runtime({config, urlReader: reader});

    const result = await runtime._resolveBuildManifest();
    expect(result).toBeUndefined();
  });

  it('returns an empty manifest with loadError when the manifest file is malformed JSON', async () => {
    const config = configWithManifestURL();
    const {reader} = countingReader({
      'file:///home/user/project/MANIFESTS/malloy-manifest.json':
        'not valid json',
    });
    const runtime = new Runtime({config, urlReader: reader});

    const result = await runtime._resolveBuildManifest();
    // Non-strict compiles still see an empty entries dict and fall through
    // to inline SQL — but the loadError rides along so a strict compile
    // can surface the underlying parse failure in its throw.
    expect(result?.entries).toEqual({});
    expect(result?.loadError).toMatch(
      /Manifest file at file:\/\/\/home\/user\/project\/MANIFESTS\/malloy-manifest\.json could not be parsed:/
    );
  });

  it('explicit constructor buildManifest wins; URLReader is not called', async () => {
    const config = configWithManifestURL();
    const explicit: BuildManifest = {
      entries: {xyz: {tableName: 'explicit_table'}},
    };
    const {reader, calls} = countingReader({
      'file:///home/user/project/MANIFESTS/malloy-manifest.json':
        sampleManifest,
    });
    const runtime = new Runtime({
      config,
      urlReader: reader,
      buildManifest: explicit,
    });

    const result = await runtime._resolveBuildManifest();
    expect(result).toBe(explicit);
    expect(calls).toEqual([]);
  });

  it('returns undefined and does not read when config has no manifestURL', async () => {
    const config = new MalloyConfig({
      connections: {mydb: {is: 'mockdb'}},
    });
    expect(config.manifestURL).toBeUndefined();
    const {reader, calls} = countingReader({});
    const runtime = new Runtime({config, urlReader: reader});

    const result = await runtime._resolveBuildManifest();
    expect(result).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('setter overrides any cached auto-read result', async () => {
    const config = configWithManifestURL();
    const {reader} = countingReader({
      'file:///home/user/project/MANIFESTS/malloy-manifest.json':
        sampleManifest,
    });
    const runtime = new Runtime({config, urlReader: reader});

    // Prime the cache with the auto-read.
    const first = await runtime._resolveBuildManifest();
    expect(first?.entries['abc123']).toBeDefined();

    // Setter wins on subsequent calls.
    const explicit: BuildManifest = {entries: {}};
    runtime.buildManifest = explicit;
    const second = await runtime._resolveBuildManifest();
    expect(second).toBe(explicit);
  });
});

describe('Runtime.shutdown / MalloyConfig.shutdown', () => {
  function buildRuntimeWithMockConnections(): {
    runtime: Runtime;
    config: MalloyConfig;
  } {
    const config = new MalloyConfig({
      connections: {a: {is: 'mockdb'}, b: {is: 'mockdb'}},
    });
    const runtime = new Runtime({config});
    return {runtime, config};
  }

  it("shutdown('close') walks the cache and calls close() on each looked-up connection", async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    const a = await config.connections.lookupConnection('a');
    const b = await config.connections.lookupConnection('b');

    await runtime.shutdown('close');

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(b.close).toHaveBeenCalledTimes(1);
    expect(a.idle).not.toHaveBeenCalled();
    expect(b.idle).not.toHaveBeenCalled();
  });

  it("shutdown('idle') walks the cache and calls idle() on each looked-up connection", async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    const a = await config.connections.lookupConnection('a');
    const b = await config.connections.lookupConnection('b');

    await runtime.shutdown('idle');

    expect(a.idle).toHaveBeenCalledTimes(1);
    expect(b.idle).toHaveBeenCalledTimes(1);
    expect(a.close).not.toHaveBeenCalled();
    expect(b.close).not.toHaveBeenCalled();
  });

  it('shutdown() defaults to close', async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    const a = await config.connections.lookupConnection('a');

    await runtime.shutdown();

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(a.idle).not.toHaveBeenCalled();
  });

  it('shutdown skips connections that were never looked up', async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    // Look up only 'a'. 'b' is never instantiated.
    const a = await config.connections.lookupConnection('a');

    await runtime.shutdown('close');

    expect(a.close).toHaveBeenCalledTimes(1);
    // No way to assert on b — it never got constructed. The fact that
    // shutdown didn't throw despite b's absence is the test.
  });

  it('idle preserves the cache — same Connection instance returned on next lookup', async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    const before = await config.connections.lookupConnection('a');

    await runtime.shutdown('idle');

    const after = await config.connections.lookupConnection('a');
    expect(after).toBe(before);
  });

  it('close drops the cache — fresh Connection instance on next lookup', async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    const before = await config.connections.lookupConnection('a');

    await runtime.shutdown('close');

    const after = await config.connections.lookupConnection('a');
    expect(after).not.toBe(before);
  });

  it("releaseConnections() is a deprecated alias for shutdown('close')", async () => {
    const {runtime, config} = buildRuntimeWithMockConnections();
    const a = await config.connections.lookupConnection('a');

    await runtime.releaseConnections();

    expect(a.close).toHaveBeenCalledTimes(1);
    expect(a.idle).not.toHaveBeenCalled();
    // And the cache was dropped.
    const after = await config.connections.lookupConnection('a');
    expect(after).not.toBe(a);
  });

  it('shutdown is a no-op for runtimes built without a MalloyConfig', async () => {
    const conn = mockConnection('legacy');
    const runtime = new Runtime({connection: conn});
    await runtime.shutdown('close');
    await runtime.shutdown('idle');
    expect(conn.close).not.toHaveBeenCalled();
    expect(conn.idle).not.toHaveBeenCalled();
  });
});

describe('BaseConnection default idle', () => {
  it('is a no-op (does not throw) for backends that do not override it', async () => {
    // Use the genuine inheritance path: a Connection that doesn't override
    // idle. MockConnection above sets idle to a jest.fn so it doesn't
    // exercise the default — this trivial subclass leaves it inherited.
    class Inheriting extends BaseConnection {
      get name() {
        return 'trivial';
      }
      get dialectName() {
        return 'trivial';
      }
      getDigest = () => 'trivial';
      runSQL = jest.fn();
      fetchTableSchema = jest.fn();
      fetchSelectSchema = jest.fn();
    }
    const c = new Inheriting();
    await expect(c.idle()).resolves.toBeUndefined();
  });
});
