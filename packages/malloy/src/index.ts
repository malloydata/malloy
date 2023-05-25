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

// TODO tighten up exports
export type {
  QueryDataRow,
  // Currently needed only by tests
  Fragment,
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
  FieldTypeDef,
  Expr,
  DialectFragment,
  TimeValue,
  // Needed for drills in render
  FilterExpression,
  SQLBlock,
  // Used in Composer Demo
  FieldDef,
  FilteredAliasedName,
  PipeSegment,
  QueryFieldDef,
  TurtleDef,
  SearchValueMapResult,
  SearchIndexResult,
  ModelDef,
  Query,
  NamedQuery,
  NamedModelObject,
  ExpressionType,
  // used in MalloyError.log
  DocumentLocation,
  DocumentRange,
  DocumentPosition,
} from './model';
export {
  // Used in Composer Demo
  Segment,
  isFilteredAliasedName,
  flattenQuery,
  expressionIsCalculation,
} from './model';
export {
  // Neede for VSCode extension
  HighlightType,
  // Needed for tests only
  MalloyTranslator,
} from './lang';
export type {LogMessage, TranslateResponse} from './lang';
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
  parseTableURI,
  QueryMaterializer,
  CSVWriter,
  JSONWriter,
  Parse,
  DataWriter,
  Explore,
} from './malloy';
export type {
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
  SerializedExplore,
} from './malloy';
export type {RunSQLOptions} from './run_sql_options';
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
  StreamingConnection,
} from './runtime_types';
export type {Loggable} from './malloy';
export {toAsyncGenerator} from './connection_utils';
