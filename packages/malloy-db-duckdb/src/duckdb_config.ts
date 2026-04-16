/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import path from 'path';
import {makeDigest} from '@malloydata/malloy';
import type {
  ConnectionConfig,
  ConnectionParameterValue,
} from '@malloydata/malloy';
import * as pathSecurity from './path_security';

export type DuckDBFilesystemPolicy = 'open' | 'sandboxed';
export type DuckDBNetworkPolicy = 'open' | 'closed';

export interface NormalizedDuckDBSafetyPolicy {
  requiresPosixHost: boolean;
  requiresLockedConfiguration: boolean;
  requiresNoSetupSQL: boolean;
  requiresSandboxedPaths: boolean;
  requiresTempFileEncryption: boolean;
  requiresSecretNeutralization: boolean;
  requiredBaselineExtensions: readonly ['icu', 'json'];
  allowHttpfs: boolean;
  forbidAdditionalExtensions: boolean;
  derivedTempDirectoryName: '.tmp';
}

export interface NormalizedDuckDBConfig {
  name: string;
  databasePath: string;
  readOnly: boolean;
  workingDirectory?: string;
  filesystemPolicy: DuckDBFilesystemPolicy;
  networkPolicy: DuckDBNetworkPolicy;
  safetyPolicy?: NormalizedDuckDBSafetyPolicy;
  allowedDirectories?: string[];
  enableExternalAccess?: boolean;
  lockConfiguration?: boolean;
  autoloadKnownExtensions?: boolean;
  autoinstallKnownExtensions?: boolean;
  allowCommunityExtensions?: boolean;
  allowUnsignedExtensions?: boolean;
  tempFileEncryption?: boolean;
  threads?: number;
  memoryLimit?: string;
  tempDirectory?: string;
  secretDirectory?: string;
  extensionDirectory?: string;
  motherDuckToken?: string;
  additionalExtensions: string[];
  setupSQL?: string;
}

export class DuckDBConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuckDBConfigValidationError';
  }
}

const REQUIRED_BASELINE_EXTENSIONS = ['icu', 'json'] as const;
const DERIVED_TEMP_DIRECTORY_NAME = '.tmp' as const;
const DERIVED_SECRET_DIRECTORY_NAME = '.duckdb-secrets' as const;

export function normalizeDuckDBConfig(
  config: ConnectionConfig
): NormalizedDuckDBConfig {
  const filesystemPolicy = parsePolicyValue(
    config['filesystemPolicy'],
    'filesystemPolicy',
    ['open', 'sandboxed']
  );
  const networkPolicy = parsePolicyValue(
    config['networkPolicy'],
    'networkPolicy',
    ['open', 'closed']
  );

  if (filesystemPolicy === 'sandboxed' && !pathSecurity.isPosixHost()) {
    throw new DuckDBConfigValidationError(
      'filesystemPolicy "sandboxed" is only supported on POSIX hosts'
    );
  }

  const rawDatabasePath =
    readOptionalString(config, 'databasePath') ??
    readOptionalString(config, 'path') ??
    ':memory:';
  const rawWorkingDirectory = readOptionalString(config, 'workingDirectory');
  const rawSetupSQL = normalizeOptionalText(
    readOptionalString(config, 'setupSQL')
  );
  const rawMotherDuckToken = normalizeOptionalText(
    readOptionalString(config, 'motherDuckToken')
  );
  const readOnly = readOptionalBoolean(config, 'readOnly') ?? false;
  const additionalExtensions = normalizeExtensions(
    config['additionalExtensions'],
    'additionalExtensions'
  );
  const enableExternalAccess = readOptionalBoolean(
    config,
    'enableExternalAccess'
  );
  const lockConfiguration = readOptionalBoolean(config, 'lockConfiguration');
  const autoloadKnownExtensions = readOptionalBoolean(
    config,
    'autoloadKnownExtensions'
  );
  const autoinstallKnownExtensions = readOptionalBoolean(
    config,
    'autoinstallKnownExtensions'
  );
  const allowCommunityExtensions = readOptionalBoolean(
    config,
    'allowCommunityExtensions'
  );
  const allowUnsignedExtensions = readOptionalBoolean(
    config,
    'allowUnsignedExtensions'
  );
  const tempFileEncryption = readOptionalBoolean(config, 'tempFileEncryption');
  const threads = readOptionalInteger(config, 'threads');
  const memoryLimit = readOptionalString(config, 'memoryLimit');
  const rawTempDirectory = readOptionalString(config, 'tempDirectory');
  const rawExtensionDirectory = readOptionalString(
    config,
    'extensionDirectory'
  );
  const rawAllowedDirectories = readOptionalStringArray(
    config['allowedDirectories'],
    'allowedDirectories'
  );

  const restricted =
    filesystemPolicy === 'sandboxed' || networkPolicy === 'closed';
  const safetyPolicy = restricted
    ? {
        requiresPosixHost: filesystemPolicy === 'sandboxed',
        requiresLockedConfiguration: true,
        requiresNoSetupSQL: true,
        requiresSandboxedPaths: filesystemPolicy === 'sandboxed',
        requiresTempFileEncryption: true,
        requiresSecretNeutralization: true,
        requiredBaselineExtensions: REQUIRED_BASELINE_EXTENSIONS,
        allowHttpfs: networkPolicy === 'open',
        forbidAdditionalExtensions: true,
        derivedTempDirectoryName: DERIVED_TEMP_DIRECTORY_NAME,
      }
    : undefined;

  if (safetyPolicy?.requiresNoSetupSQL && rawSetupSQL !== undefined) {
    throw new DuckDBConfigValidationError(
      'setupSQL is not allowed when filesystemPolicy or networkPolicy requires a locked DuckDB baseline'
    );
  }

  if (
    safetyPolicy?.forbidAdditionalExtensions &&
    additionalExtensions.length > 0
  ) {
    throw new DuckDBConfigValidationError(
      'additionalExtensions is not allowed when filesystemPolicy or networkPolicy requires a locked DuckDB baseline'
    );
  }

  if (restricted && lockConfiguration === false) {
    throw new DuckDBConfigValidationError(
      'lockConfiguration cannot be false when filesystemPolicy or networkPolicy requires a locked DuckDB baseline'
    );
  }

  if (restricted && tempFileEncryption === false) {
    throw new DuckDBConfigValidationError(
      'tempFileEncryption cannot be false when filesystemPolicy or networkPolicy requires a locked DuckDB baseline'
    );
  }

  if (networkPolicy === 'closed') {
    rejectConflictingBoolean(
      enableExternalAccess,
      'enableExternalAccess',
      true,
      'networkPolicy "closed"'
    );
    rejectConflictingBoolean(
      autoloadKnownExtensions,
      'autoloadKnownExtensions',
      true,
      'networkPolicy "closed"'
    );
    rejectConflictingBoolean(
      autoinstallKnownExtensions,
      'autoinstallKnownExtensions',
      true,
      'networkPolicy "closed"'
    );
    rejectConflictingBoolean(
      allowCommunityExtensions,
      'allowCommunityExtensions',
      true,
      'networkPolicy "closed"'
    );
    rejectConflictingBoolean(
      allowUnsignedExtensions,
      'allowUnsignedExtensions',
      true,
      'networkPolicy "closed"'
    );
    if (rawMotherDuckToken !== undefined) {
      throw new DuckDBConfigValidationError(
        'motherDuckToken is not allowed when networkPolicy is "closed"'
      );
    }
  }

  let workingDirectory: string | undefined;
  if (rawWorkingDirectory !== undefined) {
    workingDirectory = canonicalizeConfigPath(
      rawWorkingDirectory,
      'workingDirectory',
      {
        mustExist: filesystemPolicy === 'sandboxed',
      }
    );
  }

  const databasePath = canonicalizeDatabasePath(rawDatabasePath);
  const isMotherDuck = isMotherDuckPath(databasePath);
  if (
    networkPolicy === 'closed' &&
    !isAllowedClosedNetworkDatabasePath(databasePath)
  ) {
    throw new DuckDBConfigValidationError(
      `databasePath "${rawDatabasePath}" is not allowed when networkPolicy is "closed"`
    );
  }

  if (networkPolicy === 'closed' && isMotherDuck) {
    throw new DuckDBConfigValidationError(
      'MotherDuck database paths are not allowed when networkPolicy is "closed"'
    );
  }

  const normalizedAllowedDirectories =
    rawAllowedDirectories === undefined
      ? undefined
      : canonicalizeConfigPathList(rawAllowedDirectories, 'allowedDirectories');

  let allowedDirectories = normalizedAllowedDirectories;
  if (filesystemPolicy === 'sandboxed') {
    if (allowedDirectories === undefined) {
      if (workingDirectory === undefined) {
        throw new DuckDBConfigValidationError(
          'filesystemPolicy "sandboxed" requires either allowedDirectories or workingDirectory. If you expected workingDirectory to come from config.rootDirectory, verify that overlay is available.'
        );
      }
      allowedDirectories = [workingDirectory];
    }
    if (
      workingDirectory !== undefined &&
      !allowedDirectories.some(allowed =>
        pathSecurity.isContainedPath(allowed, workingDirectory!)
      )
    ) {
      throw new DuckDBConfigValidationError(
        'workingDirectory must be contained within allowedDirectories when filesystemPolicy is "sandboxed"'
      );
    }
  }

  let tempDirectory: string | undefined;
  if (rawTempDirectory !== undefined) {
    tempDirectory = canonicalizeConfigPath(rawTempDirectory, 'tempDirectory');
  } else if (filesystemPolicy === 'sandboxed') {
    if (workingDirectory === undefined) {
      throw new DuckDBConfigValidationError(
        'filesystemPolicy "sandboxed" requires tempDirectory or workingDirectory so Malloy can derive a safe temp directory'
      );
    }
    tempDirectory = path.join(workingDirectory, DERIVED_TEMP_DIRECTORY_NAME);
  }

  if (filesystemPolicy === 'sandboxed') {
    if (allowedDirectories === undefined) {
      throw new DuckDBConfigValidationError(
        'filesystemPolicy "sandboxed" requires allowedDirectories'
      );
    }
    if (tempDirectory === undefined) {
      throw new DuckDBConfigValidationError(
        'filesystemPolicy "sandboxed" requires tempDirectory'
      );
    }
    if (
      !allowedDirectories.some(allowed =>
        pathSecurity.isContainedPath(allowed, tempDirectory!)
      )
    ) {
      throw new DuckDBConfigValidationError(
        'tempDirectory must be contained within allowedDirectories when filesystemPolicy is "sandboxed"'
      );
    }
  }

  const extensionDirectory =
    rawExtensionDirectory === undefined
      ? undefined
      : canonicalizeConfigPath(rawExtensionDirectory, 'extensionDirectory');

  const secretDirectory = deriveRestrictedSecretDirectory({
    requiresSecretNeutralization:
      safetyPolicy?.requiresSecretNeutralization ?? false,
    tempDirectory,
    workingDirectory,
  });

  return {
    name: config.name,
    databasePath,
    readOnly: databasePath === ':memory:' ? false : readOnly,
    workingDirectory,
    filesystemPolicy,
    networkPolicy,
    safetyPolicy,
    allowedDirectories,
    enableExternalAccess:
      networkPolicy === 'closed' ? false : enableExternalAccess,
    lockConfiguration: safetyPolicy?.requiresLockedConfiguration
      ? true
      : lockConfiguration,
    autoloadKnownExtensions:
      networkPolicy === 'closed' ? false : autoloadKnownExtensions,
    autoinstallKnownExtensions:
      networkPolicy === 'closed' ? false : autoinstallKnownExtensions,
    allowCommunityExtensions:
      networkPolicy === 'closed' ? false : allowCommunityExtensions,
    allowUnsignedExtensions:
      networkPolicy === 'closed' ? false : allowUnsignedExtensions,
    tempFileEncryption: safetyPolicy?.requiresTempFileEncryption
      ? true
      : tempFileEncryption,
    threads,
    memoryLimit,
    tempDirectory,
    secretDirectory,
    extensionDirectory,
    motherDuckToken: rawMotherDuckToken,
    additionalExtensions,
    setupSQL: rawSetupSQL,
  };
}

export function buildDuckDBShareKey(config: NormalizedDuckDBConfig): string {
  // secretDirectory is derived from policy + workingDirectory/tempDirectory,
  // which already participate in the share key.
  return makeDigest(
    'duckdb-share-key-v1',
    config.databasePath,
    String(config.readOnly),
    config.filesystemPolicy,
    config.networkPolicy,
    config.setupSQL ?? '',
    ...(config.allowedDirectories ?? []),
    config.enableExternalAccess === undefined
      ? ''
      : String(config.enableExternalAccess),
    config.lockConfiguration === undefined
      ? ''
      : String(config.lockConfiguration),
    config.autoloadKnownExtensions === undefined
      ? ''
      : String(config.autoloadKnownExtensions),
    config.autoinstallKnownExtensions === undefined
      ? ''
      : String(config.autoinstallKnownExtensions),
    config.allowCommunityExtensions === undefined
      ? ''
      : String(config.allowCommunityExtensions),
    config.allowUnsignedExtensions === undefined
      ? ''
      : String(config.allowUnsignedExtensions),
    config.tempFileEncryption === undefined
      ? ''
      : String(config.tempFileEncryption),
    config.threads === undefined ? '' : String(config.threads),
    config.memoryLimit ?? '',
    config.tempDirectory ?? '',
    config.workingDirectory ?? '',
    ...[...config.additionalExtensions].sort(),
    config.extensionDirectory ?? '',
    config.motherDuckToken ?? ''
  );
}

export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlStringListLiteral(values: string[]): string {
  return `[${values.map(value => sqlStringLiteral(value)).join(',')}]`;
}

export function stringifyDuckDBOption(
  value: string | number | boolean
): string {
  return String(value);
}

function parsePolicyValue<T extends string>(
  rawValue: ConnectionParameterValue | undefined,
  fieldName: string,
  allowedValues: readonly T[]
): T | 'open' {
  if (rawValue === undefined) {
    return 'open';
  }
  if (typeof rawValue !== 'string') {
    throw new DuckDBConfigValidationError(
      `${fieldName} must be one of ${allowedValues
        .map(v => `"${v}"`)
        .join(' or ')}, got ${typeof rawValue}`
    );
  }
  if ((allowedValues as readonly string[]).includes(rawValue)) {
    return rawValue as T;
  }
  throw new DuckDBConfigValidationError(
    `${fieldName} must be one of ${allowedValues
      .map(v => `"${v}"`)
      .join(' or ')}, got "${rawValue}"`
  );
}

function readOptionalString(
  config: ConnectionConfig,
  fieldName: string
): string | undefined {
  const rawValue = config[fieldName];
  if (rawValue === undefined) {
    return undefined;
  }
  if (typeof rawValue !== 'string') {
    throw new DuckDBConfigValidationError(
      `${fieldName} must be a string, got ${typeof rawValue}`
    );
  }
  return rawValue;
}

function readOptionalBoolean(
  config: ConnectionConfig,
  fieldName: string
): boolean | undefined {
  const rawValue = config[fieldName];
  if (rawValue === undefined) {
    return undefined;
  }
  if (typeof rawValue !== 'boolean') {
    throw new DuckDBConfigValidationError(
      `${fieldName} must be a boolean, got ${typeof rawValue}`
    );
  }
  return rawValue;
}

function readOptionalInteger(
  config: ConnectionConfig,
  fieldName: string
): number | undefined {
  const rawValue = config[fieldName];
  if (rawValue === undefined) {
    return undefined;
  }
  if (typeof rawValue !== 'number' || !Number.isInteger(rawValue)) {
    throw new DuckDBConfigValidationError(
      `${fieldName} must be an integer number`
    );
  }
  return rawValue;
}

function readOptionalStringArray(
  rawValue: ConnectionParameterValue | undefined,
  fieldName: string
): string[] | undefined {
  if (rawValue === undefined) {
    return undefined;
  }
  if (!Array.isArray(rawValue)) {
    throw new DuckDBConfigValidationError(
      `${fieldName} must be a JSON array of strings`
    );
  }
  if (!rawValue.every(value => typeof value === 'string')) {
    throw new DuckDBConfigValidationError(
      `${fieldName} must be a JSON array of strings`
    );
  }
  return rawValue;
}

function normalizeExtensions(
  rawValue: ConnectionParameterValue | undefined,
  fieldName: string
): string[] {
  if (rawValue === undefined) {
    return [];
  }

  const parts = (() => {
    if (typeof rawValue === 'string') {
      return rawValue.split(',');
    }
    if (
      Array.isArray(rawValue) &&
      rawValue.every(value => typeof value === 'string')
    ) {
      return rawValue;
    }
    throw new DuckDBConfigValidationError(
      `${fieldName} must be a comma-separated string or an array of strings`
    );
  })();

  const normalized = parts
    .map(value => value.trim())
    .filter(value => value !== '');
  return Array.from(new Set(normalized));
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : value;
}

function deriveRestrictedSecretDirectory({
  requiresSecretNeutralization,
  tempDirectory,
  workingDirectory,
}: {
  requiresSecretNeutralization: boolean;
  tempDirectory?: string;
  workingDirectory?: string;
}): string | undefined {
  if (!requiresSecretNeutralization) {
    return undefined;
  }

  if (tempDirectory !== undefined) {
    return path.join(tempDirectory, DERIVED_SECRET_DIRECTORY_NAME);
  }

  if (workingDirectory !== undefined) {
    return path.join(workingDirectory, DERIVED_SECRET_DIRECTORY_NAME);
  }

  throw new DuckDBConfigValidationError(
    'restricted DuckDB policies require workingDirectory or tempDirectory so Malloy can isolate persistent DuckDB secrets'
  );
}

function canonicalizeDatabasePath(databasePath: string): string {
  if (databasePath === ':memory:' || isLikelyRemoteDatabasePath(databasePath)) {
    return databasePath;
  }
  return canonicalizeConfigPath(databasePath, 'databasePath');
}

function canonicalizeConfigPath(
  input: string,
  fieldName: string,
  options: pathSecurity.CanonicalPathOptions = {}
): string {
  try {
    return pathSecurity.canonicalizePath(input, options);
  } catch (error) {
    throw new DuckDBConfigValidationError(
      `${fieldName} is invalid: ${errorMessage(error)}`
    );
  }
}

function canonicalizeConfigPathList(
  paths: string[],
  fieldName: string
): string[] {
  return Array.from(
    new Set(paths.map(p => canonicalizeConfigPath(p, fieldName)).sort())
  );
}

function isAllowedClosedNetworkDatabasePath(databasePath: string): boolean {
  return (
    databasePath === ':memory:' || !isLikelyRemoteDatabasePath(databasePath)
  );
}

function isLikelyRemoteDatabasePath(databasePath: string): boolean {
  return (
    isMotherDuckPath(databasePath) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(databasePath)
  );
}

function isMotherDuckPath(databasePath: string): boolean {
  return (
    databasePath.startsWith('md:') || databasePath.startsWith('motherduck:')
  );
}

function rejectConflictingBoolean(
  actualValue: boolean | undefined,
  fieldName: string,
  forbiddenValue: boolean,
  reason: string
): void {
  if (actualValue === forbiddenValue) {
    throw new DuckDBConfigValidationError(
      `${fieldName} cannot be ${forbiddenValue} when ${reason} is enabled`
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
