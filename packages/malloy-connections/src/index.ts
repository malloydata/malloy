/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Convenience package: importing this registers all supported connection
// types with the Malloy connection registry. Apps that only need a subset
// of backends can import individual @malloydata/db-* packages instead.
import '@malloydata/db-bigquery';
import '@malloydata/db-duckdb';
import '@malloydata/db-mysql';
import '@malloydata/db-postgres';
import '@malloydata/db-snowflake';
import '@malloydata/db-trino';
