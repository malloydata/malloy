/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DocumentLocation} from './malloy_types';

/**
 * Thrown by the SQL compiler (`src/model/`) for user-actionable errors the
 * translator didn't catch. Caught at the materializer boundary and turned
 * into a `LogMessage`. Singular `at` reflects the fail-fast contract — the
 * first such error stops compilation. Invariant violations stay as bare
 * `Error` and surface as `code: 'compiler-bug'` instead.
 */
export class MalloyCompileError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly at: DocumentLocation | undefined
  ) {
    super(message);
  }
}
