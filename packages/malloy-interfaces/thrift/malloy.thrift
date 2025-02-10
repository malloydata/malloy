/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

struct ModelInfo {
  1: required list<ModelEntryValue> entries,
  // TODO should (tag | annotation | tag & annotation) be a metadata type
  2: optional Tag tag,
  3: optional list<Annotation> annotations,
  4: required list<QueryInfo> anonymous_queries,
}

union ModelEntryValue {
  1: required SourceInfo source,
  2: required QueryInfo query,
}

struct SourceInfo {
  1: required string name,
  2: required Schema schema,
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
}

/*
run: name_of_query -> asdf
*/

struct QueryInfo {
  1: required string name,
  2: required Schema schema,
  3: optional Tag tag,
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

union TagValue {
  1: required StringTagValue string_value,
  2: required ArrayTagValue array_value,
}

struct StringTagValue {
  1: required string value,
}

struct ArrayTagValue {
  1: required list<Tag> value,
}

struct TagProperty {
  1: required string name,
  2: required Tag value,
}

struct Tag {
  1: optional string prefix,
  2: optional TagValue value,
  3: optional list<TagProperty> properties,
}

union FieldInfo {
  // 1: required AtomicField atomic_field,
  1: required DimensionInfo dimension,
  2: required MeasureInfo measure,
  3: required JoinInfo join,
  4: required ViewInfo view,
}

// struct AtomicField {
//   1: required string name,
//   2: required UAtomicFieldType type,
//   3: optional Tag tag,
//   4: optional list<Annotation> annotations,
// }

// TODO should these just be "AtomicField" with a "fieldtype"
struct DimensionInfo {
  1: required string name,
  2: required AtomicType type,
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
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
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
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
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
  5: required Relationship relationship,
}

struct ViewInfo {
  1: required string name,
  2: required Schema schema,
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
  // TODO naming of this
  // "openable view"
  5: optional View definition,
  // Possibly need `filterList` depending on how we do drills
}

struct View {
  2: required Pipeline pipeline,
  3: optional list<TagOrAnnotation> annotations,
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

union Refinement {
  1: required Reference reference,
  2: required Segment segment,
}

struct Segment {
  1: required list<ViewOperation> operations,
}

union ViewOperation {
  1: required GroupBy group_by,
  2: required Aggregate aggregate,
  3: OrderBy order_by,
  4: required Limit limit,
  5: required Where where,
  6: required Nest nest,
}

union TagOrAnnotation {
  1: required Tag tag,
  2: required Annotation annotation,
}

struct GroupBy {
  1: required list<GroupByItem> items,
  2: optional list<TagOrAnnotation> annotations,
}

struct GroupByItem {
  1: optional string name,
  2: required Field field,
}

struct Nest {
  1: required list<NestItem> items,
  2: optional list<TagOrAnnotation> annotations,
}

struct NestItem {
  1: optional string name,
  2: required View view,
}

struct Aggregate {
  1: required list<AggregateOperation> items,
  2: optional list<TagOrAnnotation> annotations,
}

struct AggregateOperation {
  1: optional string name,
  2: required Field field,
}

struct Field {
  1: required Expression expression,
  // TODO only two kinds of distinguishable annotations are before `aggregate:` and before `name is value`
  // between `name` and `is`, or between `is` and `value` are converted to before `name`.
  2: optional list<TagOrAnnotation> annotations,
}

struct OrderBy {
  1: required list<OrderByItem> items,
}

struct OrderByItem {
  1: required Reference field,
  2: optional OrderByDirection direction,
}

struct Limit {
  1: required i32 limit,
}

struct Where {
  1: required list<WhereItem> items,
}

union WhereItem {
  1: required FilterStringApplication filter_string,
}

struct FilterStringApplication {
  1: required Reference field,
  2: required string filter, // TODO multiple filters?
}

struct PipeStage {
  1: required list<Refinement> refinements,
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
  1: optional Reference source,
  2: required Pipeline pipeline,
  3: optional list<TagOrAnnotation> annotations,
}

struct Pipeline {
  1: required list<PipeStage> stages,
}

struct Reference {
  1: required string name,
  2: optional list<ParameterValue> parameters,
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
}

struct TimestampLiteral {
  1: required string timestamp_value,
}

struct NullLiteral {
}

union Expression {
  1: required Reference reference,
  2: required TimeTruncationFieldReference time_truncation,
  3: required FilteredField filtered_field,
}

struct TimeTruncationFieldReference {
  1: required Reference reference, // TODO do I make this circular, more like actual grammar? e.g. TimeTruncation rather than TimeTruncationFieldReference
  2: required TimestampTimeframe truncation,
}

struct FilteredField {
  1: required Reference reference,
  2: required WhereItem filter, // TODO multiple filters?
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

struct TimestampCell {
  1: required string timestamp_value, // TODO another way to represent dates?
}

struct DateCell {
  1: required string date_value, // TODO another way to represent dates?
}

struct JSONCell {
  1: required string json_value,
}

struct ArrayCell {
  1: required list<Cell> array_value,
}

// A record is also just a list of values, because we don't need to store the names in the data
struct RecordCell {
  1: required list<Cell> record_value,
}

struct TableCell {
  1: required Table table_value,
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
  9: required TableCell table_cell, // TODO does this need to be different from an array of records
  // TODO sql_native???
}

struct Row {
  1: required list<Cell> cells,
}

struct Table {
  1: required list<Row> rows,
}

union Data {
  1: required RecordCell record,
  2: required Table table,
}

// should this be one type "Result" with optional data/sql, or three different types?
struct Result {
  1: optional Data data,
  2: required Schema schema,
  3: optional string sql,
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
