/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {annotationToTaglines} from '../annotation';
import {InfoConnection as OldConnection} from '../connection';
import {Result} from '../malloy';
import {QueryData, QueryDataRow, QueryValue} from '../model';
import {convertFieldInfos} from '../to_stable';
import {InfoConnection} from './connection';
import * as Malloy from '@malloydata/malloy-interfaces';
import {DateTime} from 'luxon';

export function wrapOldStyleConnection(
  connection: OldConnection
): InfoConnection {
  return {
    get dialectName() {
      return connection.dialectName;
    },
    async fetchSchemaForSQLQuery(sql: string) {
      const result = await connection.fetchSchemaForSQLStruct(
        {connection: connection.name, selectStr: sql},
        {}
      );
      const table = result.structDef;
      if (table === undefined) {
        throw new Error(result.error);
      }

      return {
        fields: convertFieldInfos(table, table.fields),
      };
    },
    async fetchSchemaForTable(tableName: string) {
      const key = `${connection.name}:${tableName}`;
      const result = await connection.fetchSchemaForTables(
        {[key]: tableName},
        {}
      );
      const table = result.schemas[key];
      if (table === undefined) {
        throw new Error(result.errors[key]);
      }

      return {
        fields: convertFieldInfos(table, table.fields),
      };
    },
  };
}

function valueToDate(value: unknown): Date {
  // TODO properly map the data from BQ/Postgres types
  if (value instanceof Date) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valAsAny = value as any;
  if (valAsAny.constructor.name === 'Date') {
    // For some reason duckdb TSTZ values come back as objects which do not
    // pass "instance of" but do seem date like.
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

export function mapData(data: QueryData, schema: Malloy.Schema): Malloy.Data {
  function mapValue(
    value: QueryValue,
    field: Malloy.DimensionInfo
  ): Malloy.Cell {
    if (value === null) {
      return {kind: 'null_cell'};
    } else if (
      field.type.kind === 'date_type' ||
      field.type.kind === 'timestamp_type'
    ) {
      const time_value = valueToDate(value).toISOString();
      if (field.type.kind === 'date_type') {
        return {kind: 'date_cell', date_value: time_value};
      } else {
        return {kind: 'timestamp_cell', timestamp_value: time_value};
      }
    } else if (field.type.kind === 'boolean_type') {
      if (typeof value !== 'boolean') {
        throw new Error('Invalid boolean');
      }
      return {kind: 'boolean_cell', boolean_value: value};
    } else if (field.type.kind === 'number_type') {
      if (typeof value !== 'number') {
        throw new Error('Invalid number');
      }
      return {kind: 'number_cell', number_value: value};
    } else if (field.type.kind === 'string_type') {
      if (typeof value !== 'string') {
        throw new Error('Invalid string');
      }
      return {kind: 'string_cell', string_value: value};
    } else if (field.type.kind === 'array_type') {
      if (!Array.isArray(value)) {
        throw new Error('Invalid array');
      }
      return {
        kind: 'array_cell',
        array_value: value.map(value =>
          mapValue(value, {
            name: 'foo',
            type: (field.type as Malloy.AtomicTypeWithArrayType).element_type,
          })
        ),
      };
    } else if (field.type.kind === 'json_type') {
      return {kind: 'json_cell', json_value: JSON.stringify(value)};
    } else if (field.type.kind === 'sql_native_type') {
      return {kind: 'sql_native_cell', sql_native_value: JSON.stringify(value)};
    } else {
      const type = field.type;
      if (type.kind !== 'record_type') {
        throw new Error(
          `Invalid record in result ${JSON.stringify(field)}, ${JSON.stringify(
            value
          )}`
        );
      }
      return mapRow(value as QueryDataRow, {
        kind: 'join',
        relationship: 'many',
        name: 'foo',
        schema: {
          fields: type.fields.map(
            f => ({kind: 'dimension', ...f}) as Malloy.FieldInfoWithDimension
          ),
        },
      });
    }
  }
  function mapRow(
    row: QueryDataRow,
    field: Malloy.FieldInfoWithJoin
  ): Malloy.Cell {
    const cells: Malloy.Cell[] = [];
    for (const f of field.schema.fields) {
      // TODO this might not work for weird names? Is it always the case
      // that the names returned from the DB always match the field names excactly?
      const value = row[f.name];
      if (f.kind !== 'dimension') {
        // TODO this makes me think that the result schema should be a repeated record dimension instead of a schema
        throw new Error(
          'Invalid result -- expected all fields to be dimensions'
        );
      }
      const cell = mapValue(value, f);
      cells.push(cell);
    }
    return {
      kind: 'record_cell',
      record_value: cells,
    };
  }
  const rootField: Malloy.FieldInfoWithJoin = {
    kind: 'join',
    schema,
    name: 'root',
    relationship: 'one',
  };
  return {
    kind: 'array_cell',
    array_value: data.map(row => mapRow(row, rootField)),
  };
}

export function wrapResult(result: Result): Malloy.Result {
  const structs = result._queryResult.structs;
  const struct = structs[structs.length - 1];
  const schema = {fields: convertFieldInfos(struct, struct.fields)};
  const annotations = annotationToTaglines(result.annotation).map(l => ({
    value: l,
  }));
  annotations.push({
    value: Tag.withPrefix('#(malloy) ')
      .set(['source_name'], result.sourceExplore.name)
      .toString(),
  });
  return {
    schema,
    data: mapData(result.data.toObject(), schema),
    connection_name: result.connectionName,
    annotations: annotations.length > 0 ? annotations : undefined,
    query_timezone: result.data.field.queryTimezone,
  };
}
