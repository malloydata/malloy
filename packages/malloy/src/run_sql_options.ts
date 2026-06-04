/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export interface RunSQLOptions {
  rowLimit?: number;
  abortSignal?: AbortSignal;
}

export type QueryOptionsReader = RunSQLOptions | (() => RunSQLOptions);
