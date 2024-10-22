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

// clang-format off

/**
 * Field computations are compiled into an expression tree of "Expr"
 * type nodes. Each node is one of these three interfaces. The
 * final type "Expr" is a union type of all known nodes, so
 * that you can use "if (expr.node === 'nodeType')" instead of
 * having to write discriminator functions for every node type.
 */
export interface ExprLeaf {
  node: string;
  typeDef?: AtomicTypeDef;
  sql?: string;
}
export interface ExprE extends ExprLeaf {
  e: Expr;
}
export interface ExprOptionalE extends ExprLeaf {
  e?: Expr;
}

export interface ExprWithKids extends ExprLeaf {
  kids: Record<string, Expr | Expr[]>;
}
export type AnyExpr = ExprE | ExprOptionalE | ExprWithKids | ExprLeaf;

export function exprHasKids(e: AnyExpr): e is ExprWithKids {
  return 'kids' in e;
}
export function exprHasE(e: AnyExpr): e is ExprE {
  return 'e' in e;
}
export function exprIsLeaf(e: AnyExpr) {
  return !(exprHasKids(e) || exprHasE(e));
}

export type Expr =
  | BinaryExpr
  | UnaryExpr
  | FunctionCallNode
  | OutputFieldNode
  | FilterCondition
  | FilteredExpr
  | AggregateExpr
  | EmptyExpr
  | UngroupNode
  | FunctionParameterNode
  | SpreadExpr
  | AggregateOrderByNode
  | AggregateLimitNode
  | FieldnameNode
  | SourceReferenceNode
  | ParameterNode
  | NowNode
  | MeasureTimeExpr
  | TimeExtractExpr
  | TimeDeltaExpr
  | TimeTruncExpr
  | TimeLiteralNode
  | TypecastExpr
  | RegexMatchExpr
  | RegexLiteralNode
  | StringLiteralNode
  | NumberLiteralNode
  | BooleanLiteralNode
  | RecordLiteralNode
  | ArrayLiteralNode
  | FunctionOrderBy
  | GenericSQLExpr
  | NullNode
  | CaseExpr
  | InCompareExpr
  | ErrorNode;

interface HasTypeDef {
  typeDef: AtomicTypeDef;
}
export type TypedExpr = Expr & HasTypeDef;

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '%'
  | '/'
  | 'and'
  | 'or'
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'coalesce'
  | 'like'
  | '!like';
export interface BinaryExpr extends ExprWithKids {
  node: BinaryOperator;
  kids: {left: Expr; right: Expr};
}

export type UnaryOperator = '()' | 'not' | 'unary-' | 'is-null' | 'is-not-null';
export interface UnaryExpr extends ExprE {
  node: UnaryOperator;
  e: Expr;
}

export interface FunctionCallNode extends ExprWithKids {
  node: 'function_call';
  name: string;
  overload: FunctionOverloadDef;
  expressionType: ExpressionType;
  kids: {args: Expr[]; orderBy?: FunctionOrderBy[]};
  limit?: number;
  // List of non-dotted output field references
  partitionBy?: string[];
  structPath?: string[];
}

export interface OutputFieldNode extends ExprLeaf {
  node: 'outputField';
  name: string;
}

export interface FilterCondition extends ExprE {
  node: 'filterCondition';
  code: string;
  expressionType: ExpressionType;
}

export interface FilteredExpr extends ExprWithKids {
  node: 'filteredExpr';
  kids: {e: Expr; filterList: FilterCondition[]};
}

export type AggregateFunctionType =
  | 'sum'
  | 'avg'
  | 'count'
  | 'distinct'
  | 'max'
  | 'min';

export interface AggregateExpr extends ExprE {
  node: 'aggregate';
  function: AggregateFunctionType;
  structPath?: string[];
}
export function isAsymmetricExpr(f: Expr): f is AggregateExpr {
  return (
    f.node === 'aggregate' &&
    ['sum', 'avg', 'count', 'distinct'].includes(f.function)
  );
}

export interface EmptyExpr extends ExprLeaf {
  node: '';
}

export interface UngroupNode extends ExprE {
  node: 'all' | 'exclude';
  fields?: string[];
}

export interface FunctionParameterNode extends ExprLeaf {
  node: 'function_parameter';
  name: string;
}

export interface AggregateOrderByNode extends ExprLeaf {
  node: 'aggregate_order_by';
  prefix?: string;
  suffix?: string;
}

export interface AggregateLimitNode extends ExprLeaf {
  node: 'aggregate_limit';
}

export interface SpreadExpr extends ExprE {
  node: 'spread';
  prefix: string | undefined;
  suffix: string | undefined;
}

export interface FieldnameNode extends ExprLeaf {
  node: 'field';
  path: string[];
}

export interface SourceReferenceNode extends ExprLeaf {
  node: 'source-reference';
  path?: string[];
}

export interface ParameterNode extends ExprLeaf {
  node: 'parameter';
  path: string[];
}

export interface NowNode extends ExprLeaf {
  node: 'now';
}

interface HasTimeValue {
  typeDef: TemporalTypeDef;
}
type TimeExpr = Expr & HasTimeValue;
/**
 * Return true if this node can be turned into a temporal node by simply
 * appending a time type to the typedef. The type systsem makes this hard
 * because while it is theoretically possible to pass an array typed Expr,
 * the reality is that type checking will stop this from ever happening.
 *
 * The list here is the list of Expr types which have a fixed typeDef,
 * which are not of time type.
 *
 * If !canMakeTemporal then mkTemporal is going to return something
 * which will probably error at SQL generation time, so don't do that.
 */
function canMakeTemporal(
  e: Expr
): e is Exclude<Expr, ArrayLiteralNode | RecordLiteralNode> {
  return e.node !== 'arrayLiteral' && e.node !== 'recordLiteral';
}
export function mkTemporal(
  e: Expr,
  timeType: TemporalTypeDef | TemporalFieldType
): TimeExpr {
  const ttd = typeof timeType === 'string' ? {type: timeType} : timeType;
  if (canMakeTemporal(e)) {
    return {...e, typeDef: {...ttd}};
  }
  return e as TimeExpr;
}

export interface MeasureTimeExpr extends ExprWithKids {
  node: 'timeDiff';
  units: TimestampUnit;
  kids: {left: TimeExpr; right: TimeExpr};
}

export interface TimeDeltaExpr extends ExprWithKids {
  node: 'delta';
  kids: {base: TimeExpr; delta: Expr};
  op: '+' | '-';
  units: TimestampUnit;
}

export interface TimeTruncExpr extends ExprE {
  node: 'trunc';
  e: TimeExpr;
  units: TimestampUnit;
}

export interface TimeExtractExpr extends ExprE {
  node: 'extract';
  e: TimeExpr;
  units: ExtractUnit;
}

export interface MalloyTypecastExpr extends ExprE {
  node: 'cast';
  safe: boolean;
  e: Expr;
  dstType: LeafAtomicTypeDef;
  srcType?: LeafAtomicTypeDef;
}

interface RawTypeCastExpr extends ExprE {
  node: 'cast';
  safe: boolean;
  e: Expr;
  dstSQLType: string;
  srcType?: LeafAtomicTypeDef;
}
export type TypecastExpr = MalloyTypecastExpr | RawTypeCastExpr;
export function isRawCast(te: TypecastExpr): te is RawTypeCastExpr {
  return 'dstSQLType' in te;
}

export interface RegexMatchExpr extends ExprWithKids {
  node: 'regexpMatch';
  kids: {expr: Expr; regex: Expr};
}

export interface TimeLiteralNode extends ExprLeaf {
  node: 'timeLiteral';
  literal: string;
  typeDef: TemporalTypeDef;
  timezone?: string;
}

export interface StringLiteralNode extends ExprLeaf {
  node: 'stringLiteral';
  literal: string;
}

export interface RegexLiteralNode extends ExprLeaf {
  node: 'regexpLiteral';
  literal: string;
}

export interface NumberLiteralNode extends ExprLeaf {
  node: 'numberLiteral';
  literal: string;
}

export interface BooleanLiteralNode extends ExprLeaf {
  node: 'true' | 'false';
}

export interface RecordLiteralNode extends ExprWithKids {
  node: 'recordLiteral';
  kids: Record<string, TypedExpr>;
}

export interface ArrayLiteralNode extends ExprWithKids {
  node: 'arrayLiteral';
  kids: {values: Expr[]};
  typeDef: ArrayTypeDef;
}

export interface ErrorNode extends ExprLeaf {
  node: 'error';
  message?: string;
}

export interface GenericSQLExpr extends ExprWithKids {
  node: 'genericSQLExpr';
  kids: {args: Expr[]};
  src: string[];
}

export interface NullNode extends ExprLeaf {
  node: 'null';
}

export interface CaseExpr extends ExprWithKids {
  node: 'case';
  kids: {
    caseValue?: Expr;
    caseWhen: Expr[];
    caseThen: Expr[];
    caseElse?: Expr;
  };
}

export interface InCompareExpr extends ExprWithKids {
  node: 'in';
  not: boolean;
  kids: {e: Expr; oneOf: Expr[]};
}

export type ExpressionType =
  | 'scalar'
  | 'aggregate'
  | 'scalar_analytic'
  | 'aggregate_analytic'
  | 'ungrouped_aggregate';

export interface Expression {
  e?: Expr;
  expressionType?: ExpressionType;
  code?: string;
}

type ConstantExpr = Expr;

export interface Parameter {
  value: ConstantExpr | null;
  name: string;
  type: AtomicFieldType;
}
export type Argument = Parameter;

export function paramHasValue(p: Parameter): boolean {
  return p.value !== null;
}

export interface DocumentRange {
  start: DocumentPosition;
  end: DocumentPosition;
}

export interface DocumentPosition {
  line: number;
  character: number;
}

export interface ImportLocation {
  importURL: string;
  location: DocumentLocation;
}

export interface DocumentLocation {
  url: string;
  range: DocumentRange;
}

interface DocumentReferenceBase {
  text: string;
  location: DocumentLocation;
  definition: HasLocation;
}

export interface DocumentExploreReference extends DocumentReferenceBase {
  type: 'exploreReference';
  definition: StructDef;
}

export interface DocumentJoinReference extends DocumentReferenceBase {
  type: 'joinReference';
  definition: FieldDef;
}

export interface DocumentSQLBlockReference extends DocumentReferenceBase {
  type: 'sqlBlockReference';
  definition: SQLSourceDef;
}

export interface DocumentQueryReference extends DocumentReferenceBase {
  type: 'queryReference';
  definition: Query;
}

export interface DocumentFieldReference extends DocumentReferenceBase {
  type: 'fieldReference';
  definition: FieldDef;
}

export type DocumentReference =
  | DocumentExploreReference
  | DocumentQueryReference
  | DocumentSQLBlockReference
  | DocumentFieldReference
  | DocumentJoinReference;

/** put location into the parse tree. */
export interface HasLocation {
  location?: DocumentLocation;
}

/** All names have their source names and how they will appear in the symbol table that owns them */
export interface AliasedName {
  name: string;
  as?: string;
}

/** all named objects have a type an a name (optionally aliased) */
export interface NamedObject extends AliasedName, HasLocation {
  type: string;
}

// result metadata for a field
export interface ResultMetadataDef {
  sourceField: string;
  sourceExpression?: string;
  sourceClasses: string[];
  filterList?: FilterCondition[];
  fieldKind: 'measure' | 'dimension' | 'struct';
  referenceId?: string;
}

// struct specific metadta
export interface ResultStructMetadataDef extends ResultMetadataDef {
  limit?: number;
  orderBy?: OrderBy[];
}

export interface ResultMetadata {
  resultMetadata?: ResultMetadataDef;
}

export interface ResultStructMetadata {
  resultMetadata?: ResultStructMetadataDef;
}

export function expressionIsScalar(e: ExpressionType | undefined): boolean {
  return e === undefined || e === 'scalar';
}

export function expressionIsAggregate(e: ExpressionType | undefined): boolean {
  return e === 'aggregate' || e === 'ungrouped_aggregate';
}

export function expressionIsUngroupedAggregate(
  e: ExpressionType | undefined
): boolean {
  return e === 'ungrouped_aggregate';
}

export function expressionInvolvesAggregate(
  e: ExpressionType | undefined
): boolean {
  return (
    e === 'aggregate' ||
    e === 'ungrouped_aggregate' ||
    e === 'aggregate_analytic'
  );
}

export function expressionIsCalculation(
  e: ExpressionType | undefined
): boolean {
  return (
    e === 'aggregate' ||
    e === 'scalar_analytic' ||
    e === 'aggregate_analytic' ||
    e === 'ungrouped_aggregate'
  );
}

export function expressionIsAnalytic(e: ExpressionType | undefined): boolean {
  return e === 'aggregate_analytic' || e === 'scalar_analytic';
}

function expressionTypeLevel(e: ExpressionType): number {
  return {
    scalar: 0,
    aggregate: 1,
    ungrouped_aggregate: 2,
    scalar_analytic: 2,
    aggregate_analytic: 3,
  }[e];
}

export function isExpressionTypeLEQ(
  e1: ExpressionType,
  e2: ExpressionType
): boolean {
  return e1 === e2 || expressionTypeLevel(e1) < expressionTypeLevel(e2);
}

// TODO rename this to be like `combineExpressionTypes`
export function maxExpressionType(
  e1: ExpressionType,
  e2: ExpressionType
): ExpressionType {
  // TODO handle the case where e1 is analytic and e2 is ungrouped_aggregate
  let ret: ExpressionType = 'scalar';
  if (e1 === 'aggregate' || e2 === 'aggregate') {
    ret = 'aggregate';
  }
  if (e1 === 'ungrouped_aggregate' || e2 === 'ungrouped_aggregate') {
    ret = 'ungrouped_aggregate';
  }
  if (e1 === 'scalar_analytic' || e2 === 'scalar_analytic') {
    ret = 'scalar_analytic';
  }
  if (e1 === 'aggregate_analytic' || e2 === 'aggregate_analytic') {
    ret = 'aggregate_analytic';
  }
  if (e1 === 'scalar_analytic' && e2 === 'aggregate') {
    ret = 'aggregate_analytic';
  } else if (e1 === 'aggregate' && e2 === 'scalar_analytic') {
    ret = 'aggregate_analytic';
  }
  return ret;
}

export function maxOfExpressionTypes(types: ExpressionType[]): ExpressionType {
  return types.reduce(maxExpressionType, 'scalar');
}

/**  Grants access to the expression properties of a FieldDef */
export function hasExpression<T extends FieldDef>(
  f: T
): f is T & Expression & {e: Expr} {
  return 'e' in f;
}

export type TemporalFieldType = 'date' | 'timestamp';
export function isTemporalField(s: string): s is TemporalFieldType {
  return s === 'date' || s === 'timestamp';
}
export type CastType =
  | 'string'
  | 'number'
  | TemporalFieldType
  | 'boolean'
  | 'json';
export type AtomicFieldType =
  | CastType
  | 'sql native'
  | 'record'
  | 'array'
  | 'error';
export function isAtomicFieldType(s: string): s is AtomicFieldType {
  return [
    'string',
    'number',
    'date',
    'timestamp',
    'boolean',
    'json',
    'sql native',
    'record',
    'array',
    'error',
  ].includes(s);
}
export function isCastType(s: string): s is CastType {
  return ['string', 'number', 'date', 'timestamp', 'boolean', 'json'].includes(
    s
  );
}

/**
 * Fields which contain scalar data all inherit from this. The field
 * value could be an expression, and this is one of the objects
 * which might have an annotation.
 */

export interface FieldBase extends NamedObject, Expression, ResultMetadata {
  annotation?: Annotation;
}

interface FieldAtomicBase extends FieldBase {
  type: AtomicFieldType;
}

// this field definition represents something in the database.
export function fieldIsIntrinsic(f: FieldDef): boolean {
  return isAtomicFieldType(f.type) && !hasExpression(f);
}

export interface StringTypeDef {
  type: 'string';
  bucketFilter?: string;
  bucketOther?: string;
}
export type StringFieldDef = StringTypeDef & AtomicFieldDef;

export interface NumberTypeDef {
  type: 'number';
  numberType?: 'integer' | 'float';
}
export type NumberFieldDef = NumberTypeDef & AtomicFieldDef;

export interface BooleanTypeDef {
  type: 'boolean';
}
export type BooleanFieldDef = BooleanTypeDef & AtomicFieldDef;

export interface JSONTypeDef {
  type: 'json';
}
export type JSONFieldDef = JSONTypeDef & AtomicFieldDef;

export interface NativeUnsupportedTypeDef {
  type: 'sql native';
  rawType?: string;
}
export type NativeUnsupportedFieldDef = NativeUnsupportedTypeDef &
  AtomicFieldDef;

export interface ArrayTypeDef extends JoinBase, StructDefBase {
  type: 'array';
  elementTypeDef: Exclude<AtomicTypeDef, RecordTypeDef> | RecordElementTypeDef;
  join: 'many';
}
export type ArrayDef = ArrayTypeDef & AtomicFieldDef;

export function arrayEachFields(arrayOf: AtomicTypeDef): AtomicFieldDef[] {
  return [
    {name: 'each', ...arrayOf, e: {node: 'field', path: ['value']}},
    {name: 'value', ...arrayOf},
  ];
}

export interface RecordTypeDef extends StructDefBase, JoinBase {
  type: 'record';
  join: 'one';
}

// While repeated records are mostly treated like arrays of records,
// for historical reasons in the IR, a field which is a repeated record
// and a field which is record both have the record schema in "fields"
//
// This is signified by the datatype of a array of records being
//  {elementType: record_element, fields: [schema]}
//     instead of
//  {elementType: record{record schema}}
//
// This made it easier to re-factor structdef, however this might make
// actual record types more difficult, so this might get re-visited
// when record types are finalized.

export interface RecordElementTypeDef {
  type: 'record_element';
}

export interface RepeatedRecordTypeDef extends ArrayDef {
  type: 'array';
  elementTypeDef: RecordElementTypeDef;
  join: 'many';
}

export type RecordFieldDef = RecordTypeDef & AtomicFieldDef;
export type RepeatedRecordFieldDef = RepeatedRecordTypeDef & AtomicFieldDef;

export function isRepeatedRecord(fd: FieldDef): fd is RepeatedRecordFieldDef {
  return fd.type === 'array' && fd.elementTypeDef.type === 'record_element';
}

export interface ErrorTypeDef {
  type: 'error';
}
export type ErrorFieldDef = ErrorTypeDef & AtomicFieldDef;

export type JoinType = 'one' | 'many' | 'cross';
export type JoinRelationship =
  | 'one_to_one'
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many';

export type MatrixOperation = 'left' | 'right' | 'full' | 'inner';

export function isMatrixOperation(x: string): x is MatrixOperation {
  return ['left', 'right', 'full', 'inner'].includes(x);
}

export type JoinElementType =
  | 'table'
  | 'sql_select'
  | 'query_source'
  | 'array'
  | 'record';

export interface JoinBase {
  type: JoinElementType;
  join: JoinType;
  matrixOperation?: MatrixOperation;
  onExpression?: Expr;
}

export type Joinable =
  | TableSourceDef
  | SQLSourceDef
  | QuerySourceDef
  | RecordFieldDef
  | ArrayDef;
export type JoinFieldDef = JoinBase & Joinable;
export type JoinFieldTypes =
  | 'table'
  | 'sql_select'
  | 'query_source'
  | 'array'
  | 'record';

export function isJoinable(sd: StructDef): sd is Joinable {
  return ['table', 'sql_select', 'query_source', 'array', 'record'].includes(
    sd.type
  );
}

export function isJoined<T extends FieldDef | StructDef>(
  fd: T
): fd is T & Joinable & JoinBase {
  return 'join' in fd;
}

export function isJoinedSource(sd: StructDef): sd is SourceDef & JoinBase {
  return isSourceDef(sd) && isJoined(sd);
}

export type DateUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export function isDateUnit(str: string): str is DateUnit {
  return ['day', 'week', 'month', 'quarter', 'year'].includes(str);
}
export type TimestampUnit = DateUnit | 'hour' | 'minute' | 'second';
export function isTimestampUnit(s: string): s is TimestampUnit {
  return isDateUnit(s) || ['hour', 'minute', 'second'].includes(s);
}
export type ExtractUnit = TimestampUnit | 'day_of_week' | 'day_of_year';
export function isExtractUnit(s: string): s is ExtractUnit {
  return isTimestampUnit(s) || s === 'day_of_week' || s === 'day_of_year';
}
/** Value types distinguished by their usage in generated SQL, particularly with respect to filters. */
export enum ValueType {
  Date = 'date',
  Timestamp = 'timestamp',
  Number = 'number',
  String = 'string',
}

export type TimeValueType = ValueType.Date | ValueType.Timestamp;

export interface DateTypeDef {
  type: 'date';
  timeframe?: DateUnit;
}
export type DateFieldDef = DateTypeDef & AtomicFieldDef;

export interface TimestampTypeDef {
  type: 'timestamp';
  timeframe?: TimestampUnit;
}
export type TimestampFieldDef = TimestampTypeDef & AtomicFieldDef;

/** parameter to order a query */
export interface OrderBy {
  field: string | number;
  dir?: 'asc' | 'desc';
}

export interface FunctionOrderByExpression extends ExprE {
  node: 'functionOrderBy';
  dir?: 'asc' | 'desc';
}

export interface FunctionOrderByDefaultExpression extends ExprLeaf {
  node: 'functionDefaultOrderBy';
  dir: 'asc' | 'desc';
}

export type FunctionOrderBy =
  | FunctionOrderByExpression
  | FunctionOrderByDefaultExpression;

export interface ByName {
  by: 'name';
  name: string;
}
export interface ByExpression {
  by: 'expression';
  e: Expr;
}
export type By = ByName | ByExpression;

export function isByName(by: By | undefined): by is ByName {
  if (by === undefined) {
    return false;
  }
  return by.by === 'name';
}

export function isByExpression(by: By | undefined): by is ByExpression {
  if (by === undefined) {
    return false;
  }
  return by.by === 'name';
}

/** reference to a data source */
export type StructRef = string | SourceDef;
export function refIsStructDef(ref: StructRef): ref is SourceDef {
  return typeof ref !== 'string';
}

export type InvokedStructRef = {
  structRef: StructRef;
  sourceArguments?: Record<string, Argument>;
};

export interface Filtered {
  filterList?: FilterCondition[];
}

/**
 * First element in a pipeline might be a reference to a turtle
 */
export interface TurtleSegment extends Filtered {
  name: string;
}
export interface Pipeline {
  pipeline: PipeSegment[];
}

export interface Query extends Pipeline, Filtered, HasLocation {
  type?: 'query';
  name?: string;
  structRef: StructRef;
  sourceArguments?: Record<string, Argument>;
  annotation?: Annotation;
  modelAnnotation?: Annotation;
}

export type NamedQuery = Query & NamedObject;

export type PipeSegment = QuerySegment | IndexSegment | RawSegment;

export function segmentHasErrors(segment: PipeSegment): boolean {
  if (
    segment.type === 'reduce' ||
    segment.type === 'project' ||
    segment.type === 'partial'
  ) {
    if (segment.extendSource) {
      if (segment.extendSource.some(f => f.type === 'error')) {
        return true;
      }
    }
    if (segment.queryFields.some(f => f.type === 'error')) {
      return true;
    }
  }
  return false;
}

export function structHasErrors(struct: StructDef): boolean {
  return struct.fields.some(f => f.type === 'error');
}

export interface ReduceSegment extends QuerySegment {
  type: 'reduce';
}
export function isReduceSegment(pe: PipeSegment): pe is ReduceSegment {
  return pe.type === 'reduce';
}

export interface PartialSegment extends QuerySegment {
  type: 'partial';
}
export function isPartialSegment(pe: PipeSegment): pe is PartialSegment {
  return pe.type === 'partial';
}

export interface ProjectSegment extends QuerySegment {
  type: 'project';
}
export function isProjectSegment(pe: PipeSegment): pe is ProjectSegment {
  return pe.type === 'project';
}

export function isQuerySegment(pe: PipeSegment): pe is QuerySegment {
  return isProjectSegment(pe) || isReduceSegment(pe);
}

export type Sampling = SamplingRows | SamplingEnable | SamplingPercent;

interface SamplingRows {
  rows: number;
}

export function isSamplingRows(s: Sampling): s is SamplingRows {
  return (s as SamplingRows).rows !== undefined;
}

interface SamplingPercent {
  percent: number;
}

export function isSamplingPercent(s: Sampling): s is SamplingPercent {
  return (s as SamplingPercent).percent !== undefined;
}

interface SamplingEnable {
  enable: boolean;
}

export function isSamplingEnable(s: Sampling): s is SamplingEnable {
  return (s as SamplingEnable).enable !== undefined;
}

export interface RawSegment extends Filtered {
  type: 'raw';
  fields: never[];
}
export function isRawSegment(pe: PipeSegment): pe is RawSegment {
  return (pe as RawSegment).type === 'raw';
}

export type IndexFieldDef = RefToField;
export type SegmentFieldDef = IndexFieldDef | QueryFieldDef;

export interface IndexSegment extends Filtered {
  type: 'index';
  indexFields: IndexFieldDef[];
  limit?: number;
  weightMeasure?: string; // only allow the name of the field to use for weights
  sample?: Sampling;
  alwaysJoins?: string[];
}
export function isIndexSegment(pe: PipeSegment): pe is IndexSegment {
  return (pe as IndexSegment).type === 'index';
}

export interface QuerySegment extends Filtered {
  type: 'reduce' | 'project' | 'partial';
  queryFields: QueryFieldDef[];
  extendSource?: FieldDef[];
  limit?: number;
  by?: By;
  orderBy?: OrderBy[]; // uses output field name or index.
  queryTimezone?: string;
  alwaysJoins?: string[];
}

export interface TurtleDef extends NamedObject, Pipeline {
  type: 'turtle';
  annotation?: Annotation;
}

interface StructDefBase extends HasLocation, NamedObject {
  type: string;
  annotation?: Annotation;
  modelAnnotation?: ModelAnnotation;
  fields: FieldDef[];
  dialect: string;
}

interface SourceDefBase extends StructDefBase, Filtered, ResultStructMetadata {
  arguments?: Record<string, Argument>;
  parameters?: Record<string, Parameter>;
  queryTimezone?: string;
  connection: string;
  primaryKey?: PrimaryKeyRef;
}
/** which field is the primary key in this struct */
export type PrimaryKeyRef = string;

export interface TableSourceDef extends SourceDefBase {
  type: 'table';
  tablePath: string;
}

/*
 * Malloy has a kind of "strings" which is a list of segments. Each segment
 * is either a string, or a query, which is meant to be replaced
 * by the text of the query when the query is compiled to SQL.
 *
 * The data types for this are:
 *  SQLPhrase -- A phrase, used to make a sentence
 *  SQLSentence -- Used to request a schema from the connection
 *  SQLSelectSource -- Returned from a query, contains the scehma
 */
export interface SQLStringSegment {
  sql: string;
}
export type SQLPhraseSegment = Query | SQLStringSegment;
export function isSegmentSQL(f: SQLPhraseSegment): f is SQLStringSegment {
  return 'sql' in f;
}

export interface SQLSentence {
  name: string;
  connection: string;
  select: SQLPhraseSegment[];
}

export interface SQLSourceDef extends SourceDefBase {
  type: 'sql_select';
  selectStr: string;
}

export interface QuerySourceDef extends SourceDefBase {
  type: 'query_source';
  query: Query;
}

export interface QueryResultDef extends SourceDefBase {
  type: 'query_result';
}

// Describes the schema which flows between pipe elements
export interface NestSourceDef extends SourceDefBase {
  type: 'nest_source';
  pipeSQL: string;
}

// Used by PostGres to un-JSonify at the end of a query
export interface FinalizeSourceDef extends SourceDefBase {
  type: 'finalize';
}

// The gesture {...sourceStruct moreProperties}  happens everywhere, now that
// structs aren't all identical, we need a way to make one from any of the
// exisitng structs

export function sourceBase(sd: SourceDefBase): SourceDefBase {
  return {...sd};
}

export function isSourceDef(sd: NamedModelObject | FieldDef): sd is SourceDef {
  return (
    sd.type === 'table' ||
    sd.type === 'sql_select' ||
    sd.type === 'query_source' ||
    sd.type === 'query_result' ||
    sd.type === 'finalize' ||
    sd.type === 'nest_source'
  );
}

export type SourceDef =
  | TableSourceDef
  | SQLSourceDef
  | QuerySourceDef
  | QueryResultDef
  | FinalizeSourceDef
  | NestSourceDef;

/** Is this the "FROM" table of a query tree */
export function isBaseTable(def: StructDef): def is SourceDef {
  if (isJoined(def)) {
    return false;
  }
  if (isSourceDef(def)) {
    return true;
  }
  return false;
}

export function isScalarArray(def: FieldDef | StructDef) {
  return def.type === 'array' && def.elementTypeDef.type !== 'record_element';
}

export type StructDef = SourceDef | RecordFieldDef | ArrayDef;

export type ExpressionValueType =
  | AtomicFieldType
  | 'null'
  | 'duration'
  | 'any'
  | 'regular expression';

export type FieldValueType = ExpressionValueType | 'turtle' | JoinFieldTypes;

export interface ExpressionTypeDesc {
  dataType: FieldValueType;
  expressionType: ExpressionType;
  rawType?: string;
  evalSpace: EvalSpace;
}

export interface FunctionParamTypeDesc {
  dataType: FieldValueType;
  expressionType: ExpressionType | undefined;
  evalSpace: EvalSpace;
}

export type EvalSpace = 'constant' | 'input' | 'output' | 'literal';

export function isLiteral(evalSpace: EvalSpace) {
  return evalSpace === 'literal';
}

export function mergeEvalSpaces(...evalSpaces: EvalSpace[]): EvalSpace {
  if (evalSpaces.every(e => e === 'constant' || e === 'literal')) {
    return 'constant';
  } else if (
    evalSpaces.every(e => e === 'output' || e === 'constant' || e === 'literal')
  ) {
    return 'output';
  }
  return 'input';
}

export interface TypeDesc {
  dataType: FieldValueType;
  expressionType: ExpressionType;
  rawType?: string;
  evalSpace: EvalSpace;
}

export interface FunctionParameterDef {
  name: string;
  // These expression types are MAXIMUM types -- e.g. if you specify "scalar",
  // you cannot pass in an "aggregate" and if you specify "aggregate", you can
  // pass in "scalar" or "aggregate", but not "analytic"
  allowedTypes: FunctionParamTypeDesc[];
  isVariadic: boolean;
}

export interface FunctionOverloadDef {
  // The expression type here is the MINIMUM return type
  returnType: TypeDesc;
  isSymmetric?: boolean;
  params: FunctionParameterDef[];
  supportsOrderBy?: boolean | 'only_default';
  supportsLimit?: boolean;
  dialect: {
    [dialect: string]: {
      e: Expr;
      between?: {preceding: number | string; following: number | string};
      defaultOrderByArgIndex?: number;
      needsWindowOrderBy?: boolean;
    };
  };
}

export interface FunctionDef extends NamedObject {
  type: 'function';
  overloads: FunctionOverloadDef[];
}

export interface ConnectionDef extends NamedObject {
  type: 'connection';
}

export type TemporalTypeDef = DateTypeDef | TimestampTypeDef;
export type LeafAtomicTypeDef =
  | StringTypeDef
  | TemporalTypeDef
  | NumberTypeDef
  | BooleanTypeDef
  | JSONTypeDef
  | NativeUnsupportedTypeDef
  | ErrorTypeDef;
export type AtomicTypeDef = LeafAtomicTypeDef | ArrayTypeDef | RecordTypeDef;

export type LeafAtomicDef = LeafAtomicTypeDef & FieldAtomicBase;
export type AtomicFieldDef = AtomicTypeDef & FieldAtomicBase;

export function isLeafAtomic(
  fd: FieldDef | QueryFieldDef | AtomicTypeDef
): fd is LeafAtomicDef {
  return (
    fd.type === 'string' ||
    isTemporalField(fd.type) ||
    fd.type === 'number' ||
    fd.type === 'boolean' ||
    fd.type === 'json' ||
    fd.type === 'sql native' ||
    fd.type === 'error'
  );
}

// Sources have fields like this ...
export type FieldDef = AtomicFieldDef | JoinFieldDef | TurtleDef;

// Queries have fields like this ..

export interface RefToField {
  type: 'fieldref';
  path: string[];
  annotation?: Annotation;
}
export type QueryFieldDef = AtomicFieldDef | TurtleDef | RefToField;

/** Get the output name for a NamedObject */
export function getIdentifier(n: AliasedName): string {
  if (n.as !== undefined) {
    return n.as;
  }
  return n.name;
}

export type NamedModelObject =
  | StructDef
  | NamedQuery
  | FunctionDef
  | ConnectionDef;

/** Result of parsing a model file */
export interface ModelDef {
  name: string;
  exports: string[];
  contents: Record<string, NamedModelObject>;
  annotation?: ModelAnnotation;
}

/** Very common record type */
export type NamedSourceDefs = Record<string, SourceDef>;
export type NamedModelObjects = Record<string, NamedModelObject>;

/** Malloy source annotations attached to objects */
export interface Annotation {
  inherits?: Annotation;
  blockNotes?: Note[];
  notes?: Note[];
}
export interface Note {
  text: string;
  at: DocumentLocation;
}
/** Annotations with a uuid to make it easier to stream */
export interface ModelAnnotation extends Annotation {
  id: string;
}

export type QueryScalar = string | boolean | number | Date | Buffer | null;

/** One value in one column of returned data. */
export type QueryValue = QueryScalar | QueryData | QueryDataRow;

/** A row of returned data. */
export type QueryDataRow = {[columnName: string]: QueryValue};

/** Returned query data. */
export type QueryData = QueryDataRow[];

/** Query execution stats. */
export type QueryRunStats = {
  queryCostBytes?: number;
};

/** Returned Malloy query data */
export type MalloyQueryData = {
  rows: QueryDataRow[];
  totalRows: number;
  runStats?: QueryRunStats;
  profilingUrl?: string;
};

export interface DrillSource {
  sourceExplore: string;
  sourceFilters?: FilterCondition[];
}

export type QueryToMaterialize = {
  id: string;
  path: string;
  source: string | undefined;
  queryName: string;
};

export interface CompiledQuery extends DrillSource {
  structs: SourceDef[];
  sql: string;
  lastStageName: string;
  malloy: string;
  queryName?: string | undefined;
  connectionName: string;
  queryTimezone?: string;
  annotation?: Annotation;
  // Map of query unique id to the SQL.
  dependenciesToMaterialize?: Record<string, QueryToMaterialize>;
  materialization?: QueryToMaterialize;
}

/** Result type for running a Malloy query. */
export interface QueryResult extends CompiledQuery {
  result: QueryData;
  totalRows: number;
  error?: string;
  runStats?: QueryRunStats;
  profilingUrl?: string;
}

export function isTurtleDef(def: FieldDef): def is TurtleDef {
  return def.type === 'turtle';
}

export function isAtomic(def: FieldDef): def is AtomicFieldDef {
  return isAtomicFieldType(def.type);
}

export interface SearchResultRow {
  field_name: string; // eslint-disable-line camelcase
  field_value: string; // eslint-disable-line camelcase
  weight: number;
}

export type SearchResult = SearchResultRow[];

export function getAtomicFields(structDef: StructDef): AtomicFieldDef[] {
  return structDef.fields.filter(isAtomic);
}

export function isValueString(
  value: QueryValue,
  field: FieldDef
): value is string | null {
  return field.type === 'string';
}

export function isValueNumber(
  value: QueryValue,
  field: FieldDef
): value is number | null {
  return field.type === 'number';
}

export function isValueBoolean(
  value: QueryValue,
  field: FieldDef
): value is boolean | null {
  return field.type === 'boolean';
}

export function isValueTimestamp(
  value: QueryValue,
  field: FieldDef
): value is {value: string} | null {
  return field.type === 'timestamp';
}

export function isValueDate(
  value: QueryValue,
  field: FieldDef
): value is {value: string} | null {
  return field.type === 'date';
}

export interface SearchIndexResult {
  fieldName: string;
  fieldValue: string;
  fieldType: string;
  weight: number;
}

export interface SearchValueMapResult {
  fieldName: string;
  cardinality: number;
  values: {fieldValue: string; weight: number}[];
}

export interface PrepareResultOptions {
  replaceMaterializedReferences?: boolean;
  materializedTablePrefix?: string;
}

type UTD = AtomicTypeDef | undefined;
export const TD = {
  isA: (td: UTD, ...tList: string[]) => td && tList.includes(td.type),
  notA: (td: UTD, ...tList: string[]) => td && !tList.includes(td.type),
  isString: (td: UTD): td is StringTypeDef =>
    td !== undefined && td.type === 'string',
  isNumber: (td: UTD): td is NumberTypeDef =>
    td !== undefined && td.type === 'number',
  isBoolean: (td: UTD): td is BooleanTypeDef =>
    td !== undefined && td.type === 'boolean',
  isJSON: (td: UTD): td is JSONTypeDef =>
    td !== undefined && td.type === 'json',
  isSQL: (td: UTD): td is NativeUnsupportedTypeDef =>
    td !== undefined && td.type === 'sql native',
  isDate: (td: UTD): td is DateTypeDef =>
    td !== undefined && td.type === 'date',
  isTimestamp: (td: UTD): td is TimestampTypeDef =>
    td !== undefined && td.type === 'timestamp',
  isError: (td: UTD): td is ErrorTypeDef =>
    td !== undefined && td.type === 'error',
  eq: function (x: UTD, y: UTD): boolean {
    if (x === undefined || y === undefined) {
      return false;
    }
    function checkFields(a: AtomicTypeDef, b: AtomicTypeDef): boolean {
      const aSchema: Record<string, AtomicTypeDef> = {};
      for (const aEnt of a['fields'] || []) {
        if (aEnt.name) {
          aSchema[aEnt.name] = aEnt;
        } else {
          return false;
        }
      }
      for (const bEnt of b['fields'] || []) {
        if (!TD.eq(aSchema[bEnt.name], bEnt)) {
          return false;
        }
      }
      return true;
    }
    if (x.type === 'array' && y.type === 'array') {
      if (x.elementTypeDef.type !== y.elementTypeDef.type) {
        return false;
      }
      if (
        x.elementTypeDef.type !== 'record_element' && // Both are equal, but to make this
        y.elementTypeDef.type !== 'record_element' //    typecheck, we need the && clause.
      ) {
        return TD.eq(x.elementTypeDef, y.elementTypeDef);
      }
      return checkFields(x, y);
    } else if (x.type === 'record' && y.type === 'record') {
      return checkFields(x, y);
    }
    return x.type === y.type;
  },
  timestamp: (): TimestampTypeDef => ({type: 'timestamp'}),
  date: (): DateTypeDef => ({type: 'date'}),
  string: (): StringTypeDef => ({type: 'string'}),
  number: (): NumberTypeDef => ({type: 'number', numberType: 'float'}),
  error: (): ErrorTypeDef => ({type: 'error'}),
};

// clang-format on
