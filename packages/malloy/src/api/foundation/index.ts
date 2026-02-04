/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Types and interfaces
export type {
  Taggable,
  Loggable,
  ParseOptions,
  CompileOptions,
  CompileQueryOptions,
  BuildNode,
  BuildGraph,
} from './types';

// URL readers and connection helpers
export {
  EmptyURLReader,
  InMemoryURLReader,
  FixedConnectionMap,
  hashForInvalidationKey,
  isInternalURL,
  readURL,
  getInvalidationKey,
} from './readers';

// Cache
export type {ModelCache, CachedModel} from './cache';
export {CacheManager, InMemoryModelCache} from './cache';

// Document/Parse
export {
  Parse,
  DocumentTablePath,
  DocumentRange,
  DocumentPosition,
  DocumentSymbol,
  DocumentCompletion,
} from './document';

// Core classes (tightly coupled)
export {
  // Enums
  SourceRelationship,
  AtomicFieldType,
  DateTimeframe,
  TimestampTimeframe,
  JoinRelationship,
  // Types
  type Field,
  type SerializedExplore,
  type SortableField,
  type PreparedResultJSON,
  // Types
  type BuildPlan,
  // Classes
  Explore,
  ExploreField,
  AtomicField,
  DateField,
  TimestampField,
  NumberField,
  BooleanField,
  JSONField,
  UnsupportedField,
  StringField,
  Query,
  QueryField,
  Model,
  PersistSource,
  PreparedQuery,
  PreparedResult,
} from './core';

// Result and Data classes
export {
  type ResultJSON,
  type DataColumn,
  type DataArrayOrRecord,
  Result,
  DataArray,
  DataRecord,
} from './result';

// Writers
export {type WriteStream, DataWriter, JSONWriter, CSVWriter} from './writers';

// Runtime and Materializers
export {
  Runtime,
  ConnectionRuntime,
  SingleConnectionRuntime,
  ModelMaterializer,
  QueryMaterializer,
  PreparedResultMaterializer,
  ExploreMaterializer,
} from './runtime';

// Compile (Malloy static class)
export {
  Malloy,
  MalloyError,
  type MalloyCompileOptions,
  type MalloyRunOptions,
} from './compile';
