/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';

/**
 * Convert a Malloy.Cell to a plain JS value.
 * - null_cell → null
 * - string_cell → string
 * - number_cell → number
 * - boolean_cell → boolean
 * - date_cell → string (ISO date format)
 * - timestamp_cell → string (ISO timestamp format)
 * - json_cell → parsed JSON value
 * - sql_native_cell → parsed JSON value
 * - array_cell → array of converted values
 * - record_cell → object with field names from schema
 */
function cellToValue(cell: Malloy.Cell, fieldInfo: Malloy.FieldInfo): unknown {
  switch (cell.kind) {
    case 'null_cell':
      return null;
    case 'string_cell':
      return cell.string_value;
    case 'number_cell':
      // Return BigInt for bigint values (when string_value is present for precision)
      if (cell.string_value !== undefined) {
        return BigInt(cell.string_value);
      }
      return cell.number_value;
    case 'boolean_cell':
      return cell.boolean_value;
    case 'date_cell':
      return cell.date_value;
    case 'timestamp_cell':
      return cell.timestamp_value;
    case 'json_cell':
      return JSON.parse(cell.json_value);
    case 'sql_native_cell':
      return JSON.parse(cell.sql_native_value);
    case 'array_cell': {
      if (fieldInfo.kind !== 'dimension') {
        throw new Error(`Expected dimension for array, got ${fieldInfo.kind}`);
      }
      const type = fieldInfo.type;
      if (type.kind !== 'array_type') {
        throw new Error(`Expected array_type, got ${type.kind}`);
      }
      const elementFieldInfo: Malloy.FieldInfo = {
        kind: 'dimension',
        name: 'element',
        type: type.element_type,
      };
      return cell.array_value.map(c => cellToValue(c, elementFieldInfo));
    }
    case 'record_cell': {
      // Records can come from either a join or a dimension with record_type
      // record_type.fields returns DimensionInfo[], schema.fields returns FieldInfo[]
      let fields: readonly {name: string}[];
      let getFieldInfo: (i: number) => Malloy.FieldInfo;

      if (fieldInfo.kind === 'join') {
        fields = fieldInfo.schema.fields;
        getFieldInfo = i => fieldInfo.schema.fields[i];
      } else if (
        fieldInfo.kind === 'dimension' &&
        fieldInfo.type.kind === 'record_type'
      ) {
        // Capture the record type to help TypeScript narrow
        const recordType = fieldInfo.type;
        fields = recordType.fields;
        // DimensionInfo needs to be wrapped as a FieldInfo
        getFieldInfo = i => ({
          kind: 'dimension' as const,
          name: recordType.fields[i].name,
          type: recordType.fields[i].type,
        });
      } else {
        throw new Error(
          `Expected join or dimension with record_type for record, got ${fieldInfo.kind}`
        );
      }
      const result: Record<string, unknown> = {};
      for (let i = 0; i < fields.length; i++) {
        result[fields[i].name] = cellToValue(
          cell.record_value[i],
          getFieldInfo(i)
        );
      }
      return result;
    }
    default:
      throw new Error(`Unknown cell kind: ${(cell as Malloy.Cell).kind}`);
  }
}

/**
 * Convert Malloy.Data (array of record cells) to an array of plain JS objects.
 * This is the inverse of mapData() in util.ts.
 */
export function cellsToObjects(
  data: Malloy.Data,
  schema: Malloy.Schema
): Record<string, unknown>[] {
  if (data.kind !== 'array_cell') {
    throw new Error(`Expected array_cell at root, got ${data.kind}`);
  }

  const rootFieldInfo: Malloy.FieldInfoWithJoin = {
    kind: 'join',
    name: 'root',
    relationship: 'one',
    schema,
  };

  return data.array_value.map(cell => {
    const result = cellToValue(cell, rootFieldInfo);
    return result as Record<string, unknown>;
  });
}
