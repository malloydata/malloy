/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Dialect-agnostic metadata attached to the queries a connection issues, for
 * the backend's own bookkeeping — cost attribution, workload classification,
 * tracing. It is a small bag of string-valued properties. Each connector maps
 * it to its native mechanism (Snowflake `QUERY_TAG`, BigQuery job labels, Trino
 * client tags, Databricks `QUERY_TAGS`, Postgres `application_name`) at whatever
 * granularity it supports, and may transform values to satisfy native
 * constraints (e.g. BigQuery lowercases label keys). A connector with no native
 * mechanism can fall back to {@link queryMetadataComment}. This is session
 * metadata only — it never affects query results or data identity.
 *
 * The property bag is validated at the door (see {@link validateQueryMetadata}):
 * the contract is deliberately generic so the same bag is usable across every
 * backend, and an invalid bag throws rather than being silently mangled.
 */
export type QueryMetadata = {
  /**
   * Identifier for the issuing application/client. Maps to a dedicated native
   * slot where one exists (Postgres `application_name`, Trino `source`) and to
   * a reserved `application` label elsewhere (Snowflake, BigQuery, Databricks).
   */
  applicationName?: string;
  /** Key-value labels. */
  labels?: Record<string, string>;
};

/**
 * Reserved label key that `applicationName` folds into on connectors that have
 * no dedicated application slot.
 */
export const APPLICATION_LABEL_KEY = 'application';

// The malloy contract. Kept deliberately generic — permissive enough that a
// bag is usable across every backend, strict enough that it can always be
// rendered safely (e.g. into the `-- NAME="value"` comment form) and that
// per-backend limits are unlikely to be hit:
//   - property names: ASCII alphanumerics and underscore
//   - property values: printable ASCII, excluding the double-quote
//   - a small number of properties
// A connector may further transform within these rules (e.g. BigQuery
// lowercases keys); nothing here encodes one backend's stricter rules.
export const QUERY_METADATA_MAX_KEY_LENGTH = 128;
export const QUERY_METADATA_MAX_VALUE_LENGTH = 256;
export const QUERY_METADATA_MAX_PROPERTIES = 20;

const KEY_RE = /^[A-Za-z0-9_]+$/;

// Printable ASCII (0x20–0x7e) excluding the double-quote (0x22), which would
// break the `NAME="value"` comment serialization. This also excludes all
// control characters (tab, CR, LF, DEL), which are never safe in a tag/label.
function isValidValue(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code > 0x7e || code === 0x22) return false;
  }
  return true;
}

function collectValueProblems(
  what: string,
  value: string,
  problems: string[]
): void {
  if (!isValidValue(value)) {
    problems.push(`${what} contains characters outside printable ASCII (or ")`);
  }
  if (value.length > QUERY_METADATA_MAX_VALUE_LENGTH) {
    problems.push(
      `${what} exceeds ${QUERY_METADATA_MAX_VALUE_LENGTH} characters`
    );
  }
}

/**
 * Collect the ways `meta` violates the malloy contract (empty = conforming).
 * Callers that want to surface problems without throwing (e.g. a publish or
 * declaration step with a human present) can use this directly.
 */
export function queryMetadataProblems(meta: QueryMetadata): string[] {
  const problems: string[] = [];
  if (meta.applicationName !== undefined) {
    collectValueProblems('applicationName', meta.applicationName, problems);
  }
  const labels = meta.labels ?? {};
  const keys = Object.keys(labels);
  if (keys.length > QUERY_METADATA_MAX_PROPERTIES) {
    problems.push(`more than ${QUERY_METADATA_MAX_PROPERTIES} labels`);
  }
  for (const key of keys) {
    if (!KEY_RE.test(key)) {
      problems.push(
        `label key '${key}' must be ASCII alphanumerics and underscore`
      );
    }
    if (key.length > QUERY_METADATA_MAX_KEY_LENGTH) {
      problems.push(
        `label key '${key}' exceeds ${QUERY_METADATA_MAX_KEY_LENGTH} characters`
      );
    }
    collectValueProblems(`label '${key}' value`, labels[key], problems);
  }
  return problems;
}

/**
 * Validate query metadata against the malloy contract, throwing if the bag is
 * invalid. malloy owns the door: a bad bag fails fast here rather than being
 * silently transformed or reaching a backend that would reject the whole query.
 */
export function validateQueryMetadata(meta: QueryMetadata): void {
  const problems = queryMetadataProblems(meta);
  if (problems.length > 0) {
    throw new Error(`Invalid query metadata: ${problems.join('; ')}`);
  }
}

/**
 * The effective label set for connectors without a dedicated application slot:
 * `labels` plus `applicationName` under the reserved
 * {@link APPLICATION_LABEL_KEY} (an explicit `application` label already present
 * is not overwritten). Validates first (throws on an invalid bag); returns
 * undefined when there is nothing to apply.
 */
export function queryMetadataLabels(
  meta: QueryMetadata
): Record<string, string> | undefined {
  validateQueryMetadata(meta);
  const labels = {...(meta.labels ?? {})};
  if (
    meta.applicationName !== undefined &&
    labels[APPLICATION_LABEL_KEY] === undefined
  ) {
    labels[APPLICATION_LABEL_KEY] = meta.applicationName;
  }
  return Object.keys(labels).length > 0 ? labels : undefined;
}

/**
 * Serialize query metadata into a single leading SQL comment that a connector
 * with no native tagging mechanism can prepend to the statement it is about to
 * run, e.g.
 *
 * ```
 * -- NAME1="val1" NAME2="val2"
 * SELECT ...
 * ```
 *
 * The contract guarantees the rendered form is safe (no embedded `"`, no
 * newline). Validates first (throws on an invalid bag); returns the empty
 * string when there is nothing to apply.
 */
export function queryMetadataComment(meta: QueryMetadata): string {
  const labels = queryMetadataLabels(meta);
  if (!labels) return '';
  const rendered = Object.keys(labels)
    .map(key => `${key}="${labels[key]}"`)
    .join(' ');
  return `-- ${rendered}\n`;
}
