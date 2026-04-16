/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {DuckDBInstance} from '@duckdb/node-api';
import type {QueryRecord} from '@malloydata/malloy';
import {DuckDBConnection} from './duckdb_connection';
import {DuckDBConfigValidationError} from './duckdb_config';

type DuckDBConnectionWithRun = DuckDBConnection & {
  runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}>;
};

describe('DuckDB restricted configuration', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-duckdb-sec-'));
  const workingDirectory = path.join(tempRoot, 'working');
  const sharedDatabasePath = path.join(tempRoot, 'shared.duckdb');
  const secondAllowedDirectory = path.join(tempRoot, 'allowed-b');
  const canonical = (value: string) => fs.realpathSync.native(value);

  beforeAll(() => {
    fs.mkdirSync(workingDirectory, {recursive: true});
    fs.mkdirSync(secondAllowedDirectory, {recursive: true});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    DuckDBConnection.closeAllInstances();
  });

  it('rejects setupSQL when a restricted policy requires a locked baseline', () => {
    const createSpy = jest.spyOn(DuckDBInstance, 'create');

    expect(
      () =>
        new DuckDBConnection({
          name: 'duckdb',
          filesystemPolicy: 'sandboxed',
          workingDirectory,
          setupSQL: 'SET FILE_SEARCH_PATH=/tmp',
        })
    ).toThrow(DuckDBConfigValidationError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('passes enable_external_access=false at open time when no allowlist SET is needed', async () => {
    const createSpy = jest.spyOn(DuckDBInstance, 'create');
    const connection = new DuckDBConnection({
      name: 'duckdb-network-closed',
      networkPolicy: 'closed',
      workingDirectory,
    });

    try {
      await connection.runSQL('SELECT 1');

      expect(createSpy).toHaveBeenCalledWith(
        ':memory:',
        expect.objectContaining({enable_external_access: 'false'})
      );
    } finally {
      await connection.close();
    }
  });

  it('does not share native instances when safety-relevant settings differ', async () => {
    const openConnection = new DuckDBConnection({
      name: 'duckdb-open',
      databasePath: sharedDatabasePath,
      workingDirectory,
    });
    let closedConnection: DuckDBConnection | undefined;

    try {
      await openConnection.runSQL('SELECT 1');
      closedConnection = new DuckDBConnection({
        name: 'duckdb-closed',
        databasePath: sharedDatabasePath,
        workingDirectory,
        networkPolicy: 'closed',
      });
      await closedConnection.runSQL('SELECT 1');

      expect(Object.keys(DuckDBConnection.activeDBs)).toHaveLength(2);
    } finally {
      await openConnection.close();
      await closedConnection?.close();
    }
  });

  it('does share native instances for semantically identical allowlists', async () => {
    const firstConnection = new DuckDBConnection({
      name: 'duckdb-first',
      filesystemPolicy: 'sandboxed',
      workingDirectory,
      allowedDirectories: [workingDirectory, secondAllowedDirectory],
    });
    const secondConnection = new DuckDBConnection({
      name: 'duckdb-second',
      filesystemPolicy: 'sandboxed',
      workingDirectory,
      allowedDirectories: [
        secondAllowedDirectory,
        workingDirectory,
        workingDirectory,
      ],
    });

    try {
      await firstConnection.runSQL('SELECT 1');
      await secondConnection.runSQL('SELECT 1');

      expect(Object.keys(DuckDBConnection.activeDBs)).toHaveLength(1);
    } finally {
      await firstConnection.close();
      await secondConnection.close();
    }
  });

  it('applies the restricted baseline before locking configuration', async () => {
    const queries: string[] = [];
    const prototype =
      DuckDBConnection.prototype as unknown as DuckDBConnectionWithRun;
    const originalRunDuckDBQuery = prototype.runDuckDBQuery;
    jest.spyOn(prototype, 'runDuckDBQuery').mockImplementation(function (
      this: DuckDBConnectionWithRun,
      sql: string
    ) {
      queries.push(sql);
      return originalRunDuckDBQuery.call(this, sql);
    });

    const connection = new DuckDBConnection({
      name: 'duckdb-restricted',
      filesystemPolicy: 'sandboxed',
      networkPolicy: 'closed',
      workingDirectory,
    });

    try {
      await connection.runSQL('SELECT 1');

      expect(queries).toContain(
        `SET allowed_directories=['${canonical(workingDirectory)}']`
      );
      expect(queries).toContain('SET enable_external_access=false');
      expect(queries).toContain("SET TimeZone='UTC'");
      expect(queries).toContain("LOAD 'json'");
      expect(queries).toContain("LOAD 'icu'");
      expect(queries).toContain('SET lock_configuration=true');
      expect(queries.some(query => query.startsWith('INSTALL '))).toBe(false);
      expect(queries).not.toContain("LOAD 'httpfs'");

      const lockIndex = queries.indexOf('SET lock_configuration=true');
      const allowedIndex = queries.indexOf(
        `SET allowed_directories=['${canonical(workingDirectory)}']`
      );
      const externalAccessIndex = queries.indexOf(
        'SET enable_external_access=false'
      );
      expect(externalAccessIndex).toBeGreaterThan(allowedIndex);
      expect(externalAccessIndex).toBeLessThan(queries.indexOf("LOAD 'json'"));
      expect(lockIndex).toBeGreaterThan(queries.indexOf("LOAD 'json'"));
      expect(lockIndex).toBeGreaterThan(queries.indexOf("LOAD 'icu'"));
    } finally {
      await connection.close();
    }
  });

  it('locks down the session and keeps httpfs unloaded when networkPolicy is closed', async () => {
    const connection = new DuckDBConnection({
      name: 'duckdb-restricted',
      filesystemPolicy: 'sandboxed',
      networkPolicy: 'closed',
      workingDirectory,
    });

    try {
      const settings = await connection.runSQL(`
        SELECT
          current_setting('lock_configuration') AS lock_configuration,
          current_setting('enable_external_access') AS enable_external_access,
          current_setting('allowed_directories') AS allowed_directories,
          current_setting('secret_directory') AS secret_directory,
          current_setting('temp_directory') AS temp_directory
      `);
      expect(settings.rows[0]['lock_configuration']).toBe(true);
      expect(settings.rows[0]['enable_external_access']).toBe(false);
      expect(settings.rows[0]['allowed_directories']).toEqual(
        expect.arrayContaining([
          `${canonical(workingDirectory)}/`,
          `${canonical(workingDirectory)}/.tmp/`,
        ])
      );
      expect(settings.rows[0]['secret_directory']).toBe(
        `${canonical(workingDirectory)}/.tmp/.duckdb-secrets`
      );
      expect(settings.rows[0]['temp_directory']).toBe(
        `${canonical(workingDirectory)}/.tmp`
      );

      await expect(
        connection.runRawSQL('SET enable_external_access=true')
      ).rejects.toThrow('configuration has been locked');
      await expect(connection.runRawSQL("LOAD 'httpfs'")).rejects.toThrow();
    } finally {
      await connection.close();
    }
  });

  it('isolates secrets for network-only restricted mode', async () => {
    const connection = new DuckDBConnection({
      name: 'duckdb-network-closed',
      networkPolicy: 'closed',
      workingDirectory,
    });

    try {
      const settings = await connection.runSQL(`
        SELECT
          current_setting('secret_directory') AS secret_directory,
          current_setting('temp_directory') AS temp_directory,
          current_setting('enable_external_access') AS enable_external_access,
          current_setting('lock_configuration') AS lock_configuration
      `);

      expect(settings.rows[0]['secret_directory']).toBe(
        `${canonical(workingDirectory)}/.duckdb-secrets`
      );
      expect(settings.rows[0]['temp_directory']).toBe('.tmp');
      expect(settings.rows[0]['enable_external_access']).toBe(false);
      expect(settings.rows[0]['lock_configuration']).toBe(true);
    } finally {
      await connection.close();
    }
  });

  it('fails closed when a required restricted baseline extension is unavailable', async () => {
    const prototype =
      DuckDBConnection.prototype as unknown as DuckDBConnectionWithRun;
    const originalRunDuckDBQuery = prototype.runDuckDBQuery;
    jest.spyOn(prototype, 'runDuckDBQuery').mockImplementation(function (
      this: DuckDBConnectionWithRun,
      sql: string
    ) {
      if (sql === "LOAD 'json'") {
        return Promise.reject(new Error('missing json extension'));
      }
      return originalRunDuckDBQuery.call(this, sql);
    });

    const connection = new DuckDBConnection({
      name: 'duckdb-restricted',
      networkPolicy: 'closed',
      workingDirectory,
    });

    try {
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        'missing json extension'
      );
    } finally {
      await connection.close();
    }
  });
});
