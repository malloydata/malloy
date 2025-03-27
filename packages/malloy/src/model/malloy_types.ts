/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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
  | FilterMatchExpr
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
  | CompositeFieldExpr
  | ErrorNode;

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
  compositeFieldUsage?: CompositeFieldUsage;
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
  typeDef: {type: 'timestamp'};
}

interface HasTimeValue {
  typeDef: TemporalTypeDef;
}
export type TimeExpr = Expr & HasTimeValue;

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
  if (!('typeDef' in e)) {
    const ttd: TemporalTypeDef =
      typeof timeType === 'string' ? {type: timeType} : timeType;
    if (canMakeTemporal(e)) {
      return {...e, typeDef: {...ttd}};
    }
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

export type FilterExprType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'timestamp';
export function isFilterExprType(s: string): s is FilterExprType {
  return ['string', 'number', 'boolean', 'date', 'timestamp'].includes(s);
}

export interface FilterMatchExpr extends ExprE {
  node: 'filterMatch';
  dataType: FilterExprType;
  notMatch?: true;
  filter: {operator: string} | null;
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
  kids: Record<string, Expr>;
  typeDef: RecordTypeDef;
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

export interface CompositeFieldExpr extends ExprLeaf {
  node: 'compositeField';
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
  compositeFieldUsage?: CompositeFieldUsage; // TODO maybe make required?
  expressionType?: ExpressionType;
  code?: string;
}

type ConstantExpr = Expr;

interface ParameterInfo {
  name: string;
  value: ConstantExpr | null;
}
export type Parameter = AtomicTypeDef & ParameterInfo;
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

export interface Ordered {
  orderBy?: OrderBy[];
  defaultOrderBy?: boolean;
}
// struct specific metadta
export interface ResultStructMetadataDef extends ResultMetadataDef, Ordered {
  limit?: number;
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
export interface HasExpression {
  e: Expr;
}
export function hasExpression<T extends FieldDef>(
  f: T
): f is T & Expression & HasExpression {
  return 'e' in f;
}

export type TemporalFieldType = 'date' | 'timestamp';
export function isTemporalType(s: string): s is TemporalFieldType {
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
export function canOrderBy(s: string) {
  return ['string', 'number', 'date', 'boolean', 'date', 'timestamp'].includes(
    s
  );
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
  accessModifier?: NonDefaultAccessModifierLabel | undefined;
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

export interface ScalarArrayTypeDef {
  type: 'array';
  elementTypeDef: Exclude<AtomicTypeDef, RecordTypeDef>;
}
export interface ScalarArrayDef
  extends ScalarArrayTypeDef,
    StructDefBase,
    JoinBase,
    FieldBase {
  type: 'array';
  join: 'many';
}

export function mkFieldDef(atd: AtomicTypeDef, name: string): AtomicFieldDef {
  if (isScalarArray(atd)) {
    return mkArrayDef(atd.elementTypeDef, name);
  }
  if (isRepeatedRecord(atd)) {
    const {type, fields, elementTypeDef} = atd;
    return {type, fields, elementTypeDef, join: 'many', name};
  }
  if (atd.type === 'record') {
    const {type, fields} = atd;
    return {type, fields, join: 'one', name};
  }
  return {...atd, name};
}

export function mkArrayDef(ofType: AtomicTypeDef, name: string): ArrayDef {
  if (ofType.type === 'record') {
    return {
      type: 'array',
      join: 'many',
      name,
      elementTypeDef: {type: 'record_element'},
      fields: ofType.fields,
    };
  }
  const valueEnt = mkFieldDef(ofType, 'value');
  return {
    type: 'array',
    join: 'many',
    name,
    elementTypeDef: ofType,
    fields: [
      valueEnt,
      {...valueEnt, name: 'each', e: {node: 'field', path: ['value']}},
    ],
  };
}

export interface RecordTypeDef {
  type: 'record';
  fields: FieldDef[];
}
export interface RecordDef
  extends RecordTypeDef,
    StructDefBase,
    JoinBase,
    FieldBase {
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

export interface RepeatedRecordTypeDef {
  type: 'array';
  elementTypeDef: RecordElementTypeDef;
  fields: FieldDef[];
}
export interface RepeatedRecordDef
  extends RepeatedRecordTypeDef,
    StructDefBase,
    JoinBase,
    FieldBase {
  type: 'array';
  join: 'many';
}
export type ArrayTypeDef = ScalarArrayTypeDef | RepeatedRecordTypeDef;
export type ArrayDef = ScalarArrayDef | RepeatedRecordDef;

export function isRepeatedRecordFunctionParam(
  paramT: FunctionParameterTypeDef
): paramT is RepeatedRecordFunctionParameterTypeDef {
  return (
    paramT.type === 'array' && paramT.elementTypeDef.type === 'record_element'
  );
}

export function isRepeatedRecord(
  fd: FieldDef | QueryFieldDef | StructDef | AtomicTypeDef
): fd is RepeatedRecordTypeDef {
  return fd.type === 'array' && fd.elementTypeDef.type === 'record_element';
}

export function isScalarArray(
  td: AtomicTypeDef | FieldDef | QueryFieldDef | StructDef
): td is ScalarArrayTypeDef {
  return td.type === 'array' && td.elementTypeDef.type !== 'record_element';
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
  | 'composite'
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
  onCompositeFieldUsage?: CompositeFieldUsage;
  accessModifier?: NonDefaultAccessModifierLabel | undefined;
}

export type Joinable =
  | CompositeSourceDef
  | TableSourceDef
  | SQLSourceDef
  | QuerySourceDef
  | RepeatedRecordDef
  | RecordDef
  | ArrayDef;
export type JoinFieldDef = Joinable & JoinBase;

export function isJoinable(sd: StructDef): sd is Joinable {
  return [
    'composite',
    'table',
    'sql_select',
    'query_source',
    'array',
    'record',
  ].includes(sd.type);
}

export function isJoined(sd: TypedDef): sd is JoinFieldDef {
  return 'join' in sd;
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

/** reference to a data source */
// TODO this should be renamed to `SourceRef`
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
  compositeResolvedSourceDef?: SourceDef;
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
  compositeFieldUsage?: CompositeFieldUsage;
}
export function isIndexSegment(pe: PipeSegment): pe is IndexSegment {
  return (pe as IndexSegment).type === 'index';
}

export interface CompositeFieldUsage {
  fields: string[];
  joinedUsage: Record<string, CompositeFieldUsage>;
}

export interface QuerySegment extends Filtered, Ordered {
  type: 'reduce' | 'project' | 'partial';
  queryFields: QueryFieldDef[];
  extendSource?: FieldDef[];
  limit?: number;
  queryTimezone?: string;
  alwaysJoins?: string[];
  compositeFieldUsage?: CompositeFieldUsage;
}

export type NonDefaultAccessModifierLabel = 'private' | 'internal';
export type AccessModifierLabel = NonDefaultAccessModifierLabel | 'public';

export interface TurtleDef extends NamedObject, Pipeline {
  type: 'turtle';
  annotation?: Annotation;
  accessModifier?: NonDefaultAccessModifierLabel | undefined;
  compositeFieldUsage?: CompositeFieldUsage;
}

interface StructDefBase extends HasLocation, NamedObject {
  type: string;
  annotation?: Annotation;
  modelAnnotation?: ModelAnnotation;
  fields: FieldDef[];
}

interface SourceDefBase extends StructDefBase, Filtered, ResultStructMetadata {
  arguments?: Record<string, Argument>;
  parameters?: Record<string, Parameter>;
  queryTimezone?: string;
  connection: string;
  primaryKey?: PrimaryKeyRef;
  dialect: string;
}
/** which field is the primary key in this struct */
export type PrimaryKeyRef = string;

export interface TableSourceDef extends SourceDefBase {
  type: 'table';
  tablePath: string;
}

export interface CompositeSourceDef extends SourceDefBase {
  type: 'composite';
  // TODO make composite sources support StructRefs
  sources: SourceDef[];
}

/*
 * Malloy has a kind of "strings" which is a list of segments. Each segment
 * is either a string, or a query, which is meant to be replaced
 * by the text of the query when the query is compiled to SQL.
 */
export interface SQLStringSegment {
  sql: string;
}
export type SQLPhraseSegment = Query | SQLStringSegment;
export function isSegmentSQL(f: SQLPhraseSegment): f is SQLStringSegment {
  return 'sql' in f;
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
    sd.type === 'nest_source' ||
    sd.type === 'composite'
  );
}

export type SourceDef =
  | TableSourceDef
  | SQLSourceDef
  | QuerySourceDef
  | QueryResultDef
  | FinalizeSourceDef
  | NestSourceDef
  | CompositeSourceDef;

/** Is this the "FROM" table of a query tree */
export function isBaseTable(def: StructDef): def is SourceDef {
  if (isJoinedSource(def)) {
    return false;
  }
  if (isSourceDef(def)) {
    return true;
  }
  return false;
}

export type StructDef = SourceDef | RecordDef | ArrayDef;

// "NonAtomic" are types that a name lookup or a computation might
// have which are not AtomicFieldDefs. I asked an AI for a word for
// for "non-atomic" and even the AI couldn't think of the right word.
export type NonAtomicType =
  | Exclude<JoinElementType, 'array' | 'record'>
  | 'turtle' //   do NOT have the full type info, just noting the type
  | 'null'
  | 'duration'
  | 'regular expression'
  | 'filter expression';
export interface NonAtomicTypeDef {
  type: NonAtomicType;
}

export type ExpressionValueType = AtomicFieldType | NonAtomicType;
export type ExpressionValueTypeDef = AtomicTypeDef | NonAtomicTypeDef;
export type LeafExpressionType = Exclude<
  ExpressionValueType,
  JoinElementType | 'turtle'
>;

export type TypeInfo = {
  expressionType: ExpressionType;
  evalSpace: EvalSpace;
  compositeFieldUsage: CompositeFieldUsage;
};

export type TypeDesc = ExpressionValueTypeDef & TypeInfo;

export type FunctionParameterTypeDef =
  ExpressionValueExtTypeDef<FunctionParameterTypeExtensions>;
export type FunctionParamTypeDesc = FunctionParameterTypeDef & {
  expressionType: ExpressionType | undefined;
  evalSpace: EvalSpace;
};

interface ScalarArrayExtTypeDef<TypeExtensions> {
  type: 'array';
  elementTypeDef: Exclude<
    ExpressionValueExtTypeDef<TypeExtensions>,
    RecordExtTypeDef<TypeExtensions>
  >;
}

type ExpressionValueExtTypeDef<TypeExtensions> =
  | AtomicTypeDef
  | NonAtomicTypeDef
  | ScalarArrayExtTypeDef<TypeExtensions>
  | RecordExtTypeDef<TypeExtensions>
  | RepeatedRecordExtTypeDef<TypeExtensions>
  | TypeExtensions;

interface RecordExtTypeDef<TypeExtensions> {
  type: 'record';
  fields: ExtFieldDef<TypeExtensions>[];
}

type ExtFieldDef<TypeExtensions> = FieldDef | (TypeExtensions & FieldBase);

interface RepeatedRecordExtTypeDef<TypeExtensions> {
  type: 'array';
  elementTypeDef: RecordElementTypeDef;
  fields: ExtFieldDef<TypeExtensions>[];
}

type FunctionReturnTypeExtensions = GenericTypeDef;

export type ScalarArrayFunctionReturnTypeDef =
  ScalarArrayExtTypeDef<FunctionReturnTypeExtensions>;

export type FunctionReturnFieldDef = ExtFieldDef<FunctionReturnTypeExtensions>;

export type RecordFunctionReturnTypeDef =
  RecordExtTypeDef<FunctionReturnTypeExtensions>;

export type RepeatedRecordFunctionReturnTypeDef =
  RepeatedRecordExtTypeDef<FunctionReturnTypeExtensions>;

type FunctionParameterTypeExtensions = GenericTypeDef | AnyTypeDef;

export type ScalarArrayFunctionParameterTypeDef =
  ScalarArrayExtTypeDef<FunctionParameterTypeExtensions>;

export type FunctionParameterFieldDef =
  ExtFieldDef<FunctionParameterTypeExtensions>;

export type RecordFunctionParameterTypeDef =
  RecordExtTypeDef<FunctionParameterTypeExtensions>;

export type RepeatedRecordFunctionParameterTypeDef =
  RepeatedRecordExtTypeDef<FunctionParameterTypeExtensions>;

type FunctionGenericTypeExtensions = AnyTypeDef;

export type ScalarArrayFunctionGenericTypeDef =
  ScalarArrayExtTypeDef<FunctionGenericTypeExtensions>;

export type FunctionGenericFieldDef =
  ExtFieldDef<FunctionGenericTypeExtensions>;

export type RecordFunctionGenericTypeDef =
  RecordExtTypeDef<FunctionGenericTypeExtensions>;

export type RepeatedRecordFunctionGenericTypeDef =
  RepeatedRecordExtTypeDef<FunctionGenericTypeExtensions>;

export interface GenericTypeDef {
  type: 'generic';
  generic: string;
}

export interface AnyTypeDef {
  type: 'any';
}

export type TypeDescExtensions = {
  expressionType: ExpressionType | undefined;
  evalSpace: EvalSpace;
};

export type FunctionReturnTypeDef =
  ExpressionValueExtTypeDef<FunctionReturnTypeExtensions>;
export type FunctionReturnTypeDesc = FunctionReturnTypeDef & TypeDescExtensions;

export type EvalSpace = 'constant' | 'input' | 'output' | 'literal';

export function isLiteral(evalSpace: EvalSpace) {
  return evalSpace === 'literal';
}

export function mergeEvalSpaces(...evalSpaces: EvalSpace[]): EvalSpace {
  if (evalSpaces.length <= 1 && evalSpaces.every(e => e === 'literal')) {
    return 'literal';
  } else if (evalSpaces.every(e => e === 'constant' || e === 'literal')) {
    return 'constant';
  } else if (
    evalSpaces.every(e => e === 'output' || e === 'constant' || e === 'literal')
  ) {
    return 'output';
  }
  return 'input';
}

export interface FunctionParameterDef {
  name: string;
  // These expression types are MAXIMUM types -- e.g. if you specify "scalar",
  // you cannot pass in an "aggregate" and if you specify "aggregate", you can
  // pass in "scalar" or "aggregate", but not "analytic"
  allowedTypes: FunctionParamTypeDesc[];
  isVariadic: boolean;
}

export type FunctionGenericTypeDef =
  ExpressionValueExtTypeDef<FunctionGenericTypeExtensions>;

export interface FunctionOverloadDef {
  // The expression type here is the MINIMUM return type
  returnType: FunctionReturnTypeDesc;
  isSymmetric?: boolean;
  params: FunctionParameterDef[];
  supportsOrderBy?: boolean | 'only_default';
  supportsLimit?: boolean;
  genericTypes?: {name: string; acceptibleTypes: FunctionGenericTypeDef[]}[];
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
export type LeafAtomicDef = LeafAtomicTypeDef & FieldBase;

export type AtomicTypeDef =
  | LeafAtomicTypeDef
  | ScalarArrayTypeDef
  | RecordTypeDef
  | RepeatedRecordTypeDef;
export type AtomicFieldDef =
  | LeafAtomicDef
  | ScalarArrayDef
  | RecordDef
  | RepeatedRecordDef;

export function isLeafAtomic(
  fd: FieldDef | QueryFieldDef | AtomicTypeDef
): fd is LeafAtomicDef {
  return (
    fd.type === 'string' ||
    isTemporalType(fd.type) ||
    fd.type === 'number' ||
    fd.type === 'boolean' ||
    fd.type === 'json' ||
    fd.type === 'sql native' ||
    fd.type === 'error'
  );
}

// Sources have fields like this ...
export type FieldDef = LeafAtomicDef | JoinFieldDef | TurtleDef;
export type FieldDefType = AtomicFieldType | 'turtle' | JoinElementType;

// Queries have fields like this ..

export interface RefToField {
  type: 'fieldref';
  path: string[];
  annotation?: Annotation;
}
export type QueryFieldDef = AtomicFieldDef | TurtleDef | RefToField;

// All these share the same "type" space
export type TypedDef =
  | AtomicTypeDef
  | JoinFieldDef
  | TurtleDef
  | RefToField
  | StructDef;

/** Get the output name for a NamedObject */
export function getIdentifier(n: AliasedName): string {
  if (n.as !== undefined) {
    return n.as;
  }
  return n.name;
}

export type NamedModelObject =
  | SourceDef
  | NamedQuery
  | FunctionDef
  | ConnectionDef;

export interface DependencyTree {
  [url: string]: DependencyTree;
}

/** Result of parsing a model file */
export interface ModelDef {
  name: string;
  exports: string[];
  contents: Record<string, NamedModelObject>;
  annotation?: ModelAnnotation;
  queryList: Query[];
  dependencies: DependencyTree;
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

export function isTurtle(def: TypedDef): def is TurtleDef {
  return def.type === 'turtle';
}

export function isAtomic(
  def: TypedDef | ExpressionValueTypeDef
): def is AtomicTypeDef {
  return isAtomicFieldType(def.type);
}

export interface SearchResultRow {
  field_name: string; // eslint-disable-line camelcase
  field_value: string; // eslint-disable-line camelcase
  weight: number;
}

export type SearchResult = SearchResultRow[];

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
  defaultRowLimit?: number;
}

type UTD =
  | AtomicTypeDef
  | TypedDef
  | FunctionParameterTypeDef
  | FunctionReturnTypeDef
  | undefined;
/**
 * A set of utilities for asking questions TypeDef/TypeDesc
 * (which is OK because TypeDesc is an extension of a TypeDef)
 */
export const TD = {
  isAtomic(td: UTD): td is AtomicTypeDef {
    return td !== undefined && isAtomicFieldType(td.type);
  },
  isLeafAtomic(td: UTD): td is LeafAtomicTypeDef {
    return td !== undefined && isLeafAtomic({type: td.type} as AtomicTypeDef);
  },
  isString: (td: UTD): td is StringTypeDef => td?.type === 'string',
  isNumber: (td: UTD): td is NumberTypeDef => td?.type === 'number',
  isBoolean: (td: UTD): td is BooleanTypeDef => td?.type === 'boolean',
  isJSON: (td: UTD): td is JSONTypeDef => td?.type === 'json',
  isSQL: (td: UTD): td is NativeUnsupportedTypeDef => td?.type === 'sql native',
  isDate: (td: UTD): td is DateTypeDef => td?.type === 'date',
  isTimestamp: (td: UTD): td is TimestampTypeDef => td?.type === 'timestamp',
  isTemporal(td: UTD): td is TimestampTypeDef {
    const typ = td?.type ?? '';
    return isTemporalType(typ);
  },
  isError: (td: UTD): td is ErrorTypeDef => td?.type === 'error',
  eq(x: UTD, y: UTD): boolean {
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
      return TD.isAtomic(x) && TD.isAtomic(y) && checkFields(x, y);
    } else if (x.type === 'record' && y.type === 'record') {
      return TD.isAtomic(x) && TD.isAtomic(y) && checkFields(x, y);
    }
    if (x.type === 'sql native' && y.type === 'sql native') {
      return x.rawType !== undefined && x.rawType === y.rawType;
    }
    return x.type === y.type;
  },
};

// clang-format on
