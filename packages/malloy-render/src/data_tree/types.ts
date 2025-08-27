import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Field} from './fields';
import type {Cell} from './cells';

export type DrillEntry =
  | {
      field: Field;
      value: string | number | bigint | boolean | Date | null;
    }
  | {where: string};

export type DrillValue = {field: Field; value: Cell} | {where: string};

export type SortableField = {field: Field; dir: 'asc' | 'desc' | undefined};

export type ArrayFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithArrayType;
};

export type RepeatedRecordFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithArrayType & {
    element_type: Malloy.AtomicTypeWithRecordType;
  };
};

export type RecordFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithRecordType;
};

export type NumberFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithNumberType;
};

export type DateFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithDateType;
};

export type JSONFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithJSONType;
};

export type StringFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithStringType;
};

export type TimestampFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithTimestampType;
};

export type BooleanFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithBooleanType;
};

export type SQLNativeFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithSQLNativeType;
};

export enum FieldType {
  Array = 'array',
  RepeatedRecord = 'repeated_record',
  Record = 'record',
  Number = 'number',
  Date = 'date',
  JSON = 'json',
  String = 'string',
  Timestamp = 'timestamp',
  Boolean = 'boolean',
  SQLNative = 'sql_native',
}
