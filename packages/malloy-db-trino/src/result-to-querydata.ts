/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AtomicTypeDef,
  FieldDef,
  QueryRecord,
  QueryValue,
} from '@malloydata/malloy';
import {isAtomic, isBasicArray, isRepeatedRecord} from '@malloydata/malloy';
import {DateTime as LuxonDateTime} from 'luxon';

/**
 * Converts a raw compound value (record or array) from its wire
 * format into a JavaScript array.
 * - Trino: identity cast (data is already an array)
 * - Presto: JSON.parse (data comes as a JSON string)
 */
export type Unpacker = (data: unknown) => unknown[];

/**
 * Convert a raw database result row (positional array) into a
 * QueryRecord (named object). Each position in the raw row
 * corresponds to a column defined in the schema.
 */
export function resultRowToQueryRecord(
  columns: FieldDef[],
  rawRow: unknown[],
  unpack: Unpacker
): QueryRecord {
  const result: QueryRecord = {};
  for (let i = 0; i < columns.length; i++) {
    result[columns[i].name] = convertValue(columns[i], rawRow[i], unpack);
  }
  return result;
}

/**
 * Convert a single raw value to its Malloy representation,
 * dispatching to the appropriate converter based on type.
 * Non-atomic fields (joins, turtles) are passed through as-is.
 */
function convertValue(
  typeDef: FieldDef | AtomicTypeDef,
  raw: unknown,
  unpack: Unpacker
): QueryValue {
  if (!isAtomic(typeDef)) {
    return [];
  }
  if (typeDef.type === 'record') {
    return convertRecord(typeDef.fields, raw, unpack);
  }
  if (isRepeatedRecord(typeDef)) {
    return convertRepeatedRecord(typeDef.fields, raw, unpack);
  }
  if (isBasicArray(typeDef)) {
    return convertArray(typeDef.elementTypeDef, raw, unpack);
  }
  return convertScalar(typeDef, raw);
}

/**
 * Convert a record (ROW/STRUCT) value: the database returns these
 * as positional arrays, which we map to named fields. A null
 * record stays null.
 */
function convertRecord(
  fields: FieldDef[],
  raw: unknown,
  unpack: Unpacker
): QueryRecord | null {
  if (raw === null || raw === undefined) return null;
  const values = unpack(raw);
  const result: QueryRecord = {};
  for (let i = 0; i < fields.length; i++) {
    result[fields[i].name] = convertValue(fields[i], values[i], unpack);
  }
  return result;
}

/**
 * Convert an array of records. This handles both nested Malloy
 * query results (nest:) and ARRAY<ROW(...)> column values. A null
 * input becomes [] — for nested queries this correctly represents
 * "no matching rows."
 */
function convertRepeatedRecord(
  fields: FieldDef[],
  raw: unknown,
  unpack: Unpacker
): QueryValue[] {
  if (raw === null || raw === undefined) return [];
  const rows = unpack(raw);
  return rows.map(row => convertRecord(fields, row, unpack));
}

/**
 * Convert a basic array (number[], string[], etc.). A null array
 * stays null. Elements are recursively converted through
 * convertValue for proper type coercion.
 */
function convertArray(
  elementType: AtomicTypeDef,
  raw: unknown,
  unpack: Unpacker
): QueryValue[] | null {
  if (raw === null || raw === undefined) return null;
  const values = unpack(raw);
  return values.map(el => convertValue(elementType, el, unpack));
}

/**
 * Convert a scalar value, handling Trino/Presto wire format quirks:
 * - Decimal numbers arrive as strings
 * - Timestamps arrive as strings
 * - TIMESTAMP WITH TIME ZONE uses "datetime timezone" format
 * - Dates arrive as strings (e.g. "2020-01-15"), passed through
 *   for rowDataToDate to handle downstream
 * - BIGINT precision is limited by the Trino JS client which
 *   delivers values as JS number (no bigint support)
 */
function convertScalar(typeDef: AtomicTypeDef, raw: unknown): QueryValue {
  if (raw === null || raw === undefined) return null;

  if (typeDef.type === 'number' && typeof raw === 'string') {
    // Decimals arrive as strings. BIGINT values arrive as JS number
    // (already lossy for values > MAX_SAFE_INTEGER) so they don't
    // hit this path — this is only for decimal-as-string coercion.
    return Number(raw);
  }

  if (
    (typeDef.type === 'timestamp' || typeDef.type === 'timestamptz') &&
    typeof raw === 'string'
  ) {
    if (typeDef.type === 'timestamptz') {
      // TIMESTAMP WITH TIME ZONE: "2020-02-20 00:00:00 America/Mexico_City"
      const trinoTzPattern =
        /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?) (.+)$/;
      const match = raw.match(trinoTzPattern);
      if (match) {
        const [, dateTimePart, tzName] = match;
        const dt = LuxonDateTime.fromSQL(dateTimePart, {zone: tzName});
        if (dt.isValid) {
          return dt.toJSDate();
        }
      }
    }
    // Plain timestamps: Trino returns UTC values
    return new Date(raw + 'Z');
  }

  if (
    typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
  ) {
    return raw;
  }
  return null;
}
