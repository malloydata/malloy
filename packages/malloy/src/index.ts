/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

export {
  Malloy,
  Runner,
  Runtime,
  EmptyUrlReader,
  InMemoryUrlReader,
  FixedConnections,
  MalloyError,
  JoinRelationship,
  SourceRelationship,
} from "./malloy";
export type {
  Explore,
  Model,
  PreparedQuery,
  PreparedResult,
  Field,
  AtomicField,
  ExploreField,
  QueryField,
  Result,
  DataArray,
  ModelRuntimeRequest,
} from "./malloy";
export type {
  UrlReader,
  SchemaReader,
  LookupSchemaReader,
  SqlRunner,
  LookupSqlRunner,
  QueryString,
  ModelString,
  QueryUrl,
  ModelUrl,
} from "./runtime_types";
export { Url } from "./runtime_types";

// TODO these should all go away or move to malloy.ts
// TODO AtomicFieldType is defined in malloy.ts but also in malloy_types (and defined differently)
export {
  AtomicFieldType,
  FieldTypeDef,
  FieldDef,
  StructDef,
  QueryData,
  QueryScalar,
  QueryDataRow,
  QueryValue,
  NamedStructDefs,
  MalloyQueryData,
  FilterExpression,
  TimeTimeframe,
  isValueBoolean,
  getDimensions,
  isValueString,
  isValueTimestamp,
  isValueDate,
  isFieldTimeBased,
  isValueNumber,
  isMeasureLike,
  isDimensional,
} from "./model";
export { HighlightType, LogMessage } from "./lang"; // TODO move this?
export { Connection } from "./connection";
export type { Loggable } from "./malloy";
