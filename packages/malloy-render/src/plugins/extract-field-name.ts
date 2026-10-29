/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * A chart channel's `fields` hold serialized field paths (JSON-encoded arrays).
 * When writing them back into a tag we want the leaf field name, not the full
 * path. Falls back to the raw string for a plain (non-JSON) value.
 *
 * Shared by the bar/line/combo `settings-to-tag` serializers so the extraction
 * lives in one place.
 */
export function extractFieldName(fieldPath: string): string {
  try {
    const parsed = JSON.parse(fieldPath);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[parsed.length - 1];
    }
  } catch {
    // If parsing fails, treat as regular string
  }
  return fieldPath;
}
