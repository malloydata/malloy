/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryTags} from './query_tags';

export interface RunSQLOptions {
  rowLimit?: number;
  abortSignal?: AbortSignal;
  /**
   * Optional per-query metadata (query tags / labels) attached to the query for
   * the backend's own bookkeeping — applied by the connector according to its
   * capabilities. See {@link QueryTags}.
   */
  queryTags?: QueryTags;
}

export type QueryOptionsReader = RunSQLOptions | (() => RunSQLOptions);
