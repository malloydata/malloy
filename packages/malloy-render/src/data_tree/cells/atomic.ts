import type * as Malloy from '@malloydata/malloy-interfaces';
import type {
  BooleanField,
  DateField,
  Field,
  JSONField,
  NumberField,
  SQLNativeField,
  StringField,
  TimestampField,
} from '../fields';
import {CellBase} from './base';
import type {Cell, NestCell} from '.';

export class NullCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithNullCell,
    public readonly field: Field,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.field.registerNullValue();
  }

  get value() {
    return null;
  }

  get literalValue(): Malloy.LiteralValue | undefined {
    return {
      kind: 'null_literal',
    };
  }
}

export class NumberCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithNumberCell,
    public readonly field: NumberField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.field.registerValue(this.value);
  }

  get value() {
    return this.cell.number_value;
  }

  compareTo(other: Cell) {
    if (!other.isNumber()) return 0;
    if (this.value > other.value) {
      return 1;
    } else if (this.value < other.value) {
      return -1;
    }

    return 0;
  }

  get literalValue(): Malloy.LiteralValue | undefined {
    return {
      kind: 'number_literal',
      number_value: this.cell.number_value,
    };
  }
}

export class DateCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithDateCell,
    public readonly field: DateField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.field.registerValue(this.value);
  }

  get value() {
    return new Date(this.cell.date_value);
  }

  get timeframe() {
    return this.field.timeframe;
  }

  compareTo(other: Cell) {
    if (!other.isTime()) return 0;
    if (this.value > other.value) {
      return 1;
    } else if (this.value < other.value) {
      return -1;
    }
    return 0;
  }

  get literalValue(): Malloy.LiteralValue | undefined {
    return {
      kind: 'date_literal',
      date_value: this.cell.date_value,
      granularity: this.timeframe,
    };
  }
}

export class TimestampCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithTimestampCell,
    public readonly field: TimestampField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.field.registerValue(this.value);
  }

  get value() {
    return new Date(this.cell.timestamp_value);
  }

  get timeframe() {
    return this.field.timeframe;
  }

  compareTo(other: Cell) {
    if (!other.isTime()) return 0;
    if (this.value > other.value) {
      return 1;
    } else if (this.value < other.value) {
      return -1;
    }
    return 0;
  }

  get literalValue(): Malloy.LiteralValue | undefined {
    return {
      kind: 'timestamp_literal',
      timestamp_value: this.cell.timestamp_value,
      granularity: this.timeframe,
    };
  }
}

export class JSONCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithJSONCell,
    public readonly field: JSONField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
  }

  get value() {
    try {
      return JSON.parse(this.cell.json_value);
    } catch {
      return this.cell.json_value;
    }
  }

  compareTo(other: Cell) {
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

export class SQLNativeCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithSQLNativeCell,
    public readonly field: SQLNativeField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
  }

  get value() {
    try {
      return JSON.parse(this.cell.sql_native_value);
    } catch {
      return this.cell.sql_native_value;
    }
  }

  compareTo(other: Cell) {
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

export class StringCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithStringCell,
    public readonly field: StringField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.field.registerValue(this.value);
  }

  get value() {
    return this.cell.string_value;
  }

  compareTo(other: Cell) {
    if (!other.isString()) return 0;
    return this.value
      .toLocaleLowerCase()
      .localeCompare(other.value.toLocaleLowerCase());
  }

  get literalValue(): Malloy.LiteralValue | undefined {
    return {
      kind: 'string_literal',
      string_value: this.cell.string_value,
    };
  }
}

export class BooleanCell extends CellBase {
  constructor(
    public readonly cell: Malloy.CellWithBooleanCell,
    public readonly field: BooleanField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.field.registerValue(this.value);
  }

  get value() {
    return this.cell.boolean_value;
  }

  compareTo(other: Cell) {
    if (this.value === other.value) {
      return 0;
    }
    if (this.value) {
      return 1;
    }

    return -1;
  }

  get literalValue(): Malloy.LiteralValue | undefined {
    return {
      kind: 'boolean_literal',
      boolean_value: this.cell.boolean_value,
    };
  }
}
