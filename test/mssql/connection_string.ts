/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * The SQL Server the mssql tests and loader connect to, from the MSSQL_*
 * variables mssql_start.sh exports. The test runtimes read the same
 * variables through SQLServerExecutor.getConnectionOptionsFromEnv.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; see test/mssql/mssql_start.sh`);
  }
  return value;
}

/** The ADO-style string DuckDB's mssql extension takes in ATTACH */
export function mssqlConnectionString(database: string): string {
  const host = required('MSSQL_HOST');
  const port = required('MSSQL_PORT');
  const user = required('MSSQL_USER');
  const password = required('MSSQL_PASSWORD');
  const trust = process.env['MSSQL_TRUST_SERVER_CERTIFICATE'] === 'true';
  // `Server=host,port`: the extension reads no separate Port key
  return `Server=${host},${port};Database=${database};User Id=${user};Password=${password};TrustServerCertificate=${trust}`;
}
