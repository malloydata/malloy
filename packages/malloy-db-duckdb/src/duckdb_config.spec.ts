/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {ConnectionConfig} from '@malloydata/malloy';
import {
  buildDuckDBShareKey,
  DuckDBConfigValidationError,
  normalizeDuckDBConfig,
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
