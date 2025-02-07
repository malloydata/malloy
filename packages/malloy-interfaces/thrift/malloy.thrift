/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

struct ModelInfo {
  1: list<ModelEntryValue> entries,
  // TODO should (tag | annotation | tag & annotation) be a metadata type
  2: optional Tag tag,
  3: optional list<Annotation> annotations,
  4: list<QueryInfo> anonymous_queries,
}

union ModelEntryValue {
  1: SourceInfo source,
  2: QueryInfo query,
}

struct SourceInfo {
  1: string name,
  2: Schema schema,
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
}

/*
run: name_of_query -> asdf
*/

struct QueryInfo {
  1: string name,
  2: Schema schema,
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
  2: Schema schema,
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
  1: string url,
  2: Range range,
}

struct Range {
  1: Position start,
  2: Position end,
}

struct Position {
  1: i32 line,
  2: i32 character,
}

struct Schema {
  1: list<FieldInfo> fields,
}

struct Annotation {
  1: string value,
}

union TagValue {
  1: string string_value,
  2: list<Tag> array_value,
}

struct TagProperty {
  1: string name,
  2: Tag value,
}

struct Tag {
  1: optional string prefix,
  2: optional TagValue value,
  3: optional list<TagProperty> properties,
}

union FieldInfo {
  // 1: AtomicField atomic_field,
  1: DimensionInfo dimension,
  2: MeasureInfo measure,
  3: JoinInfo join,
  4: ViewInfo view,
}

// struct AtomicField {
//   1: string name,
//   2: UAtomicFieldType type,
//   3: optional Tag tag,
//   4: optional list<Annotation> annotations,
// }

// TODO should these just be "AtomicField" with a "fieldtype"
struct DimensionInfo {
  1: string name,
  2: AtomicType type,
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
  1: string name,
  2: AtomicType type,
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
  1: string name,
  2: Schema schema,
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
  5: Relationship relationship,
}

struct ViewInfo {
  1: string name,
  2: Schema schema,
  3: optional Tag tag,
  4: optional list<Annotation> annotations,
  // TODO naming of this
  // "openable view"
  5: optional View definition,
  // Possibly need `filterList` depending on how we do drills
}

struct View {
  2: Pipeline pipeline,
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
  1: AtomicType element_type;
}

struct RecordType {
  1: list<DimensionInfo> fields
}

union AtomicType {
  1: StringType string_type,
  2: BooleanType boolean_type,
  3: NumberType number_type,
  4: JSONType json_type,
  5: SQLNativeType sql_native_type,
  6: DateType date_type,
  7: TimestampType timestamp_type,
  9: ArrayType array_type,
  10: RecordType record_type,
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

union RefinementBase {
  1: Reference reference,
}

struct Refinement {
  1: RefinementBase base,
  2: RefinementOperation operation,
}

union RefinementOperation {
  1: Reference reference,
  2: Segment segment,
}

struct Segment {
  1: list<ViewOperation> operations,
}

union ViewOperation {
  1: GroupBy group_by,
  2: Aggregate aggregate,
  3: OrderBy order_by,
  4: Limit limit,
  5: Where where,
  6: Nest nest,
}

union TagOrAnnotation {
  1: Tag tag,
  2: Annotation annotation,
}

struct GroupBy {
  1: list<GroupByItem> items,
  2: optional list<TagOrAnnotation> annotations,
}

struct GroupByItem {
  1: optional string name,
  2: Field field,
}

struct Nest {
  1: list<NestItem> items,
  2: optional list<TagOrAnnotation> annotations,
}

struct NestItem {
  1: optional string name,
  2: View view,
}

struct Aggregate {
  1: list<AggregateOperation> items,
  2: optional list<TagOrAnnotation> annotations,
}

struct AggregateOperation {
  1: optional string name,
  2: Field field,
}

struct Field {
  1: Expression expression,
  // TODO only two kinds of distinguishable annotations are before `aggregate:` and before `name is value`
  // between `name` and `is`, or between `is` and `value` are converted to before `name`.
  2: optional list<TagOrAnnotation> annotations,
}

struct OrderBy {
  1: list<OrderByItem> items,
}

struct OrderByItem {
  1: Reference field,
  2: optional OrderByDirection direction,
}

struct Limit {
  1: i32 limit,
}

struct Where {
  1: list<WhereItem> items,
}

union WhereItem {
  1: FilterStringApplication filter_string,
}

struct FilterStringApplication {
  1: Reference field,
  2: string filter, // TODO multiple filters?
}

union PipeStage {
  1: Reference reference,
  2: Refinement refinement,
  3: Segment segment,
}

struct Query {
  1: optional Reference source,
  2: Pipeline pipeline,
  3: optional list<TagOrAnnotation> annotations,
}

struct Pipeline {
  1: list<PipeStage> stages,
}

struct Reference {
  1: string name,
  2: optional list<ParameterValue> parameters,
}

struct ParameterValue {
  1: string name,
  2: LiteralValue value,
}

union LiteralValue {
  1: StringLiteral string_literal,
  2: NumberLiteral number_literal,
  3: DateLiteral date_literal,
  4: TimestampLiteral timestamp_literal,
  5: BooleanLiteral boolean_literal,
  6: NullLiteral null_literal,
}

struct StringLiteral {
  1: string string_value,
}

struct NumberLiteral {
  1: double number_value,
}

struct BooleanLiteral {
  1: bool boolean_value,
}

struct DateLiteral {
  1: string date_value,
}

struct TimestampLiteral {
  1: string timestamp_value,
}

struct NullLiteral {
}

union Expression {
  1: Reference reference,
  2: TimeTruncationFieldReference time_truncation,
  3: FilteredField filtered_field,
}

struct TimeTruncationFieldReference {
  1: Reference reference, // TODO do I make this circular, more like actual grammar? e.g. TimeTruncation rather than TimeTruncationFieldReference
  2: TimestampTimeframe truncation,
}

struct FilteredField {
  1: Reference reference,
  2: WhereItem filter, // TODO multiple filters?
}

struct StringCell {
  1: string string_value,
}

struct BooleanCell {
  1: bool boolean_value,
}

struct NumberCell {
  1: double number_value,
}

struct TimestampCell {
  1: string timestamp_value, // TODO another way to represent dates?
}

struct DateCell {
  1: string date_value, // TODO another way to represent dates?
}

struct JSONCell {
  1: string json_value,
}

struct ArrayCell {
  1: list<Cell> array_value,
}

// A record is also just a list of values, because we don't need to store the names in the data
struct RecordCell {
  1: list<Cell> record_value,
}

struct TableCell {
  1: Table table_value,
}

union Cell {
  1: StringCell string_cell,
  2: BooleanCell boolean_cell,
  3: DateCell date_cell,
  4: TimestampCell timestamp_cell, // TODO does this need to be separate?
  5: NumberCell number_cell,
  6: JSONCell json_cell, // TODO does this need to be here?
  7: RecordCell record_cell,
  8: ArrayCell array_cell,
  9: TableCell table_cell, // TODO does this need to be different from an array of records
  // TODO sql_native???
}

struct Row {
  1: list<Cell> cells,
}

struct Table {
  1: list<Row> rows,
}

union Data {
  1: RecordCell record,
  2: Table table,
}

// should this be one type "Result" with optional data/sql, or three different types?
struct Result {
  1: optional Data data,
  2: Schema schema,
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
