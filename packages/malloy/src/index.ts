/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export {
  DuckDBDialect,
  StandardSQLDialect,
  TrinoDialect,
  PostgresDialect,
  SnowflakeDialect,
  MySQLDialect,
  registerDialect,
  arg,
  qtz,
  overload,
  minScalar,
  anyExprType,
  minAggregate,
  maxScalar,
  sql,
  makeParam,
  param,
  variadicParam,
  literal,
  spread,
  Dialect,
  TinyParser,
} from './dialect';
export type {
  DialectFieldList,
  DialectFunctionOverloadDef,
  QueryInfo,
  MalloyStandardFunctionImplementations,
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
  TinyToken,
} from './dialect';
// TODO tighten up exports
export type {
  QueryDataRow,
  // Needed for DB
  StructDef,
  TableSourceDef,
  SQLSourceDef,
  SourceDef,
  JoinFieldDef,
  NamedSourceDefs,
  MalloyQueryData,
  DateUnit,
  ExtractUnit,
  TimestampUnit,
  TemporalFieldType,
  QueryData,
  QueryValue,
  Expr,
  // Needed for drills in render
  FilterCondition,
  // Used in Composer
  Argument,
  Parameter,
  FieldDef,
  PipeSegment,
  QueryFieldDef,
  IndexFieldDef,
  TurtleDef,
  SearchValueMapResult,
  SearchIndexResult,
  ModelDef,
  Query,
  QueryResult,
  QueryResultDef,
  QueryRunStats,
  QueryScalar,
  NamedQueryDef,
  NamedModelObject,
  ExpressionType,
  FunctionDef,
  FunctionOverloadDef,
  FunctionParameterDef,
  ExpressionValueType,
  TypeDesc,
  FunctionParamTypeDesc,
  // used in MalloyError.log
  DocumentLocation,
  DocumentRange,
  DocumentPosition,
  Sampling,
  Annotation,
  BasicAtomicTypeDef,
  BasicAtomicDef,
  AtomicTypeDef,
  AtomicFieldDef,
  ArrayDef,
  ArrayTypeDef,
  RecordTypeDef,
  RepeatedRecordTypeDef,
  RecordDef,
  RepeatedRecordDef,
  // Used in testing, not really public API
  RecordLiteralNode,
  StringLiteralNode,
  ArrayLiteralNode,
  SourceComponentInfo,
  DateLiteralNode,
  TimestampLiteralNode,
  TimestamptzLiteralNode,
  TimeLiteralExpr,
  TypecastExpr,
  // Build API types
  BuildManifest,
  BuildManifestEntry,
} from './model';
export {
  isSourceDef,
  // Used in Composer Demo
  isBasicAtomic,
  isJoined,
  isJoinedSource,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  isRepeatedRecord,
  isBasicArray,
  mkArrayDef,
  mkFieldDef,
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsCalculation,
  expressionIsScalar,
  expressionIsUngroupedAggregate,
  indent,
  composeSQLExpr,
  isTimestampUnit,
  isDateUnit,
  // Used in testing, not really public API
  constantExprToSQL,
} from './model';
export {
  malloyToQuery,
  // Needed for tests only
  MalloyTranslator,
} from './lang';
export type {LogMessage, TranslateResponse} from './lang';
export {
  Model,
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
  PreparedResult,
  Result,
  QueryMaterializer,
  CSVWriter,
  JSONWriter,
  Parse,
  DataWriter,
  Explore,
  InMemoryModelCache,
  CacheManager,
} from './api/foundation';
export type {
  PreparedQuery,
  Field,
  AtomicField,
  ExploreField,
  QueryField,
  SortableField,
  DataArray,
  DataRecord,
  DataColumn,
  DataArrayOrRecord,
  Loggable,
  ModelMaterializer,
  DocumentTablePath,
  DocumentSymbol,
  ResultJSON,
  PreparedResultJSON,
  PreparedResultMaterializer,
  ExploreMaterializer,
  WriteStream,
  SerializedExplore,
  ModelCache,
  CachedModel,
  // Needed for renderer type narrowing
  DateField,
  TimestampField,
} from './api/foundation';
export type {QueryOptionsReader, RunSQLOptions} from './run_sql_options';
export type {
  EventStream,
  ModelString,
  ModelURL,
  QueryString,
  QueryURL,
  URLReader,
  InvalidationKey,
} from './runtime_types';
export type {
  Connection,
  ConnectionConfig,
  ConnectionFactory,
  ConnectionParameter,
  ConnectionParameterValue,
  ConnectionConfigSchema,
  FetchSchemaOptions,
  InfoConnection,
  LookupConnection,
  PersistSQLResults,
  PooledConnection,
  TestableConnection,
  StreamingConnection,
} from './connection/types';
export {
  registerConnectionType,
  getConnectionProperties,
  getRegisteredConnectionTypes,
  parseConnections,
  readConnectionsConfig,
  writeConnectionsConfig,
  createConnectionsFromConfig,
} from './connection/registry';
export type {
  ConnectionTypeFactory,
  ConnectionPropertyType,
  ConnectionPropertyDefinition,
  ConnectionTypeDef,
  ParseConnectionsOptions,
  ConnectionConfigEntry,
  ConnectionsConfig,
} from './connection/registry';
export {toAsyncGenerator} from './connection_utils';
export {
  modelDefToModelInfo,
  sourceDefToSourceInfo,
  writeMalloyObjectToTag,
  extractMalloyObjectFromTag,
} from './to_stable';
export * as API from './api';
export type {SQLSourceRequest} from './lang/translate-response';
export {sqlKey} from './model/sql_block';
export {annotationToTag, annotationToTaglines} from './annotation';
export type {BuildGraph, BuildNode, BuildPlan} from './api/foundation';
export {PersistSource} from './api/foundation';
export {makeDigest} from './model';
