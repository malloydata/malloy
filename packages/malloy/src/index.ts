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
  PostgresDialect,
  SnowflakeDialect,
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
} from './dialect';
export type {
  DialectFieldList,
  DialectFunctionOverloadDef,
  QueryInfo,
  MalloyStandardFunctionImplementations,
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from './dialect';
// TODO tighten up exports
export type {
  QueryDataRow,
  // Needed for DB
  StructDef,
  StructRelationship,
  NamedStructDefs,
  MalloyQueryData,
  AtomicFieldType as AtomicFieldTypeInner,
  DateUnit,
  ExtractUnit,
  TimestampUnit,
  TimeFieldType,
  QueryData,
  QueryValue,
  FieldTypeDef,
  Expr,
  // Needed for drills in render
  FilterCondition,
  SQLBlock,
  // Used in Composer Demo
  FieldAtomicDef,
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
  QueryRunStats,
  NamedQuery,
  NamedModelObject,
  ExpressionType,
  FunctionDef,
  FunctionOverloadDef,
  FunctionParameterDef,
  ExpressionValueType,
  TypeDesc,
  FieldValueType,
  ExpressionTypeDesc,
  FunctionParamTypeDesc,
  // used in MalloyError.log
  DocumentLocation,
  DocumentRange,
  DocumentPosition,
  Sampling,
  Annotation,
  FieldAtomicTypeDef,
  SQLBlockStructDef,
} from './model';
export {
  // Used in Composer Demo
  Segment,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  expressionIsCalculation,
  indent,
  composeSQLExpr,
} from './model';
export {
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
} from './malloy';
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
  PreparedResultMaterializer,
  SQLBlockMaterializer,
  ExploreMaterializer,
  WriteStream,
  SerializedExplore,
} from './malloy';
export type {QueryOptionsReader, RunSQLOptions} from './run_sql_options';
export type {
  ModelString,
  ModelURL,
  QueryString,
  QueryURL,
  URLReader,
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
export {toAsyncGenerator} from './connection_utils';
export {type TagParse, Tag, type TagDict} from './tags';
