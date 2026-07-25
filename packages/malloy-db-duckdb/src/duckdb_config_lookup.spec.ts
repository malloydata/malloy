/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {pathToFileURL} from 'url';
import {getConnectionProperties, MalloyConfig} from '@malloydata/malloy';
import {DuckDBConnection} from './duckdb_connection';
import './native';

describe('DuckDB config lookup validation', () => {
  afterEach(() => {
    DuckDBConnection.closeAllInstances();
  });

  it('registers shareableAttachAlias as an advanced string property', () => {
    const property = getConnectionProperties('duckdb')?.find(
      candidate => candidate.name === 'shareableAttachAlias'
    );

    expect(property).toMatchObject({
      type: 'string',
      optional: true,
      advanced: true,
      default: 'malloy_db',
    });
  });

  it('registers shareableLockSafety as an advanced string property', () => {
    const property = getConnectionProperties('duckdb')?.find(
      candidate => candidate.name === 'shareableLockSafety'
    );

    expect(property).toMatchObject({
      type: 'string',
      optional: true,
      advanced: true,
      requireLiteralString: true,
      default: 'best-effort',
    });
  });

  it('rejects reference-shaped shareableLockSafety before DuckDB construction', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          shareableLockSafety: {env: 'DUCKDB_SHAREABLE_LOCK_SAFETY'},
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "shareableLockSafety" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.shareableLockSafety: must be a literal string and cannot use an overlay reference'
    );
  });

  it('rejects non-string shareableLockSafety before DuckDB construction', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          shareableLockSafety: true,
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "shareableLockSafety" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.shareableLockSafety: must be a literal string, got boolean'
    );
  });

  it('rejects null shareableLockSafety instead of applying best-effort', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          shareableLockSafety: null,
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "shareableLockSafety" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.shareableLockSafety: must be a literal string, got null'
    );
  });

  // Regression: `workingDirectory` defaults to `{config: 'rootDirectory'}`, and
  // the config stack carries rootDirectory as a `file://` URL string. That URL
  // must reach DuckDB as a real OS path — otherwise `SET FILE_SEARCH_PATH` gets
  // a `file:`-prefixed value, DuckDB treats it as relative to the process cwd,
  // and every relative `read_parquet`/glob silently resolves nothing.
  it('resolves relative files against a file:// rootDirectory default', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-duckdb-root-'));
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'data', 'marker.txt'), 'hi');
    const canonicalRoot = fs.realpathSync.native(root);

    const config = new MalloyConfig(
      {connections: {duckdb: {is: 'duckdb'}}},
      {rootDirectory: pathToFileURL(root).toString()}
    );

    const connection = await config.connections.lookupConnection('duckdb');
    const {rows} = await connection.runSQL(
      "SELECT current_setting('file_search_path') AS search_path"
    );
    expect(rows[0]['search_path']).toBe(canonicalRoot);

    // The behavior that actually matters: a relative glob finds the file.
    const globbed = await connection.runSQL("SELECT file FROM glob('data/*')");
    expect(globbed.rows.map(r => r['file'])).toEqual([
      path.join(canonicalRoot, 'data', 'marker.txt'),
    ]);
  });

  it('carries auto alias from JSON config to a natural-catalog persisted view', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-duckdb-auto-'));
    const databasePath = path.join(root, 'mydb.duckdb');
    const bootstrap = new DuckDBConnection({
      name: 'bootstrap',
      databasePath,
    });
    let config: MalloyConfig | undefined;

    try {
      await bootstrap.runSQL('CREATE TABLE base (value INTEGER)');
      await bootstrap.runSQL('INSERT INTO base VALUES (42)');
      await bootstrap.runSQL(
        'CREATE VIEW persisted AS SELECT * FROM "mydb".main.base'
      );
      await bootstrap.close();

      config = new MalloyConfig(
        JSON.stringify({
          connections: {
            issue_2984: {
              is: 'duckdb',
              databasePath,
              readOnly: true,
              shareable: true,
              shareableAttachAlias: 'auto',
            },
          },
        })
      );
      const connection =
        await config.connections.lookupConnection('issue_2984');

      await expect(
        connection.runSQL('SELECT value FROM persisted')
      ).resolves.toMatchObject({rows: [{value: 42}]});
      expect(config.log).toEqual([]);
    } finally {
      await bootstrap.close();
      await config?.shutdown('close');
      fs.rmSync(root, {recursive: true, force: true});
    }
  });

  it('rejects reference-shaped securityPolicy before DuckDB construction', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          securityPolicy: {env: 'SECURITY_POLICY'},
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "securityPolicy" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.securityPolicy: must be a literal string and cannot use an overlay reference'
    );
  });

  it('rejects non-string securityPolicy before DuckDB construction', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          securityPolicy: 42,
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "securityPolicy" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.securityPolicy: must be a literal string, got number'
    );
  });
});
