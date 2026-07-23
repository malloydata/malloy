/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryMetadata} from './query_metadata';

export interface RunSQLOptions {
  rowLimit?: number;
  abortSignal?: AbortSignal;
  /**
   * Optional per-query metadata (a small bag of string-valued properties)
   * attached to the query for the backend's own bookkeeping — applied by the
   * connector according to its capabilities. See {@link QueryMetadata}.
   */
  queryMetadata?: QueryMetadata;
}

export type QueryOptionsReader = RunSQLOptions | (() => RunSQLOptions);
