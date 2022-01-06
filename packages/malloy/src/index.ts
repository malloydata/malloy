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

// TODO tighten up exports
export {
  // Currently needed only by tests
  ModelDef,
  Fragment,
  Query,
  // Needed for DB
  StructDef,
  NamedStructDefs,
  MalloyQueryData,
  AtomicFieldType,
  QueryData,
  FieldTypeDef,
  // Needed for drills in render
  FilterExpression,
} from "./model";
export {
  // Neede for VSCode extension
  HighlightType,
  LogMessage,
  // Needed for tests only
  MalloyTranslator,
  TranslateResponse,
} from "./lang";
export {
  Malloy,
  Runtime,
  EmptyURLReader,
  InMemoryURLReader,
  FixedConnectionMap,
  MalloyError,
  JoinRelationship,
  SourceRelationship,
  DateTimeframe,
  TimestampTimeframe,
  Result,
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
  DataColumn,
  DataArrayOrRecord,
  ModelMaterializer,
  DocumentSymbol,
  DocumentHighlight,
  ResultJSON,
} from "./malloy";
export type {
  URLReader,
  SchemaReader,
  LookupSchemaReader,
  SQLRunner,
  LookupSQLRunner,
  QueryString,
  ModelString,
  QueryURL,
  ModelURL,
} from "./runtime_types";
export { URL } from "./runtime_types";
export { Connection } from "./connection";
export type { Loggable } from "./malloy";
