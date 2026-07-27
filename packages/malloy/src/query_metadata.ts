/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Dialect-agnostic metadata attached per query to the statements a connection
 * issues, for the backend's own bookkeeping (cost attribution, workload
 * classification, tracing): a small bag of string-valued properties.
 *
 * Each connector applies it through a per-query mechanism — Snowflake's
 * per-statement `QUERY_TAG` and BigQuery's per-job labels natively, others as a
 * leading SQL comment. It never affects query results or data identity.
 *
 * This is the only name in this file which is public API; a connector reaches
 * the machinery for applying a bag through `BaseConnection`.
 */
export type QueryMetadata = Record<string, string>;

// Contract for a bag that is usable across every backend and always safe to
// render (including into the `-- NAME="value"` comment form):
//   - names: ASCII alphanumerics and underscore
//   - values: printable ASCII, excluding the double-quote
//   - a small number of properties
// Connectors may transform within these rules (e.g. BigQuery lowercases keys).
export const QUERY_METADATA_MAX_KEY_LENGTH = 128;
export const QUERY_METADATA_MAX_VALUE_LENGTH = 256;
export const QUERY_METADATA_MAX_PROPERTIES = 20;

const KEY_RE = /^[A-Za-z0-9_]+$/;

// Printable ASCII (0x20–0x7e), excluding the double-quote (0x22) that would
// break the `NAME="value"` comment form. Also excludes control characters.
function isValidValue(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code > 0x7e || code === 0x22) return false;
  }
  return true;
}

/**
 * The ways `meta` violates the contract (empty = conforming). For callers that
 * want to surface problems without throwing.
 */
export function queryMetadataProblems(meta: QueryMetadata): string[] {
  const problems: string[] = [];
  const keys = Object.keys(meta);
  if (keys.length > QUERY_METADATA_MAX_PROPERTIES) {
    problems.push(`more than ${QUERY_METADATA_MAX_PROPERTIES} properties`);
  }
  for (const key of keys) {
    if (!KEY_RE.test(key)) {
      problems.push(
        `property name '${key}' must be ASCII alphanumerics and underscore`
      );
    }
    if (key.length > QUERY_METADATA_MAX_KEY_LENGTH) {
      problems.push(
        `property name '${key}' exceeds ${QUERY_METADATA_MAX_KEY_LENGTH} characters`
      );
    }
    const value = meta[key];
    if (!isValidValue(value)) {
      problems.push(
        `property '${key}' value contains characters outside printable ASCII (or ")`
      );
    }
    if (value.length > QUERY_METADATA_MAX_VALUE_LENGTH) {
      problems.push(
        `property '${key}' value exceeds ${QUERY_METADATA_MAX_VALUE_LENGTH} characters`
      );
    }
  }
  return problems;
}

/** Validate query metadata, throwing if the bag is invalid. */
export function validateQueryMetadata(meta: QueryMetadata): void {
  const problems = queryMetadataProblems(meta);
  if (problems.length > 0) {
    throw new Error(`Invalid query metadata: ${problems.join('; ')}`);
  }
}
