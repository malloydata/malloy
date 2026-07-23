/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {
  DuckDBDialect,
  StandardSQLDialect,
  TrinoDialect,
  PostgresDialect,
  SnowflakeDialect,
  MySQLDialect,
  DatabricksDialect,
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
  decodeDottedTablePath,
  validateDottedTablePath,
} from './dialect';
export type {
  DialectFieldList,
  DialectFunctionOverloadDef,
  QueryInfo,
  MalloyStandardFunctionImplementations,
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
  DecodeDottedTablePathResult,
  DottedTablePathOptions,
  TablePathEscapeStyle,
  TablePathSegment,
  ValidateTablePathResult,
} from './dialect';
// TODO tighten up exports
export type {
  QueryRecord,
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
  BuildID,
  BuildManifest,
  BuildManifestEntry,
  GivenValue,
  VirtualMap,
} from './model';
export {
  isSourceDef,
  // Used in Composer Demo
  isAtomic,
  isBasicAtomic,
  isCompoundArrayData,
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
  Manifest,
  MalloyConfig,
  envOverlay,
  contextOverlay,
  defaultConfigOverlays,
  discoverConfig,
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
export type {Overlay, ConfigOverlays} from './api/foundation';
export type {FilesystemContext, MalloyConfigOptions} from './api/foundation';
export type {RuntimeContext} from './api/foundation';
export type {QueryOptionsReader, RunSQLOptions} from './run_sql_options';
export type {QueryMetadata} from './query_metadata';
export {
  QUERY_METADATA_MAX_KEY_LENGTH,
  QUERY_METADATA_MAX_VALUE_LENGTH,
  QUERY_METADATA_MAX_PROPERTIES,
  queryMetadataBag,
  queryMetadataComment,
  queryMetadataProblems,
  validateQueryMetadata,
} from './query_metadata';
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
  ConnectionParameterValue,
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
  getConnectionTypeDisplayName,
  getRegisteredConnectionTypes,
  createConnectionsFromConfig,
} from './connection/registry';
export type {
  ConnectionTypeFactory,
  ConnectionPropertyType,
  ConnectionPropertyDefinition,
  ConnectionTypeDef,
  ConnectionConfigEntry,
  ConnectionsConfig,
  JsonConfigValue,
  ManagedConnectionLookup,
} from './connection/registry';
export {toAsyncGenerator} from './connection_utils';
export {modelDefToModelInfo, sourceDefToSourceInfo} from './to_stable';
export * as API from './api';
export type {SQLSourceRequest} from './lang/translate-response';
export {sqlKey} from './model/sql_block';
export {Annotations, RoutedNote} from './api/foundation/annotation';
export {
  routeOf,
  payloadOf,
  annotationsForRoute,
  tagFromAnnotations,
} from './api/annotation-utils';
/** @deprecated — use the `.annotations` view on a Foundation entity
 *  (`entity.annotations.parseAsTag(route)` / `.texts(route)`). */
export {
  annotationToTag,
  annotationToTaglines,
} from './api/foundation/annotation';
export type {BuildGraph, BuildNode, BuildPlan} from './api/foundation';
export {PersistSource, EMPTY_BUILD_MANIFEST} from './api/foundation';
export {Reference} from './api/foundation';
export type {ReferenceKind} from './api/foundation';
export type {ImportLocation} from './model';
export {makeDigest} from './model';
