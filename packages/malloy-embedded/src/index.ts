/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The globals must exist before the modules that read them load, and ES
// module evaluation follows import order.
import './globals';
import './url';
import * as malloy from '@malloydata/malloy';
import * as interfaces from '@malloydata/malloy-interfaces';
import * as duckdb from '@malloydata/db-duckdb/host';

declare const __MALLOY_VERSION__: string;
declare const __MALLOY_COMMIT__: string;

/**
 * What the bundle installs as `globalThis.malloyEmbedded`: the public
 * exports of three packages, exactly as an npm consumer imports them.
 */
export interface MalloyEmbedded {
  /** `@malloydata/malloy`'s version. */
  version: string;
  /** The commit the bundle was built from; `-dirty` if it had local changes. */
  commit: string;
  /** `@malloydata/malloy` */
  malloy: typeof malloy;
  /** `@malloydata/malloy-interfaces` */
  interfaces: typeof interfaces;
  /** `@malloydata/db-duckdb/host` */
  duckdb: typeof duckdb;
}

const malloyEmbedded: MalloyEmbedded = {
  version: __MALLOY_VERSION__,
  commit: __MALLOY_COMMIT__,
  malloy,
  interfaces,
  duckdb,
};

Object.assign(globalThis, {malloyEmbedded});
