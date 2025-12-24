import type * as Malloy from '@malloydata/malloy-interfaces';
import {
  ArrayField,
  BooleanField,
  DateField,
  type Field,
  JSONField,
  NumberField,
  RecordField,
  RepeatedRecordField,
  SQLNativeField,
  StringField,
  TimestampField,
} from '../fields';
import {ArrayCell, RecordCell, RepeatedRecordCell} from './nest';
import {
  BooleanCell,
  DateCell,
  JSONCell,
  NullCell,
  NumberCell,
  SQLNativeCell,
  StringCell,
  TimestampCell,
} from './atomic';

export {ArrayCell, RecordCell, RepeatedRecordCell, RootCell} from './nest';
export {
  BooleanCell,
  DateCell,
  JSONCell,
  NullCell,
  NumberCell,
  SQLNativeCell,
  StringCell,
  TimestampCell,
} from './atomic';

export type NestCell = ArrayCell | RecordCell;
export type RecordOrRepeatedRecordCell = RepeatedRecordCell | RecordCell;
export type TimeCell = DateCell | TimestampCell;

export type Cell =
  | ArrayCell
  | RecordCell
  | NullCell
  | NumberCell
  | DateCell
  | JSONCell
  | StringCell
  | TimestampCell
  | BooleanCell
  | SQLNativeCell;

export type CellValue =
  | string
  | number
  | boolean
  | Date
  | Cell[]
  | Record<string, Cell>
  | null;

export const Cell = {
  from(cell: Malloy.Cell, field: Field, parent: NestCell): Cell {
    switch (cell.kind) {
      case 'array_cell': {
        if (field instanceof RepeatedRecordField) {
          return new RepeatedRecordCell(cell, field, parent);
        } else if (field instanceof ArrayField) {
          return new ArrayCell(cell, field, parent);
        }
        throw new Error(
          'Expected record data to be associated with record field'
        );
      }
      case 'record_cell': {
        if (field instanceof RecordField) {
          return new RecordCell(cell, field, parent);
        }
        throw new Error(
          'Expected record data to be associated with record field'
        );
      }
      case 'null_cell':
        return new NullCell(cell, field, parent);
      case 'number_cell':
      case 'big_number_cell': {
        if (field instanceof NumberField) {
          return new NumberCell(cell, field, parent);
        }
        throw new Error(
          'Expected number data to be associated with number field'
        );
      }
      case 'date_cell': {
        if (field instanceof DateField) {
          return new DateCell(cell, field, parent);
        }
        throw new Error('Expected date data to be associated with date field');
      }
      case 'json_cell': {
        if (field instanceof JSONField) {
          return new JSONCell(cell, field, parent);
        }
        throw new Error('Expected JSON data to be associated with JSON field');
      }
      case 'string_cell': {
        if (field instanceof StringField) {
          return new StringCell(cell, field, parent);
        }
        throw new Error(
          'Expected string data to be associated with string field'
        );
      }
      case 'timestamp_cell': {
        if (field instanceof TimestampField) {
          return new TimestampCell(cell, field, parent);
        }
        throw new Error(
          'Expected timestamp data to be associated with timestamp field'
        );
      }
      case 'boolean_cell': {
        if (field instanceof BooleanField) {
          return new BooleanCell(cell, field, parent);
        }
        throw new Error(
          'Expected boolean data to be associated with boolean field'
        );
      }
      case 'sql_native_cell': {
        if (field instanceof SQLNativeField) {
          return new SQLNativeCell(cell, field, parent);
        }
        throw new Error(
          'Expected sql_native data to be associated with sql_native field'
        );
      }
    }
  },
};
