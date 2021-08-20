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
  filterList?: FilterCondition[];
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
  filterList?: FilterCondition[];
  fieldKind: "measure" | "dimension" | "struct";
}

export interface ResultMetadata {
  resultMetadata?: ResultMetadataDef;
}

export interface FilterFragment {
  type: "filterExpression";
  filterList: FilterCondition[];
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

export type Fragment =
  | string
  | FieldFragment
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
export type StructRef = string | StructDef | AnonymousExploreDef;
export function refIsStructDef(ref: StructRef): ref is StructDef {
  return typeof ref !== "string" && ref.type === "struct";
}
export interface ExploreDef extends AnonymousExploreDef, NamedObject {
  type: "explore";
}

export interface AnonymousExploreDef {
  type: "explore";
  from: StructRef;
  primaryKey?: string;
  joins?: JoinedStruct[];
  fields?: FieldDef[];
  filterList?: FilterCondition[];
}

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
  pipeHead?: TurtleSegment;
  pipeline: PipeSegment[];
}

export interface Query extends Pipeline, Filtered {
  type?: "query";
  structRef: StructRef;
}

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

/** types of joins. */
export type StructRelationship =
  | { type: "basetable" }
  // {type: 'cross'}
  | { type: "foreignKey"; foreignKey: FieldRef }
  | { type: "inline" }
  | { type: "nested"; field: FieldRef };

/** where does the struct come from? */
export type StructSource =
  | { type: "table" }
  | { type: "nested" }
  | { type: "inline" }
  | { type: "query"; query: Query };

// Inline and nested tables, cannot have a StructRelationship
//  the relationshipo is implied

/** struct that is intrinsic to the table */
export interface StructDef extends NamedObject, ResultMetadata {
  type: "struct";
  structSource: StructSource;
  structRelationship: StructRelationship;
  fields: FieldDef[];
  primaryKey?: PrimaryKeyRef;
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
export interface FilterCondition {
  condition: Expr;
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

export type NamedMalloyObject = StructDef | ExploreDef;

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
export type QueryValue = QueryScalar | QueryData;

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
  sourceFilters?: FilterCondition[];
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

export function getDimensions(structDef: StructDef): FieldAtomicDef[] {
  return structDef.fields.filter(isDimensional) as FieldAtomicDef[];
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
): value is string | null {
  return field.type === "timestamp";
}

// clang-format on
