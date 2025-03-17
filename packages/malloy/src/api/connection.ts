/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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
