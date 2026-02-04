/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  PrepareResultOptions,
  SQLSourceDef,
  SQLPhraseSegment,
  PersistableSourceDef,
  Query,
} from './malloy_types';
import {isSegmentSQL, isSegmentSource} from './malloy_types';
import {mkBuildID} from './source_def_utils';

/**
 * Compile a SQLSourceDef to its final SQL string.
 *
 * If the source has selectSegments (interpolated persistent sources), each segment
 * is expanded by looking up in the manifest or compiling inline.
 *
 * @param src The SQLSourceDef to compile
 * @param opts PrepareResultOptions with buildManifest and connectionDigests
 * @param quoteTablePath Dialect function to safely quote a table path
 * @param compileQuery Callback to compile a Query to SQL
 */
export function getCompiledSQL(
  src: SQLSourceDef,
  opts: PrepareResultOptions,
  quoteTablePath: (path: string) => string,
  compileQuery: (query: Query, opts: PrepareResultOptions) => string
): string {
  // If no segments, just return the pre-computed selectStr
  if (!src.selectSegments || src.selectSegments.length === 0) {
    return src.selectStr;
  }

  // Expand each segment
  const parts: string[] = [];
  for (const segment of src.selectSegments) {
    parts.push(expandSegment(segment, opts, quoteTablePath, compileQuery));
  }
  return parts.join('');
}

/**
 * Expand a single SQLPhraseSegment to SQL.
 */
function expandSegment(
  segment: SQLPhraseSegment,
  opts: PrepareResultOptions,
  quoteTablePath: (path: string) => string,
  compileQuery: (query: Query, opts: PrepareResultOptions) => string
): string {
  // Plain SQL string
  if (isSegmentSQL(segment)) {
    return segment.sql;
  }

  // PersistableSourceDef (sql_select or query_source)
  if (isSegmentSource(segment)) {
    return expandPersistableSource(segment, opts, quoteTablePath, compileQuery);
  }

  // Query segment
  return expandQuery(segment, opts, quoteTablePath, compileQuery);
}

/**
 * Expand a PersistableSourceDef, checking manifest for pre-built table.
 * Always returns a subquery form: (SELECT * FROM table) or (inline SQL)
 */
function expandPersistableSource(
  source: PersistableSourceDef,
  opts: PrepareResultOptions,
  quoteTablePath: (path: string) => string,
  compileQuery: (query: Query, opts: PrepareResultOptions) => string
): string {
  const {buildManifest, connectionDigests, strictPersist} = opts;

  // Try manifest lookup if we have the required info
  if (buildManifest && connectionDigests) {
    const connDigest = connectionDigests[source.connection];
    if (connDigest) {
      // Get the SQL for this source to compute BuildID
      const sql = getSourceSQL(source, opts, quoteTablePath, compileQuery);
      const buildId = mkBuildID(connDigest, sql);
      const entry = buildManifest.buildEntries[buildId];

      if (entry) {
        // Found in manifest - substitute with subquery from persisted table
        return `(SELECT * FROM ${quoteTablePath(entry.tableName)})`;
      }

      // Not in manifest
      if (strictPersist) {
        throw new Error(
          `Persist source '${source.sourceID}' not found in manifest (buildId: ${buildId})`
        );
      }
    }
  }

  // No manifest or not found - expand inline as subquery
  const sql = getSourceSQL(source, opts, quoteTablePath, compileQuery);
  return `(${sql})`;
}

/**
 * Expand a Query segment.
 */
function expandQuery(
  query: Query,
  opts: PrepareResultOptions,
  _quoteTablePath: (path: string) => string,
  compileQuery: (query: Query, opts: PrepareResultOptions) => string
): string {
  const sql = compileQuery(query, opts);
  return `(${sql})`;
}

/**
 * Get the SQL for a PersistableSourceDef.
 */
function getSourceSQL(
  source: PersistableSourceDef,
  opts: PrepareResultOptions,
  quoteTablePath: (path: string) => string,
  compileQuery: (query: Query, opts: PrepareResultOptions) => string
): string {
  if (source.type === 'sql_select') {
    // Recursive call for nested sql_select
    return getCompiledSQL(source, opts, quoteTablePath, compileQuery);
  }

  // query_source - compile the inner query
  return compileQuery(source.query, opts);
}
