import type {NestField} from '.';
import type {
  BooleanFieldInfo,
  DateFieldInfo,
  JSONFieldInfo,
  NumberFieldInfo,
  SQLNativeFieldInfo,
  StringFieldInfo,
  TimestampFieldInfo,
} from '../types';
import type {RenderFieldRegistry} from '../../registry/types';
import {FieldBase} from './base';
import {renderTimeString} from '../../util';

export class NumberField extends FieldBase {
  public min: number | undefined = undefined;
  public max: number | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: NumberFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }

  registerValue(value: number) {
    this.valueSet.add(value);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    }
    if (this.min === undefined || value < this.min) {
      this.min = value;
    }
    const str = value.toString(); // TODO what locale?
    if (this._maxString === undefined || str.length > this._maxString.length) {
      this._maxString = str;
    }
  }

  fieldAtPath(path: string[]) {
    if (path.length === 0) {
      return this.asField();
    }
    throw new Error('NumberField cannot contain fields');
  }

  get minNumber() {
    return this.min;
  }

  get maxNumber() {
    return this.max;
  }

  get maxString(): string | undefined {
    return this._maxString;
  }
}

export class DateField extends FieldBase {
  public min: Date | undefined = undefined;
  public max: Date | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: DateFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }

  get timeframe() {
    return this.field.type.timeframe;
  }

  registerValue(value: Date) {
    const numberValue = Number(value);
    this.valueSet.add(numberValue);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    }
    if (this.min === undefined || value < this.min) {
      this.min = value;
    }
    const stringValue = renderTimeString(
      value,
      true,
      this.timeframe
    ).toString();
    if (
      this._maxString === undefined ||
      stringValue.length > this._maxString.length
    ) {
      this._maxString = stringValue;
    }
  }

  get minValue(): Date | undefined {
    return this.min;
  }

  get maxValue(): Date | undefined {
    return this.max;
  }

  get maxString(): string | undefined {
    return this._maxString;
  }

  get minNumber(): number | undefined {
    return this.min !== undefined ? Number(this.min) : undefined;
  }

  get maxNumber(): number | undefined {
    return this.max !== undefined ? Number(this.max) : undefined;
  }
}

export class TimestampField extends FieldBase {
  public min: Date | undefined = undefined;
  public max: Date | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: TimestampFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }

  get timeframe() {
    return this.field.type.timeframe;
  }

  registerValue(value: Date) {
    const numberValue = Number(value);
    this.valueSet.add(numberValue);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    }
    if (this.min === undefined || value < this.min) {
      this.min = value;
    }
    const stringValue = renderTimeString(
      value,
      false,
      this.timeframe
    ).toString();
    if (
      this._maxString === undefined ||
      stringValue.length > this._maxString.length
    ) {
      this._maxString = stringValue;
    }
  }

  get minValue(): Date | undefined {
    return this.min;
  }

  get maxValue(): Date | undefined {
    return this.max;
  }

  get maxString(): string | undefined {
    return this._maxString;
  }
}

export class StringField extends FieldBase {
  public min: string | undefined = undefined;
  public max: string | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: StringFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }

  registerValue(value: string) {
    this.valueSet.add(value);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    }
    if (this.min === undefined || value < this.min) {
      this.min = value;
    }
    if (
      this._maxString === undefined ||
      value.length > this._maxString.length
    ) {
      this._maxString = value;
    }
  }

  get minValue(): string | undefined {
    return this.min;
  }

  get maxValue(): string | undefined {
    return this.max;
  }

  get maxString(): string | undefined {
    return this._maxString;
  }
}

export class SQLNativeField extends FieldBase {
  constructor(
    public readonly field: SQLNativeFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }
}

export class JSONField extends FieldBase {
  constructor(
    public readonly field: JSONFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }
}

export class BooleanField extends FieldBase {
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: BooleanFieldInfo,
    parent: NestField | undefined,
    registry?: RenderFieldRegistry
  ) {
    super(field, parent, registry);
  }

  get maxString(): string | undefined {
    return this._maxString;
  }

  registerValue(value: boolean) {
    this.valueSet.add(value);
    const stringValue = String(value);
    if (
      this._maxString === undefined ||
      this._maxString.length < stringValue.length
    ) {
      this._maxString = stringValue;
    }
  }
}
