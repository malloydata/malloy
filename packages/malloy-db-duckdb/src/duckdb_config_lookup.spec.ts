/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {pathToFileURL} from 'url';
import {MalloyConfig} from '@malloydata/malloy';
import {DuckDBConnection} from './duckdb_connection';
import './native';

describe('DuckDB config lookup validation', () => {
  afterEach(() => {
    DuckDBConnection.closeAllInstances();
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
