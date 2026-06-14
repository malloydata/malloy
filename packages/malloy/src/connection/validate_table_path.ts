/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {getDialect, getDialects} from '../dialect/dialect_map';

/** Validate against a known dialect. Returns an error string or undefined. */
export function validateCanonicalTablePath(
  dialectName: string,
  tablePath: string
): string | undefined {
  let dialect;
  try {
    dialect = getDialect(dialectName);
  } catch {
    return `tablePath '${tablePath}' cannot be validated: unknown dialect '${dialectName}'`;
  }
  const result = dialect.sqlValidateTableName(tablePath);
  if (!result.ok) {
    return `tablePath '${tablePath}' is not canonical SQL for the ${dialectName} dialect; the translator must validate before passing it here. (${result.error})`;
  }
  if (result.canonical !== tablePath) {
    return `tablePath '${tablePath}' is not canonical SQL for the ${dialectName} dialect; the translator must validate before passing it here.`;
  }
  return undefined;
}

/**
 * Validate against any registered dialect. Used at boundaries where the
 * destination dialect isn't synchronously known (virtualMap, manifest
 * entries).
 */
export function validateCanonicalTablePathAnyDialect(
  tablePath: string
): string | undefined {
  let suggestion: string | undefined;
  for (const dialect of getDialects()) {
    const result = dialect.sqlValidateTableName(tablePath);
    if (result.ok) {
      if (result.canonical === tablePath) return undefined;
      if (suggestion === undefined) suggestion = result.canonical;
    }
  }
  if (suggestion !== undefined) {
    return `value '${tablePath}' is not canonical SQL; did you mean '${suggestion}'?`;
  }
  return `value '${tablePath}' is not a valid canonical table path in any registered dialect`;
}

/** Throw if `tablePath` isn't canonical SQL in any registered dialect. */
export function requireCanonicalTablePathAnyDialect(
  tablePath: string,
  prefix: string
): void {
  const err = validateCanonicalTablePathAnyDialect(tablePath);
  if (err !== undefined) throw new Error(`${prefix}: ${err}`);
}
