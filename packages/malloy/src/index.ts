/*
 * Copyright 2022 Google LLC
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

// TODO tighten up exports
export type {
  QueryDataRow,
  // Currently needed only by tests
  ModelDef,
  Fragment,
  Query,
  // Needed for DB
  StructDef,
  NamedStructDefs,
  MalloyQueryData,
  AtomicFieldType as AtomicFieldTypeInner,
  DateUnit,
  ExtractUnit,
  TimestampUnit,
  TimeFieldType,
  QueryData,
  FieldTypeDef,
  Expr,
  DialectFragment,
  TimeValue,
  // Needed for drills in render
  FilterExpression,
  SQLBlock,
  // Used in Composer Demo
  FieldDef,
  PipeSegment,
  QueryFieldDef,
  TurtleDef,
  SearchValueMapResult,
  SearchIndexResult,
} from "./model";
export {
  // Used in Composer Demo
  Segment,
  isFilteredAliasedName,
} from "./model";
export {
  // Neede for VSCode extension
  HighlightType,
  // Needed for tests only
  MalloyTranslator,
} from "./lang";
export type { LogMessage, TranslateResponse } from "./lang";
export {
  Malloy,
  Runtime,
  AtomicFieldType,
  ConnectionRuntime,
  SingleConnectionRuntime,
  EmptyURLReader,
  InMemoryURLReader,
  FixedConnectionMap,
  MalloyError,
  JoinRelationship,
  SourceRelationship,
  DateTimeframe,
  TimestampTimeframe,
  Result,
  parseTableURL,
  QueryMaterializer,
  CSVWriter,
  JSONWriter,
  DataWriter,
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
  DataArray,
  DataRecord,
  DataColumn,
  DataArrayOrRecord,
  ModelMaterializer,
  DocumentSymbol,
  DocumentHighlight,
  ResultJSON,
  PreparedResultMaterializer,
  SQLBlockMaterializer,
  ExploreMaterializer,
  WriteStream,
} from "./malloy";
export type {
  URLReader,
  InfoConnection,
  LookupConnection,
  Connection,
  QueryString,
  ModelString,
  QueryURL,
  ModelURL,
  PooledConnection,
  TestableConnection,
  PersistSQLResults,
} from "./runtime_types";
export type { Loggable } from "./malloy";
export { toAsyncGenerator } from "./connection_utils";
