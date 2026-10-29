/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';

export interface InfoConnection {
  fetchSchemaForTable(name: string): Promise<Malloy.Schema>;
  fetchSchemaForSQLQuery(sqlQuery: string): Promise<Malloy.Schema>;
  get dialectName(): string;
}

export interface Connection extends InfoConnection {
  runSQL(sql: string, schema: Malloy.Schema): Promise<Malloy.Data>;
}

export interface LookupConnection<T extends InfoConnection> {
  lookupConnection(connectionName?: string): Promise<T>;
}
