/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type * as NodeWorkerThreads from 'worker_threads';
import {DuckDBConnection, DuckDBUnsafeExecutionRealmError} from './index';

jest.mock('worker_threads', () => ({
  ...jest.requireActual<typeof NodeWorkerThreads>('worker_threads'),
  isMainThread: false,
}));

describe('DuckDB simulated worker-realm compatibility', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-duckdb-worker-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  });

  it('preserves ordinary non-shareable local-file connections', async () => {
    const connection = new DuckDBConnection({
      name: 'worker-direct',
      databasePath: path.join(tempRoot, 'direct.duckdb'),
    });

    try {
      await connection.runSQL('CREATE TABLE worker_values (value INTEGER)');
      await connection.runSQL('INSERT INTO worker_values VALUES (42)');

      await expect(
        connection.runSQL('SELECT value FROM worker_values')
      ).resolves.toMatchObject({rows: [{value: 42}]});
    } finally {
      await connection.close();
    }
  });

  it('rejects shareable local files with the public typed realm error', async () => {
    const connection = new DuckDBConnection({
      name: 'worker-shareable',
      databasePath: path.join(tempRoot, 'shareable.duckdb'),
      shareable: true,
    });
    let failure: unknown;

    try {
      await connection.runSQL('SELECT 1');
    } catch (error) {
      failure = error;
    } finally {
      await connection.close();
    }

    expect(failure).toBeInstanceOf(DuckDBUnsafeExecutionRealmError);
    expect(failure).toMatchObject({
      name: 'DuckDBUnsafeExecutionRealmError',
      code: 'MALLOY_DUCKDB_UNSAFE_EXECUTION_REALM',
    });
  });

  it('keeps ineffective shareable in-memory connections available', async () => {
    const connection = new DuckDBConnection({
      name: 'worker-shareable-memory',
      databasePath: ':memory:',
      shareable: true,
    });

    try {
      await expect(
        connection.runSQL('SELECT 7 AS value')
      ).resolves.toMatchObject({rows: [{value: 7}]});
    } finally {
      await connection.close();
    }
  });
});
