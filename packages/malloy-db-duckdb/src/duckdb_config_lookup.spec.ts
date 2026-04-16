/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyConfig} from '@malloydata/malloy';
import {DuckDBConnection} from './duckdb_connection';
import './native';

describe('DuckDB config lookup validation', () => {
  afterEach(() => {
    DuckDBConnection.closeAllInstances();
  });

  it('rejects reference-shaped filesystemPolicy before DuckDB construction', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          filesystemPolicy: {env: 'FS_POLICY'},
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "filesystemPolicy" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.filesystemPolicy: must be a literal string and cannot use an overlay reference'
    );
  });

  it('rejects non-string networkPolicy before DuckDB construction', async () => {
    const config = new MalloyConfig({
      connections: {
        duckdb: {
          is: 'duckdb',
          networkPolicy: 42,
        },
      },
    });

    await expect(config.connections.lookupConnection('duckdb')).rejects.toThrow(
      'Connection "duckdb" property "networkPolicy" must be a literal string'
    );
    expect(config.log.map(entry => entry.message)).toContain(
      'connections.duckdb.networkPolicy: must be a literal string, got number'
    );
  });
});
