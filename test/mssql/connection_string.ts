/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * The SQL Server the mssql tests and loader connect to: the container
 * mssql_start.sh runs, with the password it sets.
 */
export function mssqlConnectionString(database: string): string {
  return `Server=localhost;Port=1433;Database=${database};User Id=sa;Password=Malloy_Test_123;TrustServerCertificate=true`;
}
