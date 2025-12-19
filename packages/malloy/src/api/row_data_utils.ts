/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Database connections return numeric data in various forms depending on
 * the database driver and configuration. Values may arrive as:
 * - Native JavaScript numbers
 * - BigInt (when jsTreatIntegerAsBigInt is enabled)
 * - Strings (when bigNumberStrings is enabled, or for precise decimals)
 * - Wrapper objects (e.g., Snowflake's Integer class)
 *
 * These utilities normalize row data into consistent JavaScript types.
 */

/**
 * Converts a numeric value from database row data to a JavaScript number.
 */
export function rowDataToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && value !== null) return Number(value);
  throw new Error(`Cannot convert ${typeof value} to number: ${value}`);
}

/**
 * Converts a numeric value from database row data to a string representation.
 * Used for bigint fields where precision must be preserved - JavaScript numbers
 * lose precision beyond Number.MAX_SAFE_INTEGER.
 */
export function rowDataToSerializedBigint(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  return String(value ?? '');
}
