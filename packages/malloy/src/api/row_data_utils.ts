/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DateTime} from 'luxon';

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

/**
 * Converts a date/timestamp value from database row data to a JavaScript Date.
 * Database drivers return dates in various forms:
 * - Native Date objects
 * - Objects that look like Date but fail instanceof (DuckDB TSTZ)
 * - Numbers (timestamps)
 * - Objects with a .value property (some wrappers)
 * - Strings (Postgres timestamps)
 */
export function rowDataToDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valAsAny = value as any;
  if (valAsAny?.constructor?.name === 'Date') {
    // For some reason duckdb TSTZ values come back as objects which do not
    // pass "instanceof" but do seem date like.
    return new Date(value as Date);
  } else if (typeof value === 'number') {
    return new Date(value);
  } else if (typeof value !== 'string') {
    return new Date((value as unknown as {value: string}).value);
  } else {
    // Postgres timestamps end up here, and ideally we would know the system
    // timezone of the postgres instance to correctly create a Date() object
    // which represents the same instant in time, but we don't have the data
    // flow to implement that. This may be a problem at some future day,
    // so here is a comment, for that day.
    let parsed = DateTime.fromISO(value, {zone: 'UTC'});
    if (!parsed.isValid) {
      parsed = DateTime.fromSQL(value, {zone: 'UTC'});
    }
    return parsed.toJSDate();
  }
}
