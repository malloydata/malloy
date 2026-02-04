/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  QueryData,
  QueryDataRow,
  QueryResult,
  QueryRunStats,
  ModelDef,
  StructDef,
  FieldDef,
  NumberFieldDef,
  AtomicTypeDef,
  QueryValue,
} from '../../model';
import {isRepeatedRecord, isBasicArray} from '../../model';
import {
  rowDataToNumber,
  rowDataToSerializedBigint,
  rowDataToDate,
} from '../../api/row_data_utils';
import type {
  Explore,
  Field,
  AtomicField,
  StringField,
  NumberField,
  BooleanField,
  DateField,
  TimestampField,
  JSONField,
  UnsupportedField,
} from './core';
import {PreparedResult} from './core';

// =============================================================================
// Result
// =============================================================================

export type ResultJSON = {
  queryResult: QueryResult;
  modelDef: ModelDef;
};

/**
 * The result of running a Malloy query.
 *
 * A `Result` is a `PreparedResult` along with the data retrieved from running the query.
 */
export class Result extends PreparedResult {
  protected inner: QueryResult;

  constructor(queryResult: QueryResult, modelDef: ModelDef) {
    super(queryResult, modelDef);
    this.inner = queryResult;
  }

  public get _queryResult(): QueryResult {
    return this.inner;
  }

  /**
   * @return The result data.
   */
  public get data(): DataArray {
    return new DataArray(
      this.inner.result,
      this.resultExplore,
      undefined,
      undefined
    );
  }

  public get totalRows(): number {
    return this.inner.totalRows;
  }

  public get runStats(): QueryRunStats | undefined {
    return this.inner.runStats;
  }

  public get profilingUrl(): string | undefined {
    return this.inner.profilingUrl;
  }

  public toJSON(): ResultJSON {
    // DDL statements (INSTALL, LOAD, CREATE SECRET, etc.) don't have a schema,
    // so we can't call this.data.toJSON() which requires resultExplore.
    if (!this.hasSchema) {
      return {
        queryResult: this.inner,
        modelDef: this._modelDef,
      };
    }
    // The result rows are converted to JSON separately because they
    // may contain un-serializable data types.
    return {
      queryResult: {...this.inner, result: this.data.toJSON()},
      modelDef: this._modelDef,
    };
  }

  public static fromJSON({queryResult, modelDef}: ResultJSON): Result {
    return new Result(queryResult, modelDef);
  }
}

// =============================================================================
// Data Types
// =============================================================================

export type DataColumn =
  | DataArray
  | DataRecord
  | DataString
  | DataBoolean
  | DataNumber
  | DataDate
  | DataTimestamp
  | DataNull
  | DataBytes
  | DataJSON
  | DataUnsupported;

export type DataArrayOrRecord = DataArray | DataRecord;

// =============================================================================
// Data Base Classes
// =============================================================================

abstract class Data<T> {
  protected _field: Field | Explore;

  constructor(
    field: Field | Explore,
    public readonly parent: DataArrayOrRecord | undefined,
    public readonly parentRecord: DataRecord | undefined
  ) {
    this._field = field;
  }

  get field(): Field | Explore {
    return this._field;
  }

  public abstract get value(): T;

  isString(): this is DataString {
    return this instanceof DataString;
  }

  get string(): DataString {
    if (this.isString()) {
      return this;
    }
    throw new Error('Not a string.');
  }

  isBoolean(): this is DataBoolean {
    return this instanceof DataBoolean;
  }

  get boolean(): DataBoolean {
    if (this.isBoolean()) {
      return this;
    }
    throw new Error('Not a boolean.');
  }

  isNumber(): this is DataNumber {
    return this instanceof DataNumber;
  }

  get number(): DataNumber {
    if (this.isNumber()) {
      return this;
    }
    throw new Error('Not a number.');
  }

  isTimestamp(): this is DataTimestamp {
    return this instanceof DataTimestamp;
  }

  get timestamp(): DataTimestamp {
    if (this.isTimestamp()) {
      return this;
    }
    throw new Error('Not a timestamp.');
  }

  isDate(): this is DataDate {
    return this instanceof DataDate;
  }

  get date(): DataDate {
    if (this.isDate()) {
      return this;
    }
    throw new Error('Not a date.');
  }

  isNull(): this is DataNull {
    return this instanceof DataNull;
  }

  isBytes(): this is DataBytes {
    return this instanceof DataBytes;
  }

  get bytes(): DataBytes {
    if (this.isBytes()) {
      return this;
    }
    throw new Error('Not bytes.');
  }

  isRecord(): this is DataRecord {
    return this instanceof DataRecord;
  }

  get record(): DataRecord {
    if (this.isRecord()) {
      return this;
    }
    throw new Error('Not a record.');
  }

  isUnsupported(): this is DataUnsupported {
    return this instanceof DataUnsupported;
  }

  get unsupported(): DataUnsupported {
    if (this.isUnsupported()) {
      return this;
    }
    throw new Error('Not unsupported.');
  }

  isArray(): this is DataArray {
    return this instanceof DataArray;
  }

  get array(): DataArray {
    if (this.isArray()) {
      return this;
    }
    throw new Error('Not an array.');
  }

  isArrayOrRecord(): DataArrayOrRecord {
    if (this instanceof DataArray || this instanceof DataRecord) {
      return this;
    }
    throw new Error('No Array or Record');
  }

  public isScalar(): this is ScalarData<T> {
    return true;
  }
}

abstract class ScalarData<T> extends Data<T> {
  protected _value: T;
  protected _field: AtomicField;

  constructor(
    value: T,
    field: AtomicField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(field, parent, parentRecord);
    this._value = value;
    this._field = field;
  }

  public get value(): T {
    return this._value;
  }

  get field(): AtomicField {
    return this._field;
  }

  abstract get key(): string;

  isScalar(): this is ScalarData<T> {
    return this instanceof ScalarData;
  }

  abstract compareTo(other: ScalarData<T>): number;
}

// =============================================================================
// Scalar Data Classes
// =============================================================================

class DataString extends ScalarData<string> {
  protected _field: StringField;

  constructor(
    value: string,
    field: StringField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(value, field, parent, parentRecord);
    this._field = field;
  }

  get field(): StringField {
    return this._field;
  }

  get key(): string {
    return this.value;
  }

  compareTo(other: ScalarData<string>) {
    return this.value
      .toLocaleLowerCase()
      .localeCompare(other.value.toLocaleLowerCase());
  }
}

class DataUnsupported extends ScalarData<unknown> {
  protected _field: UnsupportedField;

  constructor(
    value: unknown,
    field: UnsupportedField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(value, field, parent, parentRecord);
    this._field = field;
  }

  get field(): UnsupportedField {
    return this._field;
  }

  get key(): string {
    return '<unsupported>';
  }

  compareTo(_other: ScalarData<unknown>) {
    return 0;
  }
}

class DataBoolean extends ScalarData<boolean> {
  protected _field: BooleanField;

  constructor(
    value: boolean,
    field: BooleanField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(value, field, parent, parentRecord);
    this._field = field;
  }

  get field(): BooleanField {
    return this._field;
  }

  get key(): string {
    return `${this.value}`;
  }

  compareTo(other: ScalarData<boolean>) {
    if (this.value === other.value) {
      return 0;
    }
    if (this.value) {
      return 1;
    }

    return -1;
  }
}

class DataJSON extends ScalarData<string> {
  protected _field: JSONField;

  constructor(
    value: string,
    field: JSONField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(value, field, parent, parentRecord);
    this._field = field;
  }

  get field(): JSONField {
    return this._field;
  }

  get key(): string {
    return this.value;
  }

  compareTo(other: ScalarData<string>) {
    const value = this.value.toString();
    const otherValue = other.toString();
    if (value === otherValue) {
      return 0;
    } else if (value > otherValue) {
      return 1;
    } else {
      return -1;
    }
  }
}

class DataNumber extends ScalarData<number> {
  protected _field: NumberField;

  constructor(
    value: unknown,
    field: NumberField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(rowDataToNumber(value), field, parent, parentRecord);
    this._field = field;
  }

  get field(): NumberField {
    return this._field;
  }

  get key(): string {
    return `${this.value}`;
  }

  compareTo(other: ScalarData<number>) {
    const difference = this.value - other.value;
    if (difference > 0) {
      return 1;
    } else if (difference === 0) {
      return 0;
    }

    return -1;
  }
}

class DataTimestamp extends ScalarData<Date> {
  protected _field: TimestampField;

  constructor(
    value: Date,
    field: TimestampField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(value, field, parent, parentRecord);
    this._field = field;
  }

  public get value(): Date {
    return rowDataToDate(this._value);
  }

  get field(): TimestampField {
    return this._field;
  }

  get key(): string {
    return `${this.value.toLocaleString()}`;
  }

  compareTo(other: ScalarData<Date>) {
    if (this.value > other.value) {
      return 1;
    } else if (this.value < other.value) {
      return -1;
    }

    return 0;
  }
}

class DataDate extends ScalarData<Date> {
  protected _field: DateField;

  constructor(
    value: Date,
    field: DateField,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(value, field, parent, parentRecord);
    this._field = field;
  }

  public get value(): Date {
    return rowDataToDate(this._value);
  }

  get field(): DateField {
    return this._field;
  }

  get key(): string {
    return `${this.value.toLocaleString()}`;
  }

  compareTo(other: ScalarData<Date>) {
    if (this.value > other.value) {
      return 1;
    } else if (this.value < other.value) {
      return -1;
    }

    return 0;
  }
}

class DataBytes extends ScalarData<Buffer> {
  get key(): string {
    return this.value.toString();
  }

  compareTo(other: ScalarData<Buffer>) {
    const value = this.value.toString();
    const otherValue = other.toString();
    if (value === otherValue) {
      return 0;
    } else if (value > otherValue) {
      return 1;
    } else {
      return -1;
    }
  }
}

class DataNull extends Data<null> {
  public get value(): null {
    return null;
  }

  get key(): string {
    return '<null>';
  }
}

// =============================================================================
// Data Normalizers
// =============================================================================

/**
 * Normalizers for converting raw row data values to specific output formats.
 */
interface DataNormalizers {
  number: (value: unknown) => number;
  bigint: (value: unknown) => number | bigint | string;
  date: (value: unknown) => Date | string;
}

/**
 * Safe bigint conversion - handles floats that are incorrectly typed as bigint
 * (e.g., avg() results which should be float but Malloy marks as bigint).
 */
function safeRowDataToBigint(value: unknown): bigint | number {
  const strValue = rowDataToSerializedBigint(value);
  if (
    strValue.includes('.') ||
    strValue.includes('e') ||
    strValue.includes('E')
  ) {
    return rowDataToNumber(value);
  }
  try {
    return BigInt(strValue);
  } catch {
    return rowDataToNumber(value);
  }
}

/**
 * Safe bigint serialization - returns number for floats that should stay as numbers.
 */
function safeRowDataToSerializedBigint(value: unknown): string | number {
  const strValue = rowDataToSerializedBigint(value);
  if (
    strValue.includes('.') ||
    strValue.includes('e') ||
    strValue.includes('E')
  ) {
    return rowDataToNumber(value);
  }
  return strValue;
}

/**
 * Normalizers for toObject() - returns JS native types (number | bigint, Date)
 */
const OBJECT_NORMALIZERS: DataNormalizers = {
  number: rowDataToNumber,
  bigint: safeRowDataToBigint,
  date: rowDataToDate,
};

/**
 * Normalizers for toJSON() - returns JSON-safe types (number | string, ISO strings)
 */
const JSON_NORMALIZERS: DataNormalizers = {
  number: rowDataToNumber,
  bigint: safeRowDataToSerializedBigint,
  date: (value: unknown) => rowDataToDate(value).toISOString(),
};

/**
 * Walk a QueryData array and normalize values according to the given normalizers.
 */
function walkQueryData(
  data: QueryData,
  structDef: StructDef,
  normalizers: DataNormalizers
): QueryData {
  return data.map(row => walkQueryDataRow(row, structDef, normalizers));
}

/**
 * Walk a QueryDataRow and normalize values according to the given normalizers.
 */
function walkQueryDataRow(
  row: QueryDataRow,
  structDef: StructDef,
  normalizers: DataNormalizers
): QueryDataRow {
  const result: QueryDataRow = {};
  for (const fieldDef of structDef.fields) {
    const fieldName = fieldDef.as ?? fieldDef.name;
    const value = row[fieldName];
    result[fieldName] = walkValue(value, fieldDef, normalizers);
  }
  return result;
}

/**
 * Normalize a single value based on its field definition.
 */
function walkValue(
  value: QueryValue,
  fieldDef: FieldDef,
  normalizers: DataNormalizers
): QueryValue {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle scalar types
  if (fieldDef.type === 'number') {
    const numberDef = fieldDef as NumberFieldDef;
    if (numberDef.numberType === 'bigint') {
      return normalizers.bigint(value);
    }
    return normalizers.number(value);
  }

  if (
    fieldDef.type === 'date' ||
    fieldDef.type === 'timestamp' ||
    fieldDef.type === 'timestamptz'
  ) {
    return normalizers.date(value);
  }

  if (
    fieldDef.type === 'string' ||
    fieldDef.type === 'boolean' ||
    fieldDef.type === 'json' ||
    fieldDef.type === 'sql native'
  ) {
    // Pass through as-is (or with minimal conversion for booleans from numbers)
    if (fieldDef.type === 'boolean' && typeof value === 'number') {
      return value !== 0;
    }
    return value;
  }

  // Handle arrays
  if (fieldDef.type === 'array') {
    if (!Array.isArray(value)) {
      return value; // Unexpected, but don't crash
    }

    if (isRepeatedRecord(fieldDef)) {
      // Array of records - recurse into each record
      return value.map(item =>
        walkQueryDataRow(
          item as QueryDataRow,
          fieldDef as StructDef,
          normalizers
        )
      );
    } else if (isBasicArray(fieldDef)) {
      // Scalar array - normalize each element based on elementTypeDef
      // Cast needed because QueryValue type doesn't cleanly express scalar arrays
      const elementType = fieldDef.elementTypeDef as AtomicTypeDef;
      return value.map(item =>
        walkScalarValue(item, elementType, normalizers)
      ) as QueryValue;
    }
  }

  // Handle records (non-array)
  if (fieldDef.type === 'record') {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return walkQueryDataRow(
        value as QueryDataRow,
        fieldDef as StructDef,
        normalizers
      );
    }
  }

  // Fallback - pass through
  return value;
}

/**
 * Normalize a scalar value (not in a row context, e.g., elements of a scalar array).
 */
function walkScalarValue(
  value: unknown,
  typeDef: AtomicTypeDef,
  normalizers: DataNormalizers
): QueryValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeDef.type === 'number') {
    const numberDef = typeDef as {type: 'number'; numberType?: string};
    if (numberDef.numberType === 'bigint') {
      return normalizers.bigint(value);
    }
    return normalizers.number(value);
  }

  if (
    typeDef.type === 'date' ||
    typeDef.type === 'timestamp' ||
    typeDef.type === 'timestamptz'
  ) {
    return normalizers.date(value);
  }

  if (typeDef.type === 'boolean' && typeof value === 'number') {
    return value !== 0;
  }

  // Handle nested arrays (array of arrays)
  if (typeDef.type === 'array' && Array.isArray(value)) {
    if (isBasicArray(typeDef)) {
      const elementType = typeDef.elementTypeDef as AtomicTypeDef;
      return value.map(item =>
        walkScalarValue(item, elementType, normalizers)
      ) as QueryValue;
    } else if (isRepeatedRecord(typeDef)) {
      return value.map(item =>
        walkQueryDataRow(
          item as QueryDataRow,
          typeDef as StructDef,
          normalizers
        )
      ) as QueryValue;
    }
  }

  // Pass through other types
  return value as QueryValue;
}

// =============================================================================
// DataArray and DataRecord
// =============================================================================

function getPath(data: DataColumn, path: (number | string)[]): DataColumn {
  for (const segment of path) {
    if (typeof segment === 'number') {
      data = data.array.row(segment);
    } else {
      data = data.record.cell(segment);
    }
  }
  return data;
}

export class DataArray extends Data<QueryData> implements Iterable<DataRecord> {
  private queryData: QueryData;
  protected _field: Explore;
  private rowCache: Map<number, DataRecord> = new Map();

  constructor(
    queryData: QueryData,
    field: Explore,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(field, parent, parentRecord);
    this.queryData = queryData;
    this._field = field;
  }

  /**
   * @return The `Explore` that describes the structure of this data.
   */
  public get field(): Explore {
    return this._field;
  }

  /**
   * @return The raw query data as returned by the database driver.
   * Values may be in various formats depending on the driver (wrapper objects, strings, etc.).
   * Use this for passing to mapData() which handles normalization itself.
   */
  public get rawData(): QueryData {
    return this.queryData;
  }

  /**
   * @return Normalized data with JS native types (number | bigint, Date).
   * Use this for CSV output, tests, and general programmatic access.
   */
  public toObject(): QueryData {
    return walkQueryData(
      this.queryData,
      this._field.structDef,
      OBJECT_NORMALIZERS
    );
  }

  /**
   * @return Normalized data with JSON-safe types (numbers as number | string, dates as ISO strings).
   * Use this for JSON serialization.
   */
  public toJSON(): QueryData {
    return walkQueryData(
      this.queryData,
      this._field.structDef,
      JSON_NORMALIZERS
    );
  }

  path(...path: (number | string)[]): DataColumn {
    return getPath(this, path);
  }

  row(index: number): DataRecord {
    let record = this.rowCache.get(index);
    if (!record) {
      record = new DataRecord(
        this.queryData[index],
        index,
        this.field,
        this,
        this.parentRecord
      );
      this.rowCache.set(index, record);
    }
    return record;
  }

  get rowCount(): number {
    return this.queryData.length;
  }

  public get value(): QueryData {
    return this.toObject();
  }

  [Symbol.iterator](): Iterator<DataRecord> {
    let currentIndex = 0;
    const queryData = this.queryData;
    const getRow = (index: number) => this.row(index);
    return {
      next(): IteratorResult<DataRecord> {
        if (currentIndex < queryData.length) {
          return {value: getRow(currentIndex++), done: false};
        } else {
          return {value: undefined, done: true};
        }
      },
    };
  }

  async *inMemoryStream(): AsyncIterableIterator<DataRecord> {
    for (let i = 0; i < this.queryData.length; i++) {
      yield this.row(i);
    }
  }
}

export class DataRecord extends Data<{[fieldName: string]: DataColumn}> {
  private queryDataRow: QueryDataRow;
  protected _field: Explore;
  public readonly index: number | undefined;
  private cellCache: Map<string, DataColumn> = new Map();

  constructor(
    queryDataRow: QueryDataRow,
    index: number | undefined,
    field: Explore,
    parent: DataArrayOrRecord | undefined,
    parentRecord: DataRecord | undefined
  ) {
    super(field, parent, parentRecord);
    this.queryDataRow = queryDataRow;
    this._field = field;
    this.index = index;
  }

  /**
   * @return Normalized data with JS native types (number | bigint, Date).
   * Use this for CSV output, tests, and general programmatic access.
   */
  toObject(): QueryDataRow {
    return walkQueryDataRow(
      this.queryDataRow,
      this._field.structDef,
      OBJECT_NORMALIZERS
    );
  }

  /**
   * @return Normalized data with JSON-safe types (numbers as number | string, dates as ISO strings).
   * Use this for JSON serialization.
   */
  toJSON(): QueryDataRow {
    return walkQueryDataRow(
      this.queryDataRow,
      this._field.structDef,
      JSON_NORMALIZERS
    );
  }

  path(...path: (number | string)[]): DataColumn {
    return getPath(this, path);
  }

  cell(fieldOrName: string | Field): DataColumn {
    const fieldName =
      typeof fieldOrName === 'string' ? fieldOrName : fieldOrName.name;
    const field = this._field.getFieldByName(fieldName);
    let column = this.cellCache.get(fieldName);
    if (!column) {
      const value = this.queryDataRow[fieldName];
      if (value === null) {
        column = new DataNull(field, this, this);
      } else if (field.isAtomicField()) {
        if (field.isBoolean()) {
          column = new DataBoolean(value as boolean, field, this, this);
        } else if (field.isDate()) {
          column = new DataDate(value as Date, field, this, this);
        } else if (field.isJSON()) {
          column = new DataJSON(value as string, field, this, this);
        } else if (field.isTimestamp()) {
          column = new DataTimestamp(value as Date, field, this, this);
        } else if (field.isNumber()) {
          column = new DataNumber(value as number, field, this, this);
        } else if (field.isString()) {
          column = new DataString(value as string, field, this, this);
        } else if (field.isUnsupported()) {
          column = new DataUnsupported(value as unknown, field, this, this);
        }
      } else if (field.isExploreField()) {
        if (Array.isArray(value)) {
          column = new DataArray(value, field, this, this);
        } else {
          column = new DataRecord(
            value as QueryDataRow,
            undefined,
            field,
            this,
            this
          );
        }
      }
      if (column) this.cellCache.set(fieldName, column);
    }

    if (column) return column;

    throw new Error(
      `Internal Error: could not construct data column for field '${fieldName}'.`
    );
  }

  public get value(): {[fieldName: string]: DataColumn} {
    throw new Error('Not implemented;');
  }

  // Non repeating values show up as DataRecords
  public get field(): Explore {
    return this._field;
  }

  // Allow iteration over non repeating values to simplify end user code.
  [Symbol.iterator](): Iterator<DataRecord> {
    let returned = false;
    const getSelf = () => {
      return this;
    };
    return {
      next(): IteratorResult<DataRecord> {
        if (!returned) {
          returned = true;
          return {
            value: getSelf(),
            done: false,
          };
        } else {
          return {value: undefined, done: true};
        }
      },
    };
  }
}
