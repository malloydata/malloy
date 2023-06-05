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

interface ParamBase {
  name: string;
  type: AtomicFieldType;
}
type ConstantExpr = Expr;
type Condition = Expr;
interface ParamCondition extends ParamBase {
  condition: Condition | null;
}
interface ParamValue extends ParamBase {
  value: ConstantExpr | null;
  constant: boolean;
}
export type Parameter = ParamCondition | ParamValue;
export function isValueParameter(p: Parameter): p is ParamValue {
  return (p as ParamValue).value !== undefined;
}
export function isConditionParameter(p: Parameter): p is ParamCondition {
  return (p as ParamCondition).condition !== undefined;
}
export function paramHasValue(p: Parameter): boolean {
  return isValueParameter(p) || p.condition !== null;
}

export interface DocumentRange {
  start: DocumentPosition;
  end: DocumentPosition;
}

export interface DocumentPosition {
  line: number;
  character: number;
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

export interface FilteredAliasedName extends AliasedName {
  filterList?: FilterExpression[];
}
export function isFilteredAliasedName(
  f: FieldTypeRef
): f is FilteredAliasedName {
  for (const prop of Object.keys(f)) {
    if (!['name', 'as', 'filterList'].includes(prop)) {
      return false;
    }
  }
  return true;
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
  filterList?: FilterExpression[];
  fieldKind: 'measure' | 'dimension' | 'struct';
}

// struct specific metadta
export interface ResultStructMetadataDef extends ResultMetadataDef {
  limit?: number;
}

export interface ResultMetadata {
  resultMetadata?: ResultMetadataDef;
}

export interface ResultStructMetadata {
  resultMetadata?: ResultStructMetadataDef;
}

export interface OutputFieldFragment {
  type: 'outputField';
  name: string;
}

export function isOutputFieldFragment(f: Fragment): f is OutputFieldFragment {
  return (f as OutputFieldFragment)?.type === 'outputField';
}

export interface FilterFragment {
  type: 'filterExpression';
  filterList: FilterExpression[];
  e: Expr;
}

export function isFilterFragment(f: Fragment): f is FilterFragment {
  return (f as FilterFragment)?.type === 'filterExpression';
}

export function isDialectFragment(f: Fragment): f is DialectFragment {
  return (f as DialectFragment)?.type === 'dialect';
}

export interface AggregateFragment {
  type: 'aggregate';
  function: string;
  e: Expr;
  structPath?: string;
}
export function isAggregateFragment(f: Fragment): f is AggregateFragment {
  return (f as AggregateFragment)?.type === 'aggregate';
}
export function isAsymmetricFragment(f: Fragment): f is AggregateFragment {
  return isAggregateFragment(f) && ['sum', 'avg', 'count'].includes(f.function);
}

export interface UngroupFragment {
  type: 'all' | 'exclude';
  e: Expr;
  fields?: string[];
}

export function isUngroupFragment(f: Fragment): f is UngroupFragment {
  const ftype = (f as UngroupFragment)?.type;
  return ftype === 'all' || ftype === 'exclude';
}

export interface FunctionParameterFragment {
  type: 'function_parameter';
  name: string;
}

export function isFunctionParameterFragment(
  f: Fragment
): f is FunctionParameterFragment {
  return (f as FunctionParameterFragment)?.type === 'function_parameter';
}

export interface FunctionCallFragment {
  type: 'function_call';
  overload: FunctionOverloadDef;
  expressionType: ExpressionType;
  args: Expr[];
  structPath?: string;
}

export function isFunctionCallFragment(f: Fragment): f is FunctionCallFragment {
  return (f as FunctionCallFragment)?.type === 'function_call';
}

export interface SQLExpressionFragment {
  type: 'sql_expression';
  e: Expr;
}

export function isSQLExpressionFragment(
  f: Fragment
): f is SQLExpressionFragment {
  return (f as SQLExpressionFragment)?.type === 'sql_expression';
}

export interface SpreadFragment {
  type: 'spread';
  e: Expr;
}

export function isSpreadFragment(f: Fragment): f is SpreadFragment {
  return (f as SpreadFragment)?.type === 'spread';
}

export interface FieldFragment {
  type: 'field';
  path: string;
}
export function isFieldFragment(f: Fragment): f is FieldFragment {
  return (f as FieldFragment)?.type === 'field';
}

export interface ParameterFragment {
  type: 'parameter';
  path: string;
}
export function isParameterFragment(f: Fragment): f is ParameterFragment {
  return (f as ParameterFragment)?.type === 'parameter';
}

export interface ApplyValueFragment {
  type: 'applyVal';
}
export function isApplyValue(f: Fragment): f is ApplyValueFragment {
  return (f as ApplyValueFragment)?.type === 'applyVal';
}

export interface ApplyFragment {
  type: 'apply';
  value: Expr;
  to: Expr;
}
export function isApplyFragment(f: Fragment): f is ApplyFragment {
  return (f as ApplyFragment)?.type === 'apply';
}

interface DialectFragmentBase {
  type: 'dialect';
  function: string;
}

export interface NowFragment extends DialectFragmentBase {
  function: 'now';
}

export interface TimeDiffFragment extends DialectFragmentBase {
  function: 'timeDiff';
  units: TimestampUnit;
  left: TimeValue;
  right: TimeValue;
}

export interface TimeDeltaFragment extends DialectFragmentBase {
  function: 'delta';
  base: TimeValue;
  op: '+' | '-';
  delta: Expr;
  units: TimestampUnit;
}

export interface TimeTruncFragment extends DialectFragmentBase {
  function: 'trunc';
  expr: TimeValue;
  units: TimestampUnit;
}

export interface TimeExtractFragment extends DialectFragmentBase {
  function: 'extract';
  expr: TimeValue;
  units: ExtractUnit;
}

export interface TypecastFragment extends DialectFragmentBase {
  function: 'cast';
  safe: boolean;
  expr: Expr;
  dstType: AtomicFieldType;
  srcType?: AtomicFieldType;
}

export interface RegexpMatchFragment extends DialectFragmentBase {
  function: 'regexpMatch';
  expr: Expr;
  regexp: Expr;
}

export interface DivFragment extends DialectFragmentBase {
  function: 'div';
  numerator: Expr;
  denominator: Expr;
}

export interface TimeLiteralFragment extends DialectFragmentBase {
  function: 'timeLiteral';
  literal: string;
  literalType: TimeFieldType;
  timezone?: string;
}

export interface StringLiteralFragment extends DialectFragmentBase {
  function: 'stringLiteral';
  literal: string;
}

export interface RegexpLiteralFragment extends DialectFragmentBase {
  function: 'regexpLiteral';
  literal: string;
}

export interface NumberLiteralFragment extends DialectFragmentBase {
  function: 'numberLiteral';
  literal: string;
}

export type DialectFragment =
  | DivFragment
  | TimeLiteralFragment
  | NowFragment
  | TimeDeltaFragment
  | TimeDiffFragment
  | TimeTruncFragment
  | TypecastFragment
  | TimeExtractFragment
  | StringLiteralFragment
  | RegexpLiteralFragment
  | NumberLiteralFragment
  | RegexpMatchFragment;

export type Fragment =
  | string
  | ApplyFragment
  | ApplyValueFragment
  | FieldFragment
  | ParameterFragment
  | FilterFragment
  | OutputFieldFragment
  | AggregateFragment
  | UngroupFragment
  | DialectFragment
  | FunctionParameterFragment
  | FunctionCallFragment
  | SQLExpressionFragment
  | SpreadFragment;

export type Expr = Fragment[];

export interface TypedValue {
  value: Expr;
  valueType: AtomicFieldType;
}
export interface TimeValue extends TypedValue {
  valueType: TimeFieldType;
}

type TagElement = Expr | string;

/**
 * Return an Expr based on the string template, subsittutions can be
 * either strings, or other Exprs.

 * ```
 * units = "inches"
 * len: Expr = [ "something", "returning", "a length "]
 * computeExpr = mkExpr`MEASURE(${len} in ${units})`;
 * ```
 */
export function mkExpr(
  src: TemplateStringsArray,
  ...exprs: TagElement[]
): Expr {
  const ret: Expr = [];
  let index;
  for (index = 0; index < exprs.length; index++) {
    const el = exprs[index];
    if (src[index].length > 0) {
      ret.push(src[index]);
    }
    if (typeof el === 'string') {
      ret.push(el);
    } else {
      ret.push(...el);
    }
  }
  if (src[index].length > 0) {
    ret.push(src[index]);
  }
  return ret;
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

interface JustExpression {
  e: Expr;
}
type HasExpression = FieldDef & JustExpression;
/**  Grants access to the expression property of a FielfDef */
export function hasExpression(f: FieldDef): f is HasExpression {
  return (f as JustExpression).e !== undefined;
}

export type TimeFieldType = 'date' | 'timestamp';
export function isTimeFieldType(s: string): s is TimeFieldType {
  return s === 'date' || s === 'timestamp';
}
export type AtomicFieldType =
  | 'string'
  | 'number'
  | TimeFieldType
  | 'boolean'
  | 'unsupported'
  | 'json';
export function isAtomicFieldType(s: string): s is AtomicFieldType {
  return [
    'string',
    'number',
    'date',
    'timestamp',
    'boolean',
    'json',
    'unsupported',
  ].includes(s);
}

/** All scalars can have an optional expression */
export interface FieldAtomicDef
  extends NamedObject,
    Expression,
    ResultMetadata {
  type: AtomicFieldType;
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

/** Scalar String Field */
export interface FieldStringDef extends FieldAtomicDef {
  type: 'string';
  bucketFilter?: string;
  bucketOther?: string;
}

/** Scalar Numeric String Field */
export interface FieldNumberDef extends FieldAtomicDef {
  type: 'number';
  numberType?: 'integer' | 'float';
}

/** Scalar Boolean Field */
export interface FieldBooleanDef extends FieldAtomicDef {
  type: 'boolean';
}

/** Scalar JSON Field */
export interface FieldJSONDef extends FieldAtomicDef {
  type: 'json';
}

/** Scalar unsupported Field */
export interface FieldUnsupportedDef extends FieldAtomicDef {
  type: 'unsupported';
  rawType?: string;
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

/** Scalar Date Field. */
export interface FieldDateDef extends FieldAtomicDef {
  type: 'date';
  timeframe?: DateUnit;
}

/** Scalar Timestamp Field */
export interface FieldTimestampDef extends FieldAtomicDef {
  type: 'timestamp';
  timeframe?: TimestampUnit;
}

/** parameter to order a query */
export interface OrderBy {
  field: string | number;
  dir?: 'asc' | 'desc';
}

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

/** join pattern structs is a struct. */
export interface JoinedStruct {
  structRef: StructRef;
  structRelationship: StructRelationship;
  as: string;
}

export interface Filtered {
  filterList?: FilterExpression[];
}

/**
 * First element in a pipeline might be a reference to a turtle
 */
export interface TurtleSegment extends Filtered {
  name: string;
}
export interface Pipeline {
  pipeHead?: TurtleSegment;
  pipeline: PipeSegment[];
}

export interface Query extends Pipeline, Filtered, HasLocation {
  type?: 'query';
  structRef: StructRef;
}

export type NamedQuery = Query & NamedObject;

export type PipeSegment = QuerySegment | IndexSegment;

export interface ReduceSegment extends QuerySegment {
  type: 'reduce';
}
export function isReduceSegment(pe: PipeSegment): pe is ReduceSegment {
  return pe.type === 'reduce';
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

export interface IndexSegment extends Filtered {
  type: 'index';
  fields: string[];
  limit?: number;
  weightMeasure?: string; // only allow the name of the field to use for weights
  sample?: Sampling;
}
export function isIndexSegment(pe: PipeSegment): pe is IndexSegment {
  return (pe as IndexSegment).type === 'index';
}

export interface QuerySegment extends Filtered {
  type: 'reduce' | 'project';
  fields: QueryFieldDef[];
  extendSource?: FieldDef[];
  limit?: number;
  by?: By;
  orderBy?: OrderBy[]; // uses output field name or index.
  queryTimezone?: string;
}

export interface TurtleDef extends NamedObject, Pipeline {
  type: 'turtle';
}

export type JoinRelationship =
  | 'one_to_one'
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many';

export interface JoinOn {
  type: 'one' | 'many' | 'cross';
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
  | {type: 'nested'; field: FieldRef; isArray: boolean};

export interface SQLFragment {
  sql: string;
}
export type SQLPhrase = Query | SQLFragment;
export function isSQLFragment(f: SQLPhrase): f is SQLFragment {
  return (f as SQLFragment).sql !== undefined;
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
  parameters?: Record<string, Parameter>;
  queryTimezone?: string;
  dialect: string;
}

export type ExpressionValueType =
  | AtomicFieldType
  | 'null'
  | 'unknown'
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
  needsWindowOrderBy?: boolean;
  between?: {preceding: number | string; following: number | string};
  params: FunctionParameterDef[];
  dialect: {
    [dialect: string]: Expr;
  };
}

export interface FunctionDef extends NamedObject {
  type: 'function';
  // TODO
  overloads: FunctionOverloadDef[];
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
  | FieldUnsupportedDef;

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

/** field reference in a query */
export type FieldTypeRef = string | FieldTypeDef | FilteredAliasedName;

/** field reference with with possibly and order by. */
export type QueryFieldDef = FieldTypeRef | TurtleDef;

/** basics statement */
export type FieldDef = FieldTypeDef | StructDef | TurtleDef;

/** reference to a field */

export type FieldRef = string | FieldDef;

/** which field is the primary key in this struct */
export type PrimaryKeyRef = string;

/** filters */
export interface FilterExpression {
  expression: Expr;
  code: string;
  expressionType: ExpressionType;
}

/** Get the output name for a NamedObject */
export function getIdentifier(n: AliasedName): string {
  if (n.as !== undefined) {
    return n.as;
  }
  return n.name;
}

export type NamedModelObject = StructDef | NamedQuery | FunctionDef;

/** Result of parsing a model file */
export interface ModelDef {
  name: string;
  exports: string[];
  contents: Record<string, NamedModelObject>;
}

/** Very common record type */
export type NamedStructDefs = Record<string, StructDef>;
export type NamedModelObjects = Record<string, NamedModelObject>;

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
};

export interface DrillSource {
  sourceExplore: string;
  sourceFilters?: FilterExpression[];
}

export interface CompiledQuery extends DrillSource {
  structs: StructDef[];
  sql: string;
  lastStageName: string;
  malloy: string;
  queryName?: string | undefined;
  connectionName: string;
}

/** Result type for running a Malloy query. */
export interface QueryResult extends CompiledQuery {
  result: QueryData;
  totalRows: number;
  error?: string;
  runStats?: QueryRunStats;
}

export function isTurtleDef(def: FieldDef): def is TurtleDef {
  return def.type === 'turtle';
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
// clang-format on
