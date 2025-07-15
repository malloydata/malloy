/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

struct ModelInfo {
  1: required list<ModelEntryValue> entries,
  2: optional list<Annotation> annotations,
  3: required list<AnonymousQueryInfo> anonymous_queries,
}

union ModelEntryValue {
  1: required SourceInfo source,
  2: required QueryInfo query,
}

struct SourceInfo {
  1: required string name,
  2: required Schema schema,
  3: optional list<Annotation> annotations,
  4: optional list<ParameterInfo> parameters,
}

struct ParameterInfo {
  1: required string name,
  2: required ParameterType type,
  3: optional LiteralValue default_value,
}

struct QueryInfo {
  1: required string name,
  2: required Schema schema,
  3: optional list<Annotation> annotations,
  // "openable query"
  4: optional Query definition,
  // TODO consider code and location for ALL objects in the model
  // TODO should this be optional or always present? or not here at all?
    // Argument against: if all objects have their code, then there is tons of repetition
    // Instead, maybe just have all the code in the model (or not at all, rely on user?)
    // and use locations
    // What about definitions from other files?
    // Should Location have a url at all, or just be the Range -- does Thrift handle repetition of
    // strings well?
  5: optional string code,
  // TODO should this be optional or always present? or not here at all?
  6: optional Location location,
}

struct AnonymousQueryInfo {
  2: required Schema schema,
  4: optional list<Annotation> annotations,
  // "openable query"
  5: optional Query definition,
  // TODO consider code and location for ALL objects in the model
  // TODO should this be optional or always present? or not here at all?
    // Argument against: if all objects have their code, then there is tons of repetition
    // Instead, maybe just have all the code in the model (or not at all, rely on user?)
    // and use locations
    // What about definitions from other files?
    // Should Location have a url at all, or just be the Range -- does Thrift handle repetition of
    // strings well?
  6: optional string code,
  // TODO should this be optional or always present? or not here at all?
  7: optional Location location,
}

struct Location {
  1: required string url,
  2: required Range range,
}

struct Range {
  1: required Position start,
  2: required Position end,
}

struct Position {
  1: required i32 line,
  2: required i32 character,
}

struct Schema {
  1: required list<FieldInfo> fields,
}

struct Annotation {
  1: required string value,
}

union FieldInfo {
  // 1: required AtomicField atomic_field,
  1: required DimensionInfo dimension,
  2: required MeasureInfo measure,
  3: required JoinInfo join,
  4: required ViewInfo view,
}

// TODO should these just be "AtomicField" with a "fieldtype"
struct DimensionInfo {
  1: required string name,
  2: required AtomicType type,
  3: optional list<Annotation> annotations,
  // TODO possibly need "wasDimension vs wasMeasure"
  // TODO possibly need "isExpression" depending on how we do drills
  // TODO possibly need "isParameter" depending on how we do drills
  // TODO possibly need "isProtected/isPrivate" depending on how we do drills
  // TODO possibly need `referenceId` to enable renderer to know when two fields are the same
    // or maybe we can come up with another solution?
}

struct MeasureInfo {
  1: required string name,
  2: required AtomicType type,
  3: optional list<Annotation> annotations,
}

// TODO do I need the full "nested"/"query"/"one_to_one" etc?
enum Relationship {
  ONE = 1,
  MANY = 2,
  CROSS = 3
}

struct JoinInfo {
  1: required string name,
  2: required Schema schema,
  3: optional list<Annotation> annotations,
  4: required Relationship relationship,
}

struct ViewInfo {
  1: required string name,
  2: required Schema schema,
  3: optional list<Annotation> annotations,
  // TODO naming of this
  // "openable view"
  4: optional View definition,
  // Possibly need `filterList` depending on how we do drills
}

struct View {
  2: required ViewDefinition definition,
  3: optional list<Annotation> annotations,
}

enum OrderByDirection {
  ASC = 1,
  DESC = 2,
}

struct StringType {
}

struct BooleanType {
}

enum NumberSubtype {
  INTEGER = 1,
  DECIMAL = 2,
}

struct NumberType {
  1: optional NumberSubtype subtype,
}

struct JSONType {
}

struct ArrayType {
  1: required AtomicType element_type;
}

struct RecordType {
  1: required list<DimensionInfo> fields
}

struct FilterExpressionType {
  1: required FilterableType filter_type;
}

union FilterableType {
  1: required StringType string_type;
  2: required BooleanType boolean_type;
  3: required NumberType number_type;
  6: required DateType date_type;
  7: required TimestampType timestamp_type;
}

union AtomicType {
  1: required StringType string_type,
  2: required BooleanType boolean_type,
  3: required NumberType number_type,
  4: required JSONType json_type,
  5: required SQLNativeType sql_native_type,
  6: required DateType date_type,
  7: required TimestampType timestamp_type,
  9: required ArrayType array_type,
  10: required RecordType record_type,
}

union ParameterType {
  1: required StringType string_type,
  2: required BooleanType boolean_type,
  3: required NumberType number_type,
  4: required JSONType json_type,
  5: required SQLNativeType sql_native_type,
  6: required DateType date_type,
  7: required TimestampType timestamp_type,
  9: required ArrayType array_type,
  10: required RecordType record_type,
  11: required FilterExpressionType filter_expression_type,
}

struct SQLNativeType {
  1: optional string sql_type,
}

enum DateTimeframe {
  YEAR = 1,
  QUARTER = 2,
  MONTH = 3,
  WEEK = 4,
  DAY = 5,
}

enum TimestampTimeframe {
  YEAR = 1,
  QUARTER = 2,
  MONTH = 3,
  WEEK = 4,
  DAY = 5,
  HOUR = 6,
  MINUTE = 7,
  SECOND = 8,
}

struct DateType {
  2: optional DateTimeframe timeframe,
}

struct TimestampType {
  2: optional TimestampTimeframe timeframe,
}

/*

Questions:
- Should `fields`, `sources`, etc. be Map<string, Field> or Field[]
- Any way to have an "either" type? use unions?
- How to represent a refinement of a model query

Generate typescript?
- https://github.com/creditkarma/thrift-typescript
    - https://www.internalfb.com/diff/D68557062
*/

union ViewOperation {
  1: required GroupBy group_by,
  2: required Aggregate aggregate,
  3: OrderBy order_by,
  4: required Limit limit,
  5: required FilterOperation where,
  6: required Nest nest,
  7: required FilterOperation having,
  8: required DrillOperation drill,
  9: required CalculateOperation calculate,
}

struct GroupBy {
  1: optional string name,
  2: required Field field,
}

struct Nest {
  1: optional string name,
  2: required View view,
}

struct Aggregate {
  1: optional string name,
  2: required Field field,
}

struct Field {
  1: required Expression expression,
  // TODO only two kinds of distinguishable annotations are before `aggregate:` and before `name is value`
  // between `name` and `is`, or between `is` and `value` are converted to before `name`.
  2: optional list<Annotation> annotations,
}

struct OrderBy {
  1: required Reference field_reference,
  2: optional OrderByDirection direction,
}

struct Limit {
  1: required i32 limit,
}

// TODO this is a bit annoying, but the current typescript system doesn't really
// allow me to have a union whose property is also a union, since I'm compressing them
// into an intersection type of `{__type: } & Where`. If Where is also a union, then
// there would be two `__type` fields...
struct FilterOperation {
  1: required Filter filter,
}

struct DrillOperation {
  1: required Filter filter,
}

struct CalculateOperation {
  1: required string name,
  2: required Field field,
}

union Filter {
  1: required FilterStringApplication filter_string,
  2: required LiteralEqualityComparison literal_equality,
}

struct FilterStringApplication {
  1: required Expression expression,
  2: required string filter,
}

struct LiteralEqualityComparison {
  1: required Expression expression,
  2: required LiteralValue value,
}

/**

stages: [
  {ref: ff}
  {refin: {base: ff}, {seg}}
  {seg}
]

stages: [
  {
    refinements: [
      {ref}
      {ref}
      {seg}
    ]
  }
]
*/

struct Query {
  1: required QueryDefinition definition,
  2: optional list<Annotation> annotations,
}

union QueryDefinition {
  1: QueryArrow arrow,
  2: Reference query_reference,
  3: QueryRefinement refinement,
}

union QueryArrowSource {
  3: QueryRefinement refinement,
  2: Reference source_reference,
}

struct QueryArrow {
  1: required QueryArrowSource source,
  2: required ViewDefinition view,
}

struct QueryRefinement {
  1: required QueryDefinition base,
  2: required ViewDefinition refinement,
}

union ViewDefinition {
  1: ViewArrow arrow,
  2: Reference view_reference,
  3: ViewRefinement refinement,
  4: ViewSegment segment,
}

struct ViewRefinement {
  1: required ViewDefinition base,
  2: required ViewDefinition refinement,
}

struct ViewArrow {
  1: required ViewDefinition source,
  2: required ViewDefinition view,
}

struct ViewSegment {
  1: required list<ViewOperation> operations,
}

struct Reference {
  1: required string name,
  2: optional list<string> path,
  3: optional list<ParameterValue> parameters,
}

struct ParameterValue {
  1: required string name,
  2: required LiteralValue value,
}

union LiteralValue {
  1: required StringLiteral string_literal,
  2: required NumberLiteral number_literal,
  3: required DateLiteral date_literal,
  4: required TimestampLiteral timestamp_literal,
  5: required BooleanLiteral boolean_literal,
  6: required NullLiteral null_literal,
  7: required FilterExpressionLiteral filter_expression_literal,
}

struct StringLiteral {
  1: required string string_value,
}

struct NumberLiteral {
  1: required double number_value,
}

struct BooleanLiteral {
  1: required bool boolean_value,
}

struct DateLiteral {
  1: required string date_value,
  2: optional DateTimeframe granularity,
  3: optional string timezone,
}

struct TimestampLiteral {
  1: required string timestamp_value,
  2: optional TimestampTimeframe granularity,
  3: optional string timezone,
}

struct NullLiteral {
}

struct FilterExpressionLiteral {
  1: required string filter_expression_value,
}

struct LiteralValueExpression {
  1: required LiteralValue literal_value,
}

union Expression {
  1: required Reference field_reference,
  2: required TimeTruncationFieldReference time_truncation,
  3: required FilteredField filtered_field,
  4: required LiteralValueExpression literal_value,
  5: required MovingAverage moving_average
}

struct TimeTruncationFieldReference {
  1: required Reference field_reference, // TODO do I make this circular, more like actual grammar? e.g. TimeTruncation rather than TimeTruncationFieldReference
  2: required TimestampTimeframe truncation,
}

struct FilteredField {
  1: required Reference field_reference,
  2: required list<FilterOperation> where,
}

struct MovingAverage {
  1: required Reference field_reference,
  2: optional i32 rows_preceding
  3: optional i32 rows_following
}

struct StringCell {
  1: required string string_value,
}

struct BooleanCell {
  1: required bool boolean_value,
}

struct NumberCell {
  1: required double number_value,
}

struct NullCell {}

struct TimestampCell {
  1: required string timestamp_value, // TODO another way to represent dates?
}

struct DateCell {
  1: required string date_value, // TODO another way to represent dates?
}

struct JSONCell {
  1: required string json_value,
}

struct SQLNativeCell {
  1: required string sql_native_value,
}

struct ArrayCell {
  1: required list<Cell> array_value,
}

// A record is also just a list of values, because we don't need to store the names in the data
struct RecordCell {
  1: required list<Cell> record_value,
}

union Cell {
  1: required StringCell string_cell,
  2: required BooleanCell boolean_cell,
  3: required DateCell date_cell,
  4: required TimestampCell timestamp_cell, // TODO does this need to be separate?
  5: required NumberCell number_cell,
  6: required JSONCell json_cell, // TODO does this need to be here?
  7: required RecordCell record_cell,
  8: required ArrayCell array_cell,
  9: required NullCell null_cell,
  10: required SQLNativeCell sql_native_cell,
}

union Data {
  1: required RecordCell record_cell,
  2: required ArrayCell array_cell,
}

// should this be one type "Result" with optional data/sql, or three different types?
struct Result {
  1: optional Data data,
  2: required Schema schema,
  3: optional string sql,
  4: required string connection_name,
  5: optional list<Annotation> annotations,
  6: optional list<Annotation> model_annotations,
  7: optional string query_timezone,
  8: optional list<Annotation> source_annotations,
}

/*

Result metadata:

  // I think not used

  sourceField: string;

  // used by drill to drill on fields which were expressions (probably in future replaced with `where: view_name.field ? ...`)

  sourceExpression?: string;

  // only used by legacy renderer

  sourceClasses: string[];

  // used by drill to collect filters

  filterList?: FilterCondition[];

  // used by renderer to pick default axes

  fieldKind: 'measure' | 'dimension' | 'struct';

  // used by renderer to know whether two fields in the result are the same, for hover syncing and axis sharing etc

  referenceId?: string;
*/


/*
TODO
- formalize difference between a "Summary" of a thing and a "Definition" of a thing
  this will make the naming of things clearer: ViewSummary vs ViewDefinition
- Openable views
- code for things
- openable dimensions/measures?

*/

// concern: shape of FieldInfo and GroupBy (no object for "Field") are funadmentally pretty different,
// but it might be nice for them to be more similar.

struct SQLTable {
  1: required string name,
  2: optional Schema schema,
  3: required string connection_name,
}

struct SQLQuery {
  1: required string sql,
  2: optional Schema schema,
  3: required string connection_name,
}

struct File {
  1: required string url,
  2: optional string contents,
  3: optional string invalidation_key,
}

struct Connection {
  1: required string name,
  2: optional string dialect,
}

struct Translation {
  1: required string url,
  2: optional string compiled_model_json,
}

struct CompilerNeeds {
  1: optional list<SQLTable> table_schemas,
  2: optional list<SQLQuery> sql_schemas,
  3: optional list<File> files,
  4: optional list<Connection> connections,
  5: optional list<Translation> translations,
}

struct DocumentPosition {
  1: required i32 line;
  2: required i32 character;
}

struct DocumentRange {
  1: required DocumentPosition start;
  2: required DocumentPosition end;
}

enum LogSeverity {
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

struct LogMessage {
  1: required string url;
  2: required DocumentRange range;
  3: required LogSeverity severity;
  4: required string message;
}

// Given the URL to a model, return the StableModelDef for that model

struct CompileModelRequest {
  1: required string model_url,
  2: optional string extend_model_url,

  9: optional CompilerNeeds compiler_needs,
}

struct CompileModelResponse {
  1: optional ModelInfo model,

  8: optional list<LogMessage> logs,
  9: optional CompilerNeeds compiler_needs,
  10: optional list<Translation> translations;
}

// Given the URL to a model and a name of a queryable thing, get a StableSourceDef

struct CompileSourceRequest {
  1: required string model_url,
  2: required string name,
  3: optional string extend_model_url,

  9: optional CompilerNeeds compiler_needs,
}

struct CompileSourceResponse {
  1: optional SourceInfo source,

  8: optional list<LogMessage> logs,
  9: optional CompilerNeeds compiler_needs,
}

// Given a StableQueryDef and the URL to a model, run it and return a StableResult

struct RunQueryRequest {
  1: required string model_url,
  2: required Query query,
  3: optional i32 default_row_limit,

  9: optional CompilerNeeds compiler_needs,
}

struct RunQueryResponse {
  1: optional Result result,

  7: optional i32 default_row_limit_added,
  8: optional list<LogMessage> logs,
  9: optional CompilerNeeds compiler_needs,
}

// Given a StableQueryDef and the URL to a model, compile it and return a StableResultDef

struct CompileQueryRequest {
  1: required string model_url,
  2: required Query query,
  3: optional i32 default_row_limit,

  9: optional CompilerNeeds compiler_needs,
}

struct CompileQueryResponse {
  1: optional Result result,

  7: optional i32 default_row_limit_added,
  8: optional list<LogMessage> logs,
  9: optional CompilerNeeds compiler_needs,
  10: optional list<Translation> translations;
}

// Given a URL to a model and the name of a source, run the indexing query

struct RunIndexQueryRequest {
  1: required string model_url,
  2: required string source_name,

  9: optional CompilerNeeds compiler_needs,
}

struct RunIndexQueryResponse {
  1: optional Result result,

  9: optional CompilerNeeds compiler_needs,
}
