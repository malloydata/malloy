/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// SPIKE: the Foundation API (Runtime, Model, PreparedQuery...) as a
// classic script, instead of a JSON-string wrapper around API.stateless.
// Sets globalThis.malloy.

import './globals';
import './url';
import {
  Runtime,
  CacheManager,
  InMemoryModelCache,
  InMemoryURLReader,
  MalloyError,
} from '@malloydata/malloy';
import {DuckDBCommon} from '@malloydata/db-duckdb/common';
import {HostDuckDBConnection} from './host_duckdb_connection';

declare const __MALLOY_VERSION__: string;

const malloy = {
  version: __MALLOY_VERSION__,
  Runtime,
  CacheManager,
  InMemoryModelCache,
  InMemoryURLReader,
  MalloyError,
  DuckDBCommon,
  HostDuckDBConnection,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).malloy = malloy;
