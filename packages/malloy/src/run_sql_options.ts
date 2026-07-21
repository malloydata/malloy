/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Session metadata (query tags, job labels, client tags, session settings)
 * keyed by connector name. Each connector reads and narrows its own block and
 * ignores the rest; blocks are typed loosely here so core stays
 * connector-agnostic. Session metadata only — never affects query results or
 * data identity.
 */
export interface ConnectionQueryMetadata {
  snowflake?: Record<string, unknown>;
  bigquery?: Record<string, unknown>;
  databricks?: Record<string, unknown>;
  trino?: Record<string, unknown>;
  postgres?: Record<string, unknown>;
}

export interface RunSQLOptions {
  rowLimit?: number;
  abortSignal?: AbortSignal;
  /**
   * Optional per-query database metadata (query tags, job labels, session
   * settings) applied by the connector according to its capabilities. See
   * {@link ConnectionQueryMetadata}.
   */
  queryMetadata?: ConnectionQueryMetadata;
}

export type QueryOptionsReader = RunSQLOptions | (() => RunSQLOptions);
