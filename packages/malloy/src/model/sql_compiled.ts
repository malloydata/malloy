/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PrepareResultOptions, SQLSourceDef} from './malloy_types';

/**
 * When compiling a query containing SQL sources, these blocks may contain "SQLPhraseSegments"
 * which are persistable sources that have been persisted. That information can be computed
 * with the QueryModel and the PrepareResultOptions (in the PR where that work exists).
 *
 * For now, this function returns selectStr directly. In a future PR, this will
 * expand selectSegments using materialization information from PrepareResultOptions.
 */
export function getCompiledSQL(
  src: SQLSourceDef,
  _opts: PrepareResultOptions
): string {
  return src.selectStr;
}
