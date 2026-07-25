/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {pathToFileURL} from 'url';
import type {ConnectionConfig} from '@malloydata/malloy';
import {
  buildDuckDBShareKey,
  DEFAULT_SHAREABLE_ATTACH_ALIAS,
  DuckDBConfigValidationError,
  NATURAL_SHAREABLE_ATTACH_ALIAS,
  normalizeDuckDBConfig,
  sqlIdentifierLiteral,
} from './duckdb_config';
import * as pathSecurity from './path_security';

describe('normalizeDuckDBConfig', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-duckdb-'));
  const workingDirectory = path.join(tempRoot, 'working');
  const allowedA = path.join(tempRoot, 'allowed-a');
  const allowedB = path.join(tempRoot, 'allowed-b');
  const canonical = (value: string) => fs.realpathSync.native(value);

  beforeAll(() => {
    fs.mkdirSync(workingDirectory, {recursive: true});
    fs.mkdirSync(allowedA, {recursive: true});
    fs.mkdirSync(allowedB, {recursive: true});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseConfig = (
    overrides: Partial<ConnectionConfig> = {}
  ): ConnectionConfig => ({
    name: 'duckdb',
    databasePath: ':memory:',
    ...overrides,
  });

  it('accepts allowedDirectories as a JSON array of strings', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({allowedDirectories: [allowedA, allowedB]})
    );

    expect(normalized.allowedDirectories).toEqual(
      [allowedA, allowedB].map(value => canonical(value)).sort()
    );
  });

  it('rejects non-array allowedDirectories', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({allowedDirectories: allowedA as unknown as string[]})
      )
    ).toThrow(DuckDBConfigValidationError);
  });

  it('rejects non-string entries inside allowedDirectories', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({allowedDirectories: [allowedA, 42] as unknown as string[]})
      )
    ).toThrow('allowedDirectories must be a JSON array of strings');
  });

  it('wraps invalid path inputs as DuckDB config validation errors', () => {
    expect(() =>
      normalizeDuckDBConfig(baseConfig({workingDirectory: ''}))
    ).toThrow(DuckDBConfigValidationError);
    expect(() =>
      normalizeDuckDBConfig(baseConfig({workingDirectory: ''}))
    ).toThrow('workingDirectory is invalid: path must not be empty');
  });

  it('accepts a file:// URL workingDirectory and resolves it to a path', () => {
    // `workingDirectory` defaults to `config.rootDirectory`, which the config
    // stack carries as a URL string — make sure it lands as a real OS path and
    // not a `file:`-prefixed segment joined to the process cwd.
    const normalized = normalizeDuckDBConfig(
      baseConfig({workingDirectory: pathToFileURL(workingDirectory).toString()})
    );

    expect(normalized.workingDirectory).toEqual(canonical(workingDirectory));
  });

  it('resolves a relative databasePath against workingDirectory', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({workingDirectory, databasePath: 'analytics.duckdb'})
    );

    expect(normalized.databasePath).toEqual(
      path.join(canonical(workingDirectory), 'analytics.duckdb')
    );
  });

  it('resolves a relative databasePath against a file:// URL workingDirectory', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({
        workingDirectory: pathToFileURL(workingDirectory).toString(),
        databasePath: 'nested/analytics.duckdb',
      })
    );

    expect(normalized.databasePath).toEqual(
      path.join(canonical(workingDirectory), 'nested', 'analytics.duckdb')
    );
  });

  it('leaves an absolute databasePath untouched by workingDirectory', () => {
    // A real file so the result is the path verbatim (no missing-leaf
    // canonicalization) — proving an absolute path passes through and is not
    // re-anchored under workingDirectory.
    const absolute = path.join(allowedA, 'analytics.duckdb');
    fs.writeFileSync(absolute, '');
    const normalized = normalizeDuckDBConfig(
      baseConfig({workingDirectory, databasePath: absolute})
    );

    expect(normalized.databasePath).toEqual(canonical(absolute));
    expect(normalized.databasePath).not.toContain(canonical(workingDirectory));
  });

  it('falls back to cwd for a relative databasePath with no workingDirectory', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({databasePath: 'analytics.duckdb'})
    );

    expect(normalized.databasePath).toEqual(
      path.join(canonical(process.cwd()), 'analytics.duckdb')
    );
  });

  it('does not resolve :memory: or remote databasePaths against workingDirectory', () => {
    expect(
      normalizeDuckDBConfig(baseConfig({workingDirectory})).databasePath
    ).toEqual(':memory:');
    expect(
      normalizeDuckDBConfig(
        baseConfig({workingDirectory, databasePath: 'md:malloy'})
      ).databasePath
    ).toEqual('md:malloy');
  });

  it('does not invent allowedDirectories outside sandboxed mode', () => {
    const normalized = normalizeDuckDBConfig(baseConfig());

    expect(normalized.allowedDirectories).toBeUndefined();
  });

  it('derives sandboxed defaults from workingDirectory', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({
        securityPolicy: 'sandboxed',
        workingDirectory,
      })
    );

    expect(normalized.allowedDirectories).toEqual([
      canonical(workingDirectory),
    ]);
    expect(normalized.tempDirectory).toEqual(
      path.join(canonical(workingDirectory), '.tmp')
    );
    expect(normalized.secretDirectory).toEqual(
      path.join(canonical(workingDirectory), '.tmp', '.duckdb-secrets')
    );
    expect(normalized.lockConfiguration).toBe(true);
    expect(normalized.tempFileEncryption).toBe(true);
    expect(normalized.enableExternalAccess).toBe(false);
  });

  it('derives enableExternalAccess=false and lockConfiguration=true for local mode', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({
        securityPolicy: 'local',
        workingDirectory,
      })
    );

    expect(normalized.enableExternalAccess).toBe(false);
    expect(normalized.lockConfiguration).toBe(true);
    expect(normalized.tempFileEncryption).toBe(true);
    expect(normalized.allowedDirectories).toBeUndefined();
    expect(normalized.tempDirectory).toBeUndefined();
  });

  it('derives a working-directory scoped secret directory for local mode', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({
        securityPolicy: 'local',
        workingDirectory,
      })
    );

    expect(normalized.tempDirectory).toBeUndefined();
    expect(normalized.secretDirectory).toEqual(
      path.join(canonical(workingDirectory), '.duckdb-secrets')
    );
  });

  it('fails closed when restricted secret isolation has no scoped directory', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          securityPolicy: 'local',
        })
      )
    ).toThrow(
      'restricted DuckDB policies require workingDirectory or tempDirectory'
    );
  });

  it('rejects sandboxed mode without workingDirectory or allowedDirectories', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          securityPolicy: 'sandboxed',
        })
      )
    ).toThrow(
      'securityPolicy "sandboxed" requires either allowedDirectories or workingDirectory'
    );
  });

  it('rejects sandboxed mode on non-POSIX hosts', () => {
    jest.spyOn(pathSecurity, 'isPosixHost').mockReturnValue(false);

    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          securityPolicy: 'sandboxed',
          workingDirectory,
        })
      )
    ).toThrow('securityPolicy "sandboxed" is only supported on POSIX hosts');
  });

  it('rejects tempDirectory outside the sandbox boundary', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          securityPolicy: 'sandboxed',
          workingDirectory,
          allowedDirectories: [workingDirectory],
          tempDirectory: allowedA,
        })
      )
    ).toThrow(
      'tempDirectory must be contained within allowedDirectories when securityPolicy is "sandboxed"'
    );
  });

  it('rejects network-requiring database paths when securityPolicy is local', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          securityPolicy: 'local',
          workingDirectory,
          databasePath: 'md:malloy',
        })
      )
    ).toThrow(
      'databasePath "md:malloy" is not allowed when securityPolicy is "local"'
    );
  });

  it('rejects network-requiring database paths when securityPolicy is sandboxed', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          securityPolicy: 'sandboxed',
          workingDirectory,
          databasePath: 'md:malloy',
        })
      )
    ).toThrow(
      'databasePath "md:malloy" is not allowed when securityPolicy is "sandboxed"'
    );
  });

  it.each([
    [
      'enableExternalAccess',
      {securityPolicy: 'local', enableExternalAccess: true},
      'enableExternalAccess cannot be true when securityPolicy "local" is enabled',
    ],
    [
      'autoloadKnownExtensions',
      {securityPolicy: 'local', autoloadKnownExtensions: true},
      'autoloadKnownExtensions cannot be true when securityPolicy "local" is enabled',
    ],
    [
      'autoinstallKnownExtensions',
      {securityPolicy: 'local', autoinstallKnownExtensions: true},
      'autoinstallKnownExtensions cannot be true when securityPolicy "local" is enabled',
    ],
    [
      'allowCommunityExtensions',
      {securityPolicy: 'local', allowCommunityExtensions: true},
      'allowCommunityExtensions cannot be true when securityPolicy "local" is enabled',
    ],
    [
      'allowUnsignedExtensions',
      {securityPolicy: 'local', allowUnsignedExtensions: true},
      'allowUnsignedExtensions cannot be true when securityPolicy "local" is enabled',
    ],
    [
      'lockConfiguration',
      {securityPolicy: 'sandboxed', lockConfiguration: false},
      'lockConfiguration cannot be false when securityPolicy is "sandboxed"',
    ],
    [
      'tempFileEncryption',
      {securityPolicy: 'sandboxed', tempFileEncryption: false},
      'tempFileEncryption cannot be false when securityPolicy is "sandboxed"',
    ],
    [
      'additionalExtensions',
      {securityPolicy: 'sandboxed', additionalExtensions: ['spatial']},
      'additionalExtensions is not allowed when securityPolicy is "sandboxed"',
    ],
    [
      'motherDuckToken',
      {securityPolicy: 'local', motherDuckToken: 'token'},
      'motherDuckToken is not allowed when securityPolicy is "local"',
    ],
  ] satisfies Array<[string, Partial<ConnectionConfig>, string]>)(
    'rejects conflicting restricted setting %s',
    (_name, overrides, message) => {
      expect(() =>
        normalizeDuckDBConfig(baseConfig({workingDirectory, ...overrides}))
      ).toThrow(message);
    }
  );

  it('normalizes readOnly away for in-memory databases', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({
        readOnly: true,
        databasePath: ':memory:',
      })
    );

    expect(normalized.readOnly).toBe(false);
  });

  it('defaults shareableAttachAlias to the backward-compatible catalog', () => {
    const normalized = normalizeDuckDBConfig(
      baseConfig({
        databasePath: path.join(tempRoot, 'default.duckdb'),
        shareable: true,
      })
    );

    expect(normalized.shareableAttachAlias).toBe(
      DEFAULT_SHAREABLE_ATTACH_ALIAS
    );
    expect(normalized.effectiveShareable).toBe(true);
  });

  it('defaults shareableLockSafety to best-effort', () => {
    expect(normalizeDuckDBConfig(baseConfig()).shareableLockSafety).toBe(
      'best-effort'
    );
  });

  it.each(['strict', 'best-effort'] as const)(
    'preserves the explicit shareableLockSafety %s',
    shareableLockSafety => {
      expect(
        normalizeDuckDBConfig(baseConfig({shareableLockSafety}))
          .shareableLockSafety
      ).toBe(shareableLockSafety);
    }
  );

  it.each([
    ['unsafe', '"unsafe"'],
    [true, 'boolean'],
  ])('rejects invalid shareableLockSafety %#', (shareableLockSafety, got) => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          shareableLockSafety: shareableLockSafety as never,
        })
      )
    ).toThrow(
      `shareableLockSafety must be one of "strict", "best-effort", got ${got}`
    );
  });

  it.each([NATURAL_SHAREABLE_ATTACH_ALIAS, 'catalog "quoted"'])(
    'preserves the explicit shareableAttachAlias %s',
    shareableAttachAlias => {
      const normalized = normalizeDuckDBConfig(
        baseConfig({
          databasePath: path.join(tempRoot, 'explicit.duckdb'),
          shareable: true,
          shareableAttachAlias,
        })
      );

      expect(normalized.shareableAttachAlias).toBe(shareableAttachAlias);
    }
  );

  it('keeps omitted and explicit default aliases in the same share-key class', () => {
    const databasePath = path.join(tempRoot, 'share-key-alias.duckdb');
    const omitted = normalizeDuckDBConfig(
      baseConfig({databasePath, shareable: true})
    );
    const explicit = normalizeDuckDBConfig(
      baseConfig({
        databasePath,
        shareable: true,
        shareableAttachAlias: DEFAULT_SHAREABLE_ATTACH_ALIAS,
      })
    );

    expect(buildDuckDBShareKey(omitted)).toBe(buildDuckDBShareKey(explicit));
  });

  it.each(['', '   ', '\t\n'])(
    'rejects an empty shareableAttachAlias %#',
    shareableAttachAlias => {
      expect(() =>
        normalizeDuckDBConfig(
          baseConfig({shareable: true, shareableAttachAlias})
        )
      ).toThrow('shareableAttachAlias must not be empty or whitespace');
    }
  );

  it('rejects a non-string shareableAttachAlias', () => {
    expect(() =>
      normalizeDuckDBConfig(
        baseConfig({
          shareable: true,
          shareableAttachAlias: 42 as unknown as string,
        })
      )
    ).toThrow('shareableAttachAlias must be a string, got number');
  });

  it('quotes DuckDB identifiers with embedded double quotes', () => {
    expect(sqlIdentifierLiteral('catalog "quoted"')).toBe(
      '"catalog ""quoted"""'
    );
  });

  it('builds the same share key for semantically identical allowedDirectories lists', () => {
    const configA = normalizeDuckDBConfig(
      baseConfig({
        securityPolicy: 'sandboxed',
        workingDirectory,
        allowedDirectories: [workingDirectory, allowedA, allowedB],
      })
    );
    const configB = normalizeDuckDBConfig(
      baseConfig({
        securityPolicy: 'sandboxed',
        workingDirectory,
        allowedDirectories: [allowedB, allowedA, workingDirectory, allowedA],
      })
    );

    expect(buildDuckDBShareKey(configA)).toBe(buildDuckDBShareKey(configB));
  });

  it('builds different share keys for different securityPolicy values', () => {
    const configNone = normalizeDuckDBConfig(baseConfig());
    const configLocal = normalizeDuckDBConfig(
      baseConfig({securityPolicy: 'local', workingDirectory})
    );
    const configSandboxed = normalizeDuckDBConfig(
      baseConfig({securityPolicy: 'sandboxed', workingDirectory})
    );

    const keys = new Set([
      buildDuckDBShareKey(configNone),
      buildDuckDBShareKey(configLocal),
      buildDuckDBShareKey(configSandboxed),
    ]);
    expect(keys.size).toBe(3);
  });
});
