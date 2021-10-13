/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
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

/** put line number into the parse tree. */
export interface LineNumber {
  fileName?: string;
  lineNumber?: number;
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
    if (!["name", "as", "filterList"].includes(prop)) {
      return false;
    }
  }
  return true;
}

/** all named objects have a type an a name (optionally aliased) */
export interface NamedObject extends AliasedName, LineNumber {
  type: string;
}

export interface ResultMetadataDef {
  sourceField: string;
  sourceExpression?: string;
  sourceClasses: string[];
  filterList?: FilterExpression[];
  fieldKind: "measure" | "dimension" | "struct";
}

export interface ResultMetadata {
  resultMetadata?: ResultMetadataDef;
}

export interface FilterFragment {
  type: "filterExpression";
  filterList: FilterExpression[];
  e: Expr;
}
export function isFilterFragment(f: Fragment): f is FilterFragment {
  return (f as FilterFragment)?.type === "filterExpression";
}

export interface AggregateFragment {
  type: "aggregate";
  function: string;
  e: Expr;
  structPath?: string;
}
export function isAggregateFragment(f: Fragment): f is AggregateFragment {
  return (f as AggregateFragment)?.type === "aggregate";
}
export function isAsymmetricFragment(f: Fragment): f is AggregateFragment {
  return isAggregateFragment(f) && ["sum", "avg", "count"].includes(f.function);
}

export interface FieldFragment {
  type: "field";
  path: string;
}
export function isFieldFragment(f: Fragment): f is FieldFragment {
  return (f as FieldFragment)?.type === "field";
}

export interface ParameterFragment {
  type: "parameter";
  path: string;
}
export function isParameterFragment(f: Fragment): f is ParameterFragment {
  return (f as ParameterFragment)?.type === "parameter";
}

export interface ApplyValueFragment {
  type: "applyVal";
}
export function isApplyValue(f: Fragment): f is ApplyValueFragment {
  return (f as ApplyValueFragment)?.type === "applyVal";
}

export interface ApplyFragment {
  type: "apply";
  value: Expr;
  to: Expr;
}
export function isApplyFragment(f: Fragment): f is ApplyFragment {
  return (f as ApplyFragment)?.type === "apply";
}

export type Fragment =
  | string
  | ApplyFragment
  | ApplyValueFragment
  | FieldFragment
  | ParameterFragment
  | FilterFragment
  | AggregateFragment;

export type Expr = Fragment[];

export interface Expression {
  e?: Expr;
  aggregate?: boolean;
  source?: string;
}

interface JustExpression {
  e: Expr;
}
type HasExpression = FieldDef & JustExpression;
/**  Grants access to the expression property of a FielfDef */
export function hasExpression(f: FieldDef): f is HasExpression {
  return (f as JustExpression).e !== undefined;
}

export type AtomicFieldType =
  | "string"
  | "number"
  | "date"
  | "timestamp"
  | "boolean";
export function isAtomicFieldType(s: string): s is AtomicFieldType {
  return ["string", "number", "date", "timestamp", "boolean"].includes(s);
}

/** All scalars can have an optional expression */
export interface FieldAtomicDef
  extends NamedObject,
    Expression,
    ResultMetadata {
  type: AtomicFieldType;
}

/** Scalar String Field */
export interface FieldStringDef extends FieldAtomicDef {
  type: "string";
  bucketFilter?: string;
  bucketOther?: string;
}

/** Scalar Numeric String Field */
export interface FieldNumberDef extends FieldAtomicDef {
  type: "number";
  numberType?: "integer" | "float";
}

/** Scalar Boolean Field */
export interface FieldBooleanDef extends FieldAtomicDef {
  type: "boolean";
}

/** valid suffixes for a date field ref which are not valid timeframes */
type LegacySecretTimeFrames =
  | "date"
  | "day_of_month"
  | "day_of_year"
  | "day_of_week"
  | "month_of_year";
/** valid timeframes for date */
export type DateTimeframe =
  | LegacySecretTimeFrames
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";
export function isDateTimeFrame(str: string): str is DateTimeframe {
  return [
    "day",
    "week",
    "month",
    "quarter",
    "year",
    // TODO Don't forget to remove legacy types here
    "day_of_month",
    "day_of_year",
    "day_of_week",
    "month_of_year",
  ].includes(str);
}

/** Value types distinguished by their usage in generated SQL, particularly with respect to filters. */
export enum ValueType {
  Date = "date",
  Timestamp = "timestamp",
  Number = "number",
  String = "string",
}

export type TimeValueType = ValueType.Date | ValueType.Timestamp;

/** Scalar Date Field. */
export interface FieldDateDef extends FieldAtomicDef {
  type: "date";
  timeframe?: DateTimeframe;
}

/** valid suffuxes for a timestamp field which are not valid timeframes */
type LegacyTimeTimeframes = "hour_of_day";
/** valid timeframes for a timestmap */
export type TimeTimeframe =
  | DateTimeframe
  | LegacyTimeTimeframes
  | "hour"
  | "minute"
  | "second";
export function isTimeTimeframe(s: string): s is TimeTimeframe {
  // TODO Don't forget to remove legacy types here
  return (
    isDateTimeFrame(s) ||
    ["hour", "minute", "second", "hour_of_day"].includes(s)
  );
}
/** Scalar Timestamp Field */
export interface FieldTimestampDef extends FieldAtomicDef {
  type: "timestamp";
  timeframe?: TimeTimeframe;
}

/** parameter to order a query */
export interface OrderBy {
  field: string | number;
  dir?: "asc" | "desc";
}

export interface ByName {
  by: "name";
  name: string;
}
export interface ByExpression {
  by: "expression";
  e: Expr;
}
export type By = ByName | ByExpression;

export function isByName(by: By | undefined): by is ByName {
  if (by === undefined) {
    return false;
  }
  return by.by === "name";
}

export function isByExpression(by: By | undefined): by is ByExpression {
  if (by === undefined) {
    return false;
  }
  return by.by === "name";
}

/** reference to a data source */
export type StructRef = string | StructDef;
export function refIsStructDef(ref: StructRef): ref is StructDef {
  return typeof ref !== "string" && ref.type === "struct";
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

export interface Query extends Pipeline, Filtered {
  type?: "query";
  structRef: StructRef;
}

export type NamedQuery = Query & AliasedName;

export type PipeSegment = ReduceSegment | ProjectSegment | IndexSegment;

export interface ReduceSegment extends QuerySegment {
  type: "reduce";
}
export function isReduceSegment(pe: PipeSegment): pe is ReduceSegment {
  return (pe as ReduceSegment).type === "reduce";
}

export interface ProjectSegment extends QuerySegment {
  type: "project";
}
export function isProjectSegment(pe: PipeSegment): pe is ProjectSegment {
  return (pe as ProjectSegment).type === "project";
}
export interface IndexSegment extends Filtered {
  type: "index";
  fields: string[];
  limit?: number;
  weightMeasure?: string; // only allow the name of the field to use for weights
}
export function isIndexSegment(pe: PipeSegment): pe is IndexSegment {
  return (pe as IndexSegment).type === "index";
}

export interface QuerySegment extends Filtered {
  type: "reduce" | "project";
  fields: QueryFieldDef[];
  limit?: number;
  by?: By;
  orderBy?: OrderBy[]; // uses output field name or index.
}

export interface TurtleDef extends NamedObject, Pipeline {
  type: "turtle";
}

type JoinType = "left" | "right" | "inner" | "outer";
export type JoinRelationship =
  | "one_to_one"
  | "one_to_many"
  | "many_to_one"
  | "many_to_many";

export interface JoinForeignKey {
  type: "foreignKey";
  foreignKey: FieldRef;
  joinType?: JoinType;
}

export interface JoinCondition {
  type: "condition";
  onExpression: Expression; // must be a boolean expression
  joinType?: JoinType;
  joinRelationship: JoinRelationship;
}

/** types of joins. */
export type StructRelationship =
  | { type: "basetable" }
  | JoinForeignKey
  | JoinCondition
  | { type: "inline" }
  | { type: "nested"; field: FieldRef };

/** where does the struct come from? */
export type StructSource =
  | { type: "table" }
  | { type: "nested" }
  | { type: "inline" }
  | { type: "query"; query: Query }
  | { type: "sql" };

// Inline and nested tables, cannot have a StructRelationship
//  the relationshipo is implied

/** struct that is intrinsic to the table */
export interface StructDef extends NamedObject, ResultMetadata, Filtered {
  type: "struct";
  structSource: StructSource;
  structRelationship: StructRelationship;
  fields: FieldDef[];
  primaryKey?: PrimaryKeyRef;
  parameters?: Record<string, Parameter>;
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
  | FieldBooleanDef;

export function isFieldTypeDef(f: FieldDef): f is FieldTypeDef {
  return (
    f.type === "string" ||
    f.type === "date" ||
    f.type === "number" ||
    f.type === "timestamp" ||
    f.type === "boolean"
  );
}

export function isFieldTimeBased(
  f: FieldDef
): f is FieldTimestampDef | FieldDateDef {
  return f.type === "date" || f.type === "timestamp";
}

export function isFieldStructDef(f: FieldDef): f is StructDef {
  return f.type === "struct";
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
  source: string;
  aggregate?: boolean;
}

/** Get the output name for a NamedObject */
export function getIdentifier(n: AliasedName): string {
  if (n.as !== undefined) {
    return n.as;
  }
  return n.name;
}

export type NamedMalloyObject = StructDef;

/** Result of parsing a model file */
export interface ModelDef {
  name: string;
  exports: string[];
  structs: Record<string, NamedMalloyObject>;
}

/** Very common record type */
export type NamedStructDefs = Record<string, StructDef>;

export type QueryScalar =
  | string
  | boolean
  | number
  | { value: string }
  | { type: "Buffer"; data: number[] }
  | null;

/** One value in one column of returned data. */
export type QueryValue = QueryScalar | QueryData | QueryDataRow;

/** A row of returned data. */
export type QueryDataRow = { [columnName: string]: QueryValue };

/** Returned query data. */
export type QueryData = QueryDataRow[];

/** Returned Malloy query data */
export type MalloyQueryData = {
  rows: QueryDataRow[];
  totalRows: number;
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
}

/** Result type for running a Malloy query. */
export interface QueryResult extends CompiledQuery {
  result: QueryData;
  totalRows: number;
  error?: string;
}

export function isTurtleDef(def: FieldDef): def is TurtleDef {
  return def.type === "turtle";
}

export interface SearchResultRow {
  field_name: string; // eslint-disable-line camelcase
  field_value: string; // eslint-disable-line camelcase
  weight: number;
}

export type SearchResult = SearchResultRow[];

export function isDimensional(field: FieldDef): boolean {
  if ("resultMetadata" in field) {
    return field.resultMetadata?.fieldKind === "dimension";
  }
  return false;
}

export function isPhysical(field: FieldDef): boolean {
  return (
    (isFieldTypeDef(field) && field.e === undefined) ||
    (isFieldStructDef(field) &&
      (field.structSource.type === "nested" ||
        field.structSource.type == "inline"))
  );
}

export function getDimensions(structDef: StructDef): FieldAtomicDef[] {
  return structDef.fields.filter(isDimensional) as FieldAtomicDef[];
}

export function getPhysicalFields(structDef: StructDef): FieldDef[] {
  return structDef.fields.filter(isPhysical) as FieldDef[];
}

export function isMeasureLike(field: FieldDef): boolean {
  if ("resultMetadata" in field) {
    return (
      field.resultMetadata?.fieldKind === "measure" ||
      field.resultMetadata?.fieldKind === "struct"
    );
  }
  return false;
}

export function isValueString(
  value: QueryValue,
  field: FieldDef
): value is string | null {
  return field.type === "string";
}

export function isValueNumber(
  value: QueryValue,
  field: FieldDef
): value is number | null {
  return field.type === "number";
}

export function isValueBoolean(
  value: QueryValue,
  field: FieldDef
): value is boolean | null {
  return field.type === "boolean";
}

export function isValueTimestamp(
  value: QueryValue,
  field: FieldDef
): value is { value: string } | null {
  return field.type === "timestamp";
}

export function isValueDate(
  value: QueryValue,
  field: FieldDef
): value is { value: string } | null {
  return field.type === "date";
}

// clang-format on
