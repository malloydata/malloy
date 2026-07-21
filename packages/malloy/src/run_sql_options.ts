/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Per-query database metadata carried on `RunSQLOptions`, keyed by connector
 * name. Only statement/job-granular connectors read it per query — `snowflake`
 * (query tag) and `bigquery` (job labels). Session-granular connectors (trino,
 * databricks, postgres) take their metadata as connection configuration applied
 * at session open, not per query, so they have no block here. Each connector
 * narrows its own block; blocks are typed loosely so core stays
 * connector-agnostic. Session metadata only — never affects query results or
 * data identity.
 */
export interface ConnectionQueryMetadata {
  snowflake?: Record<string, unknown>;
  bigquery?: Record<string, unknown>;
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
