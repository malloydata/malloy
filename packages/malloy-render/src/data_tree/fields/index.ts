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
import type {RenderFieldRegistry} from '../../registry/types';

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

export type NestField = RepeatedRecordField | RecordField | ArrayField;
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
  from(
    field: Malloy.DimensionInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ): Field {
    if (isRepeatedRecordFieldInfo(field)) {
      return new RepeatedRecordField(field, parent, registry);
    } else if (isArrayFieldInfo(field)) {
      return new ArrayField(field, parent, registry);
    } else if (isRecordFieldInfo(field)) {
      return new RecordField(field, parent, registry);
    } else if (isBooleanFieldInfo(field)) {
      return new BooleanField(field, parent, registry);
    } else if (isJSONFieldInfo(field)) {
      return new JSONField(field, parent, registry);
    } else if (isDateFieldInfo(field)) {
      return new DateField(field, parent, registry);
    } else if (isTimestampFieldInfo(field)) {
      return new TimestampField(field, parent, registry);
    } else if (isStringFieldInfo(field)) {
      return new StringField(field, parent, registry);
    } else if (isNumberFieldInfo(field)) {
      return new NumberField(field, parent, registry);
    } else if (isSQLNativeFieldInfo(field)) {
      return new SQLNativeField(field, parent, registry);
    } else {
      throw new Error(`Unknown field type ${field.type.kind}`);
    }
  },
  isNestField(field: Field): field is NestField {
    return (
      field instanceof RepeatedRecordField ||
      field instanceof ArrayField ||
      field instanceof RecordField
    );
  },
  pathFromString(path: string) {
    return JSON.parse(path);
  },
  pathToString(path: string) {
    return JSON.stringify(path);
  },
};
