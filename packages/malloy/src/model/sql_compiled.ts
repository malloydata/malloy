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
import {isSegmentSQL, isSegmentSource, safeRecordGet} from './malloy_types';
import {mkBuildID} from './source_def_utils';
import {MalloyCompileError} from './malloy_compile_error';

/**
 * Callback type for compiling a Query to SQL.
 * opts is optional - omit for "full SQL" (BuildID computation),
 * provide for "run SQL" (with manifest substitution).
 */
export type CompileQueryCallback = (
  query: Query,
  opts?: PrepareResultOptions
) => string;

/**
 * Compile a SQLSourceDef to its final SQL string.
 *
 * If the source has selectSegments (interpolated persistent sources), each segment
 * is expanded by looking up in the manifest or compiling inline.
 *
 * @param src The SQLSourceDef to compile
 * @param opts PrepareResultOptions with buildManifest and connectionDigests
 * @param compileQuery Callback to compile a Query to SQL
 */
export function getCompiledSQL(
  src: SQLSourceDef,
  opts: PrepareResultOptions,
  compileQuery: CompileQueryCallback
): string {
  // If no segments, just return the pre-computed selectStr
  if (!src.selectSegments || src.selectSegments.length === 0) {
    return src.selectStr;
  }

  // Expand each segment
  const parts: string[] = [];
  for (const segment of src.selectSegments) {
    parts.push(expandSegment(segment, opts, compileQuery));
  }
  return parts.join('');
}

/**
 * Expand a single SQLPhraseSegment to SQL.
 */
function expandSegment(
  segment: SQLPhraseSegment,
  opts: PrepareResultOptions,
  compileQuery: CompileQueryCallback
): string {
  // Plain SQL string
  if (isSegmentSQL(segment)) {
    return segment.sql;
  }

  // PersistableSourceDef (sql_select or query_source)
  if (isSegmentSource(segment)) {
    return expandPersistableSource(segment, opts, compileQuery);
  }

  // Query segment
  return expandQuery(segment, opts, compileQuery);
}

/**
 * Ask the manifest what table backs a persistable source.
 *
 * Every place the compiler needs SQL for a persistable source goes through
 * here, so the rule is stated once: a source marked persistent is looked up
 * by BuildID, a hit yields the table, a miss under `strict` throws, and
 * anything else falls through to the source's own SQL.
 *
 * The BuildID is always computed from manifest-ignorant SQL — `getSourceSQL`
 * with no options — so the key a query looks up is the key the builder wrote,
 * no matter how much of the dependency tree was materialized on either side.
 *
 * @return The table name, canonical SQL as the manifest supplied it, or
 *         undefined when the caller should emit the source's own SQL.
 */
export function persistedTableFor(
  source: PersistableSourceDef,
  opts: PrepareResultOptions,
  compileQuery: CompileQueryCallback
): string | undefined {
  const {buildManifest, connectionDigests} = opts;
  if (!buildManifest || !connectionDigests || !source.persistent) {
    return undefined;
  }
  const connDigest = safeRecordGet(connectionDigests, source.connection);
  if (connDigest === undefined) {
    return undefined;
  }

  const buildId = mkBuildID(connDigest, getSourceSQL(source, compileQuery));
  const entry = buildManifest.entries[buildId];
  if (entry) {
    return entry.tableName;
  }

  if (buildManifest.strict) {
    // Deliberately unnamed. A source reached through an inline `extend` has
    // had its identity cleared, and the names still on the struct are the
    // base's, which may name something else entirely in this model. The
    // location is the reliable half.
    const base =
      `Persisted source not found in manifest (buildId: ${buildId}); ` +
      'strict manifest mode forbids fallback to live compilation.';
    throw new MalloyCompileError(
      buildManifest.loadError ? `${base}\n  ${buildManifest.loadError}` : base,
      'runtime-manifest-strict-miss',
      source.location
    );
  }
  return undefined;
}

/**
 * Expand a PersistableSourceDef, checking manifest for pre-built table.
 * Always returns a subquery form: (SELECT * FROM table) or (inline SQL)
 */
function expandPersistableSource(
  source: PersistableSourceDef,
  opts: PrepareResultOptions,
  compileQuery: CompileQueryCallback
): string {
  // A segment has to be usable as a subquery, so a hit is wrapped.
  const tableName = persistedTableFor(source, opts, compileQuery);
  if (tableName !== undefined) {
    return `(SELECT * FROM ${tableName})`;
  }

  // No manifest or not found - expand inline as subquery
  const sql = getSourceSQL(source, compileQuery, opts);
  return `(${sql})`;
}

/**
 * Expand a Query segment.
 */
function expandQuery(
  query: Query,
  opts: PrepareResultOptions,
  compileQuery: CompileQueryCallback
): string {
  // Set isPartialQuery so CTEs aren't used (they can't be nested in subqueries)
  const sql = compileQuery(query, {...opts, isPartialQuery: true});
  return `(${sql})`;
}

/**
 * Get the SQL for a PersistableSourceDef.
 *
 * @param source The persistable source to compile
 * @param compileQuery Callback to compile a Query to SQL
 * @param opts Optional - if provided with manifest, nested sources may be substituted.
 *             Omit for "full SQL" (e.g., when computing BuildID).
 */
export function getSourceSQL(
  source: PersistableSourceDef,
  compileQuery: CompileQueryCallback,
  opts?: PrepareResultOptions
): string {
  if (source.type === 'sql_select') {
    // Recursive call for nested sql_select
    return getCompiledSQL(source, opts ?? {}, compileQuery);
  }

  // query_source - compile the inner query
  return compileQuery(source.query, opts);
}
