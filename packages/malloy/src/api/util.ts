/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {annotationToTaglines} from '../annotation';
import type {
  InfoConnection as LegacyInfoConnection,
  Connection as LegacyConnection,
} from '../connection';
import type {Result} from './foundation';
import type {Expr} from '../model';
import {type QueryData, type QueryRecord, type QueryValue} from '../model';
import {
  convertFieldInfos,
  getResultStructMetadataAnnotation,
  writeLiteralToTag,
} from '../to_stable';
import type {Connection, InfoConnection} from './connection';
import type * as Malloy from '@malloydata/malloy-interfaces';
import type {LogMessage} from '../lang';
import {
  rowDataToNumber,
  rowDataToSerializedBigint,
  rowDataToDate,
} from './row_data_utils';

export function wrapLegacyInfoConnection(
  connection: LegacyInfoConnection
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

export function wrapLegacyConnection(connection: LegacyConnection): Connection {
  return {
    ...wrapLegacyInfoConnection(connection),
    runSQL: async (sql: string, schema: Malloy.Schema) => {
      const result = await connection.runSQL(sql);
      return mapData(result.rows, schema);
    },
  };
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
      field.type.kind === 'timestamp_type' ||
      field.type.kind === 'timestamptz_type'
    ) {
      const time_value = rowDataToDate(value).toISOString();
      if (field.type.kind === 'date_type') {
        return {kind: 'date_cell', date_value: time_value};
      } else {
        return {kind: 'timestamp_cell', timestamp_value: time_value};
      }
    } else if (field.type.kind === 'boolean_type') {
      if (typeof value === 'number' || typeof value === 'bigint') {
        return {kind: 'boolean_cell', boolean_value: value !== 0};
      }
      if (typeof value === 'string') {
        // MySQL with bigNumberStrings returns "0" or "1"
        return {
          kind: 'boolean_cell',
          boolean_value: value !== '0' && value !== '',
        };
      }
      if (typeof value !== 'boolean') {
        throw new Error(`Invalid boolean ${value}`);
      }
      return {kind: 'boolean_cell', boolean_value: value};
    } else if (field.type.kind === 'number_type') {
      const subtype = field.type.subtype;
      const stringValue =
        subtype === 'bigint' ? rowDataToSerializedBigint(value) : undefined;
      return {
        kind: 'number_cell',
        number_value: rowDataToNumber(value),
        subtype,
        string_value: stringValue,
      };
    } else if (field.type.kind === 'string_type') {
      if (typeof value !== 'string') {
        throw new Error(`Invalid string ${value}`);
      }
      return {kind: 'string_cell', string_value: value};
    } else if (field.type.kind === 'array_type') {
      if (!Array.isArray(value)) {
        throw new Error(`Invalid array ${value}`);
      }
      return {
        kind: 'array_cell',
        array_value: value.map(value =>
          mapValue(value, {
            name: 'array_element',
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
      return mapRow(value as QueryRecord, {
        kind: 'join',
        relationship: 'many',
        name: 'array_element',
        schema: {
          fields: type.fields.map(
            f => ({kind: 'dimension', ...f}) as Malloy.FieldInfoWithDimension
          ),
        },
      });
    }
  }
  function mapRow(
    row: QueryRecord,
    field: Malloy.FieldInfoWithJoin
  ): Malloy.Cell {
    const cells: Malloy.Cell[] = [];
    for (const f of field.schema.fields) {
      const value = row[f.name];
      if (f.kind !== 'dimension') {
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
  const metadataAnnot = struct.resultMetadata
    ? getResultStructMetadataAnnotation(struct, struct.resultMetadata)
    : undefined;
  if (metadataAnnot) {
    annotations.push(metadataAnnot);
  }
  annotations.push(...(struct.resultMetadata ? [] : []));

  const sourceMetadataTag = Tag.withPrefix('#(malloy) ');
  if (result.sourceExplore) {
    sourceMetadataTag.set(['source', 'name'], result.sourceExplore.name);
  }
  if (result._sourceArguments) {
    const args = Object.entries(result._sourceArguments);
    for (let i = 0; i < args.length; i++) {
      const [name, value] = args[i];
      const literal: Malloy.LiteralValue | undefined = nodeToLiteralValue(
        value.value
      );
      if (literal !== undefined) {
        writeLiteralToTag(
          sourceMetadataTag,
          ['source', 'parameters', i, 'value'],
          literal
        );
      }
      sourceMetadataTag.set(['source', 'parameters', i, 'name'], name);
    }
  }
  annotations.push({value: sourceMetadataTag.toString()});

  annotations.push({
    value: Tag.withPrefix('#(malloy) ')
      .set(['query_name'], result.resultExplore.name)
      .toString(),
  });

  const modelAnnotations = annotationToTaglines(
    result._modelDef.annotation
  ).map(l => ({
    value: l,
  }));

  return {
    schema,
    data: mapData(result.data.rawData, schema),
    connection_name: result.connectionName,
    annotations: annotations.length > 0 ? annotations : undefined,
    model_annotations:
      modelAnnotations.length > 0 ? modelAnnotations : undefined,
    query_timezone: result.data.field.queryTimezone,
    sql: result.sql,
  };
}

export function nodeToLiteralValue(
  expr?: Expr | null
): Malloy.LiteralValue | undefined {
  switch (expr?.node) {
    case 'numberLiteral':
      return {
        kind: 'number_literal',
        number_value: Number.parseFloat(expr.literal),
      };
    case 'null':
      return {kind: 'null_literal'};
    case 'stringLiteral':
      return {kind: 'string_literal', string_value: expr.literal};
    case 'filterLiteral':
      return {
        kind: 'filter_expression_literal',
        filter_expression_value: expr.filterSrc,
        // TODO type?
      };
    case 'true':
      return {kind: 'boolean_literal', boolean_value: true};
    case 'false':
      return {kind: 'boolean_literal', boolean_value: false};
    case 'dateLiteral':
      return {
        kind: 'date_literal',
        date_value: expr.literal,
        granularity: expr.typeDef.timeframe,
      };
    case 'timestampLiteral':
    case 'timestamptzLiteral':
      return {
        kind: 'timestamp_literal',
        timestamp_value: expr.literal,
        timezone: expr.timezone,
        granularity: expr.typeDef.timeframe,
      };
    default:
      return undefined;
  }
}

export const DEFAULT_LOG_RANGE: Malloy.DocumentRange = {
  start: {
    line: 0,
    character: 0,
  },
  end: {
    line: 0,
    character: 0,
  },
};

export function mapLogs(
  logs: LogMessage[],
  defaultURL: string
): Malloy.LogMessage[] {
  return logs.map(log => ({
    severity: log.severity,
    message: log.message,
    range: log.at?.range ?? DEFAULT_LOG_RANGE,
    url: log.at?.url ?? defaultURL,
  }));
}
