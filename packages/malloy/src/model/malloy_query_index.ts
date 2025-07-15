/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  QueryStruct,
  type QueryStructParams,
  type QueryFieldFactories,
} from './query_struct';
import type {QueryField} from './query_field';
import {
  QueryFieldString,
  QueryFieldDate,
  QueryFieldTimestamp,
  QueryFieldNumber,
  QueryFieldBoolean,
  QueryFieldJSON,
  QueryFieldUnsupported,
  QueryFieldStruct,
  QueryFieldDistinctKey,
} from './query_field';

import type {StructDef} from './malloy_types';
import {
  type StringFieldDef,
  type DateFieldDef,
  type TimestampFieldDef,
  type NumberFieldDef,
  type BooleanFieldDef,
  type JSONFieldDef,
  type NativeUnsupportedFieldDef,
  type JoinFieldDef,
  type FieldDef,
  fieldIsIntrinsic,
  getIdentifier,
} from './malloy_types';
import type {DialectFieldList} from '../dialect';

// Create the factories object with all the typed methods
const queryFieldFactories: QueryFieldFactories = {
  createString: (
    field: StringFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldString => new QueryFieldString(field, parent, ref),

  createDate: (
    field: DateFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldDate => new QueryFieldDate(field, parent, ref),

  createTimestamp: (
    field: TimestampFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldTimestamp => new QueryFieldTimestamp(field, parent, ref),

  createNumber: (
    field: NumberFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldNumber => new QueryFieldNumber(field, parent, ref),

  createBoolean: (
    field: BooleanFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldBoolean => new QueryFieldBoolean(field, parent, ref),

  createJSON: (
    field: JSONFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldJSON => new QueryFieldJSON(field, parent, ref),

  createUnsupported: (
    field: NativeUnsupportedFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldUnsupported => new QueryFieldUnsupported(field, parent, ref),

  createStruct: (
    field: JoinFieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryFieldStruct =>
    new QueryFieldStruct(createQueryStruct, field, undefined, parent, {}, ref),

  createDistinctKey: (
    field: StringFieldDef,
    parent: QueryStruct
  ): QueryFieldDistinctKey => new QueryFieldDistinctKey(field, parent),

  createFromDef: (
    field: FieldDef,
    parent: QueryStruct,
    ref?: string
  ): QueryField => {
    switch (field.type) {
      case 'string':
        return queryFieldFactories.createString(field, parent, ref);
      case 'date':
        return queryFieldFactories.createDate(field, parent, ref);
      case 'timestamp':
        return queryFieldFactories.createTimestamp(field, parent, ref);
      case 'number':
        return queryFieldFactories.createNumber(field, parent, ref);
      case 'boolean':
        return queryFieldFactories.createBoolean(field, parent, ref);
      case 'json':
        return queryFieldFactories.createJSON(field, parent, ref);
      case 'sql native':
        return queryFieldFactories.createUnsupported(field, parent, ref);
      case 'array':
      case 'record':
      case 'query_source':
      case 'table':
      case 'sql_select':
      case 'composite':
        return queryFieldFactories.createStruct(field, parent, ref);
      default:
        throw new Error(
          `Unknown field type in createFromDef: ${field['type']}`
        );
    }
  },
};

// Create the QueryStruct factory that injects the field factories
export const createQueryStruct = (...args: QueryStructParams): QueryStruct =>
  new QueryStruct(queryFieldFactories, ...args);

// Re-export all classes and types for external consumers
export {
  QueryStruct,
  type QueryStructParams,
  type QueryFieldFactories,
  type ParentQueryStruct,
} from './query_struct';
export {
  QueryField,
  QueryFieldString,
  QueryFieldDate,
  QueryFieldTimestamp,
  QueryFieldNumber,
  QueryFieldBoolean,
  QueryFieldJSON,
  QueryFieldUnsupported,
  QueryFieldStruct,
  QueryFieldDistinctKey,
  QueryNode,
  QueryAtomicField,
  type QueryBasicField,
  isAggregateField,
  isCalculatedField,
  isScalarField,
  isBasicAggregate,
  isBasicCalculation,
  isBasicScalar,
} from './query_field';
export {JoinInstance} from './join_instance';
export * from './query_query';
export * from './query_model';
export * from './segment';
export {getResultStructDefForQuery} from './query_model';
export {getResultStructDefForView} from './query_query';

export function getDialectFieldList(structDef: StructDef): DialectFieldList {
  const dialectFieldList: DialectFieldList = [];

  for (const f of structDef.fields.filter(fieldIsIntrinsic)) {
    dialectFieldList.push({
      typeDef: f,
      sqlExpression: getIdentifier(f),
      rawName: getIdentifier(f),
      sqlOutputName: getIdentifier(f),
    });
  }
  return dialectFieldList;
}
