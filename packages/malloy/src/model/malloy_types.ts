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
  dataType?: AtomicFieldType;
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
  | TimeDeltaExpr
  | TimeTruncExpr
  | TimeExtractExpr
  | TypecastExpr
  | RegexMatchExpr
  | RegexLiteralNode
  | TimeLiteralNode
  | StringLiteralNode
  | NumberLiteralNode
  | BooleanLiteralNode
  | FunctionOrderBy
  | GenericSQLExpr
  | NullNode
  | PickExpr
  | ErrorNode;

interface HasDataType {
  dataType: AtomicFieldType;
}
export type TypedExpr = Expr & HasDataType;

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
  dataType: TimeFieldType;
}
type TimeExpr = Expr & HasTimeValue;

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

export interface TypecastExpr extends ExprE {
  node: 'cast';
  safe: boolean;
  e: Expr;
  dstType: CastType | {raw: string};
  srcType?: AtomicFieldType;
}

export interface RegexMatchExpr extends ExprWithKids {
  node: 'regexpMatch';
  kids: {expr: Expr; regex: Expr};
}

export interface TimeLiteralNode extends ExprLeaf {
  node: 'timeLiteral';
  literal: string;
  dataType: TimeFieldType;
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

export interface PickExpr extends ExprWithKids {
  node: 'pick';
  kids: {pickWhen: Expr[]; pickThen: Expr[]; pickElse: Expr};
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
  definition: SQLBlockStructDef;
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

export interface TypedObject {
  type: string;
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

type HasExpression = FieldDef & Expression & {e: Expr};
/**  Grants access to the expression property of a FieldDef */
export function hasExpression(f: FieldDef): f is HasExpression {
  return (f as Expression).e !== undefined;
}

export type TimeFieldType = 'date' | 'timestamp';
export function isTimeFieldType(s: string): s is TimeFieldType {
  return s === 'date' || s === 'timestamp';
}
export type CastType = 'string' | 'number' | TimeFieldType | 'boolean' | 'json';
export type AtomicFieldType = CastType | 'sql native' | 'error';
export function isAtomicFieldType(s: string): s is AtomicFieldType {
  return [
    'string',
    'number',
    'date',
    'timestamp',
    'boolean',
    'json',
    'sql native',
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
export interface FieldAtomicDef
  extends NamedObject,
    Expression,
    ResultMetadata {
  type: AtomicFieldType;
  annotation?: Annotation;
}

// this field definition represents something in the database.
export function FieldIsIntrinsic(f: FieldDef): boolean {
  if (isAtomicFieldType(f.type) && !hasExpression(f)) {
    return true;
  } else if (
    f.type === 'struct' &&
    (f.structSource.type === 'inline' || f.structSource.type === 'nested')
  ) {
    return true;
  } else {
    return false;
  }
}

export interface FieldStringTypeDef {
  type: 'string';
  bucketFilter?: string;
  bucketOther?: string;
}

/** Scalar String Field */
export interface FieldStringDef extends FieldAtomicDef, FieldStringTypeDef {
  type: 'string';
}

export interface FieldNumberTypeDef {
  type: 'number';
  numberType?: 'integer' | 'float';
}

/** Scalar Numeric String Field */
export interface FieldNumberDef extends FieldAtomicDef, FieldNumberTypeDef {
  type: 'number';
}

export interface FieldBooleanTypeDef {
  type: 'boolean';
}

/** Scalar Boolean Field */
export interface FieldBooleanDef extends FieldAtomicDef, FieldBooleanTypeDef {
  type: 'boolean';
}

export interface FieldJSONTypeDef {
  type: 'json';
}

/** Scalar JSON Field */
export interface FieldJSONDef extends FieldAtomicDef, FieldJSONTypeDef {
  type: 'json';
}

export interface FieldNativeUnsupportedTypeDef {
  type: 'sql native';
  rawType?: string;
}

/** Scalar unsupported Field */
export interface FeldNativeUnsupportedDef
  extends FieldAtomicDef,
    FieldNativeUnsupportedTypeDef {
  type: 'sql native';
}

export interface FieldErrorTypeDef {
  type: 'error';
}

export interface FieldErrorDef extends FieldAtomicDef, FieldErrorTypeDef {
  type: 'error';
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

export interface FieldDateTypeDef {
  type: 'date';
  timeframe?: DateUnit;
}

/** Scalar Date Field. */
export interface FieldDateDef extends FieldAtomicDef, FieldDateTypeDef {
  type: 'date';
}

export interface FieldTimestampTypeDef {
  type: 'timestamp';
  timeframe?: TimestampUnit;
}

/** Scalar Timestamp Field */
export interface FieldTimestampDef
  extends FieldAtomicDef,
    FieldTimestampTypeDef {
  type: 'timestamp';
}

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
export type StructRef = string | StructDef;
export function refIsStructDef(ref: StructRef): ref is StructDef {
  return typeof ref !== 'string' && ref.type === 'struct';
}

export type InvokedStructRef = {
  structRef: StructRef;
  sourceArguments?: Record<string, Argument>;
};

/** join pattern structs is a struct. */
export interface JoinedStruct {
  structRef: StructRef;
  structRelationship: StructRelationship;
  as: string;
}

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
}

export interface TurtleDef extends NamedObject, Pipeline {
  type: 'turtle';
  annotation?: Annotation;
}

export type JoinRelationship =
  | 'one_to_one'
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many';

export type MatrixOperation = 'left' | 'right' | 'full' | 'inner';

export function isMatrixOperation(x: string): x is MatrixOperation {
  return ['left', 'right', 'full', 'inner'].includes(x);
}

export interface JoinOn {
  type: 'one' | 'many' | 'cross';
  matrixOperation: MatrixOperation;
  onExpression?: Expr;
}

export function isJoinOn(sr: StructRelationship): sr is JoinOn {
  return ['one', 'many', 'cross'].includes(sr.type);
}
/** types of joins. */
export type StructRelationship =
  | {type: 'basetable'; connectionName: string}
  | JoinOn
  | {type: 'inline'}
  | {type: 'nested'; fieldName: string; isArray: boolean};

export interface SQLStringSegment {
  sql: string;
}
export type SQLPhrase = Query | SQLStringSegment;
export function isSQLFragment(f: SQLPhrase): f is SQLStringSegment {
  return (f as SQLStringSegment).sql !== undefined;
}
/**
 * A source reference to an SQL block. The compiler uses these to request
 * an SQLBlock with it's schema and structdef defined. Use the factory
 * makeSQLBlock to construct these.
 */
export interface SQLBlockSource {
  name: string;
  connection?: string;
  select: SQLPhrase[];
}

export interface SQLBlock extends NamedObject {
  type: 'sqlBlock';
  connection?: string;
  selectStr: string;
}

interface SubquerySource {
  type: 'sql';
  method: 'subquery';
  sqlBlock: SQLBlock;
}

/** where does the struct come from? */
export type StructSource =
  | {type: 'table'; tablePath: string}
  | {type: 'nested'}
  | {type: 'inline'}
  | {type: 'query'; query: Query}
  | {type: 'sql'; method: 'nested' | 'lastStage'}
  | {type: 'query_result'}
  | SubquerySource;

// Inline and nested tables, cannot have a StructRelationship
//  the relationshipo is implied

/** struct that is intrinsic to the table */
export interface StructDef extends NamedObject, ResultStructMetadata, Filtered {
  type: 'struct';
  structSource: StructSource;
  structRelationship: StructRelationship;
  fields: FieldDef[];
  primaryKey?: PrimaryKeyRef;
  // "parameters in" -- values that are usable internally in this source
  arguments?: Record<string, Argument>;
  // "parameters out" -- values that must be passed into this source to use it
  parameters?: Record<string, Parameter>;
  queryTimezone?: string;
  dialect: string;
  annotation?: Annotation;
  modelAnnotation?: ModelAnnotation;
}

export type ExpressionValueType =
  | AtomicFieldType
  | 'null'
  | 'duration'
  | 'any'
  | 'regular expression';

export type FieldValueType = ExpressionValueType | 'turtle' | 'struct';

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

export interface SQLBlockStructDef extends StructDef {
  structSource: SubquerySource;
  // This was added to that errors for structdefs created in sql: but NOT used in
  // from_sql could error properly. This is kind of non-sensical, and once
  // we decide if SQL blocks are StructDefs or Queries or Something Else
  // this should go away.
  declaredSQLBlock?: boolean;
}

export function isSQLBlockStruct(sd: StructDef): sd is SQLBlockStructDef {
  const src = sd.structSource;
  return src.type === 'sql' && src.method === 'subquery';
}

// /** the resulting structure of the query (and it's source) */
// export interface QueryReultStructDef {
//   type: 'result';
//   fields: FieldDef[];
//   primaryKey?: string;
//   queryDef?: QueryDef;
// }

/** any of the different field types */
export type FieldTypeDef =
  | FieldStringDef
  | FieldDateDef
  | FieldTimestampDef
  | FieldNumberDef
  | FieldBooleanDef
  | FieldJSONDef
  | FeldNativeUnsupportedDef
  | FieldErrorDef;

export type FieldAtomicTypeDef =
  | FieldStringTypeDef
  | FieldDateTypeDef
  | FieldTimestampTypeDef
  | FieldNumberTypeDef
  | FieldBooleanTypeDef
  | FieldJSONTypeDef
  | FieldNativeUnsupportedTypeDef
  | FieldErrorTypeDef;

export function isFieldTypeDef(f: FieldDef): f is FieldTypeDef {
  return (
    f.type === 'string' ||
    f.type === 'date' ||
    f.type === 'number' ||
    f.type === 'timestamp' ||
    f.type === 'boolean' ||
    f.type === 'json'
  );
}

export function isFieldTimeBased(
  f: FieldDef
): f is FieldTimestampDef | FieldDateDef {
  return f.type === 'date' || f.type === 'timestamp';
}

export function isFieldStructDef(f: FieldDef): f is StructDef {
  return f.type === 'struct';
}

// Queries

export type QueryFieldDef = FieldTypeDef | TurtleDef | RefToField;

/** basics statement */
export type FieldDef = FieldTypeDef | StructDef | TurtleDef;

/** reference to a field */

export interface RefToField {
  type: 'fieldref';
  path: string[];
  annotation?: Annotation;
}

export type FieldRefOrDef = FieldDef | RefToField;

/** which field is the primary key in this struct */
export type PrimaryKeyRef = string;

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
export type NamedStructDefs = Record<string, StructDef>;
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
  structs: StructDef[];
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

export function isAtomicField(def: FieldDef): def is FieldAtomicDef {
  return isAtomicFieldType(def.type);
}

export interface SearchResultRow {
  field_name: string; // eslint-disable-line camelcase
  field_value: string; // eslint-disable-line camelcase
  weight: number;
}

export type SearchResult = SearchResultRow[];

export function isDimensional(field: FieldDef): boolean {
  if ('resultMetadata' in field) {
    return field.resultMetadata?.fieldKind === 'dimension';
  }
  return false;
}

export function isPhysical(field: FieldDef): boolean {
  return (
    (isFieldTypeDef(field) && field.e === undefined) ||
    (isFieldStructDef(field) &&
      (field.structSource.type === 'nested' ||
        field.structSource.type === 'inline'))
  );
}

export function getDimensions(structDef: StructDef): FieldAtomicDef[] {
  return structDef.fields.filter(isDimensional) as FieldAtomicDef[];
}

export function getPhysicalFields(structDef: StructDef): FieldDef[] {
  return structDef.fields.filter(isPhysical) as FieldDef[];
}

export function isMeasureLike(field: FieldDef): boolean {
  if ('resultMetadata' in field) {
    return (
      field.resultMetadata?.fieldKind === 'measure' ||
      field.resultMetadata?.fieldKind === 'struct'
    );
  }
  return false;
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
}

// clang-format on
