/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Dialect-agnostic metadata attached to the queries a connection issues, for
 * the backend's own bookkeeping — cost attribution, workload classification,
 * tracing. Each connector maps this to its native mechanism (Snowflake
 * `QUERY_TAG`, BigQuery job labels, Trino client tags, Databricks
 * `QUERY_TAGS`, Postgres `application_name`) at whatever granularity it
 * supports, and may transform values to satisfy native constraints (e.g.
 * BigQuery lowercases label keys). This is session metadata only — it never
 * affects query results or data identity.
 *
 * Values should conform to the malloy contract (see {@link validateQueryTags});
 * connectors clamp/transform to their own native limits as a runtime backstop
 * and never throw.
 */
export type QueryTags = {
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

// The malloy contract — deliberately permissive (case and common separators are
// allowed; per-engine rules like BigQuery's lowercase-only are applied by the
// connector, not here). Only structurally-unsafe or universally-unusable values
// are disallowed.
export const QUERY_TAG_MAX_KEY_LENGTH = 128;
export const QUERY_TAG_MAX_VALUE_LENGTH = 256;
export const QUERY_TAG_MAX_LABELS = 50;

// Control characters (incl. tab, CR, LF, DEL) are never safe in a tag/label.
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate query tags against the malloy contract, returning a list of
 * human-readable violations (empty = conforming). Intended for callers with a
 * human present (a publish/declaration step) to surface. The runtime query
 * path never calls this to reject — connectors clamp/transform instead.
 */
export function validateQueryTags(tags: QueryTags): string[] {
  const problems: string[] = [];
  if (tags.applicationName !== undefined) {
    if (hasControlChars(tags.applicationName)) {
      problems.push('applicationName contains control characters');
    }
    if (tags.applicationName.length > QUERY_TAG_MAX_VALUE_LENGTH) {
      problems.push(
        `applicationName exceeds ${QUERY_TAG_MAX_VALUE_LENGTH} characters`
      );
    }
  }
  const labels = tags.labels ?? {};
  const keys = Object.keys(labels);
  if (keys.length > QUERY_TAG_MAX_LABELS) {
    problems.push(`more than ${QUERY_TAG_MAX_LABELS} labels`);
  }
  for (const key of keys) {
    if (key.length === 0) {
      problems.push('empty label key');
    } else if (key.length > QUERY_TAG_MAX_KEY_LENGTH) {
      problems.push(
        `label key '${key}' exceeds ${QUERY_TAG_MAX_KEY_LENGTH} characters`
      );
    }
    if (hasControlChars(key)) {
      problems.push(`label key '${key}' contains control characters`);
    }
    const value = labels[key];
    if (hasControlChars(value)) {
      problems.push(`label '${key}' value contains control characters`);
    }
    if (value.length > QUERY_TAG_MAX_VALUE_LENGTH) {
      problems.push(
        `label '${key}' value exceeds ${QUERY_TAG_MAX_VALUE_LENGTH} characters`
      );
    }
  }
  return problems;
}

/**
 * The effective label set for connectors without a dedicated application slot:
 * `labels` plus `applicationName` under the reserved
 * {@link APPLICATION_LABEL_KEY} (an explicit `application` label already present
 * is not overwritten). Returns undefined when there is nothing to apply.
 */
export function labelsWithApplication(
  tags: QueryTags
): Record<string, string> | undefined {
  const labels = {...(tags.labels ?? {})};
  if (
    tags.applicationName !== undefined &&
    labels[APPLICATION_LABEL_KEY] === undefined
  ) {
    labels[APPLICATION_LABEL_KEY] = tags.applicationName;
  }
  return Object.keys(labels).length > 0 ? labels : undefined;
}
