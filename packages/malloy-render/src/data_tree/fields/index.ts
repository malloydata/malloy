import type * as Malloy from '@malloydata/malloy-interfaces';
import {
  isBooleanFieldInfo,
  isDateFieldInfo,
  isJSONFieldInfo,
  isNumberFieldInfo,
  isRecordFieldInfo,
  isRepeatedRecordFieldInfo,
  isArrayFieldInfo,
  isSQLNativeFieldInfo,
  isStringFieldInfo,
  isTimestampFieldInfo,
} from '../utils';
import {
  BooleanField,
  DateField,
  JSONField,
  NumberField,
  SQLNativeField,
  StringField,
  TimestampField,
} from './atomic';
import {ArrayField, RecordField, RepeatedRecordField} from './nest';

export {ArrayField, RecordField, RepeatedRecordField, RootField} from './nest';
export {
  BooleanField,
  DateField,
  JSONField,
  NumberField,
  SQLNativeField,
  StringField,
  TimestampField,
} from './atomic';

export type Field =
  | ArrayField
  | RepeatedRecordField
  | RecordField
  | NumberField
  | DateField
  | JSONField
  | StringField
  | TimestampField
  | BooleanField
  | SQLNativeField;

export type NestField = RepeatedRecordField | RecordField;
export type RecordOrRepeatedRecordField = RepeatedRecordField | RecordField;
export type BasicAtomicField =
  | NumberField
  | DateField
  | JSONField
  | StringField
  | TimestampField
  | BooleanField
  | SQLNativeField;
export type TimeField = DateField | TimestampField;

export const Field = {
  from(field: Malloy.DimensionInfo, parent: Field | undefined): Field {
    if (isRepeatedRecordFieldInfo(field)) {
      return new RepeatedRecordField(field, parent);
    } else if (isArrayFieldInfo(field)) {
      return new ArrayField(field, parent);
    } else if (isRecordFieldInfo(field)) {
      return new RecordField(field, parent);
    } else if (isBooleanFieldInfo(field)) {
      return new BooleanField(field, parent);
    } else if (isJSONFieldInfo(field)) {
      return new JSONField(field, parent);
    } else if (isDateFieldInfo(field)) {
      return new DateField(field, parent);
    } else if (isTimestampFieldInfo(field)) {
      return new TimestampField(field, parent);
    } else if (isStringFieldInfo(field)) {
      return new StringField(field, parent);
    } else if (isNumberFieldInfo(field)) {
      return new NumberField(field, parent);
    } else if (isSQLNativeFieldInfo(field)) {
      return new SQLNativeField(field, parent);
    } else {
      throw new Error(`Unknown field type ${field.type.kind}`);
    }
  },
  isNestField(field: Field): field is NestField {
    return field instanceof RepeatedRecordField || field instanceof RecordField;
  },
  pathFromString(path: string) {
    return JSON.parse(path);
  },
  pathToString(path: string) {
    return JSON.stringify(path);
  },
};
