/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyConfig} from './config';
import {contextOverlay} from './config_overlays';
import {Runtime} from './runtime';
import {registerConnectionType} from '../../connection/registry';
import type {ConnectionConfig, Connection} from '../../connection/types';
import type {URLReader} from '../../runtime_types';
import type {BuildManifest} from '../../model/malloy_types';

function mockConnection(name: string): Connection {
  return {
    name,
    dialectName: 'mock',
    getDigest: () => 'mock-digest',
  } as unknown as Connection;
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
