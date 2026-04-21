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
