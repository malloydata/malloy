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

import {Tag} from '@malloydata/malloy-tag';
import {NestFieldInfo} from './util';
import {VegaChartProps, VegaConfigHandler} from './types';
import {mergeVegaConfigs} from './vega/merge-vega-configs';
import {baseVegaConfig} from './vega/base-vega-config';
import {renderTimeString} from './render-time';
import {generateBarChartVegaSpec} from './bar-chart/generate-bar_chart-vega-spec';
import {createResultStore, ResultStore} from './result-store/result-store';
import {generateLineChartVegaSpec} from './line-chart/generate-line_chart-vega-spec';
import {parse, Config, Runtime} from 'vega';
import * as Malloy from '@malloydata/malloy-interfaces';
import {NULL_SYMBOL} from './apply-renderer';

export type GetResultMetadataOptions = {
  getVegaConfigOverride?: VegaConfigHandler;
};

export function getResultMetadata(
  result: Malloy.Result,
  options: GetResultMetadataOptions = {}
) {
  const fields: Malloy.DimensionInfo[] = [];
  for (const field of result.schema.fields) {
    if (field.kind === 'dimension') {
      fields.push(field);
    }
  }
  const rootField: NestFieldInfo = {
    name: 'root',
    type: {
      kind: 'array_type',
      element_type: {
        kind: 'record_type',
        fields,
      },
    },
    annotations: result.annotations,
  };

  const rootFieldMeta = new RootField(rootField, {
    modelTag: tagFromAnnotations(result.model_annotations, '## '),
    store: createResultStore(),
    sourceName: 'foo', // TODO);
  });
  const cell: Malloy.DataWithArrayCell =
    result.data!.kind === 'record_cell'
      ? {kind: 'array_cell', array_value: [result.data!]}
      : result.data!;
  const rootCell = new RootCell(cell, rootFieldMeta);
  rootFieldMeta.populateAllVegaSpecs(options);

  console.log({rootCell, rootFieldMeta});

  return rootCell;
}

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
// TODO should be renamed LeafAtomicField
export type AtomicField =
  | NumberField
  | DateField
  | JSONField
  | StringField
  | TimestampField
  | BooleanField
  | SQLNativeField;
export type TimeField = DateField | TimestampField;

type ArrayFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithArrayType;
};

type RepeatedRecordFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithArrayType & {
    element_type: Malloy.AtomicTypeWithRecordType;
  };
};

type RecordFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithRecordType;
};

type NumberFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithNumberType;
};

type DateFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithDateType;
};

type JSONFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithJSONType;
};

type StringFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithStringType;
};

type TimestampFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithTimestampType;
};

type BooleanFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithBooleanType;
};

type SQLNativeFieldInfo = Malloy.DimensionInfo & {
  type: Malloy.AtomicTypeWithSQLNativeType;
};

function isArrayFieldInfo(
  field: Malloy.DimensionInfo
): field is ArrayFieldInfo {
  return field.type.kind === 'array_type';
}

function isRepeatedRecordFieldInfo(
  field: Malloy.DimensionInfo
): field is RepeatedRecordFieldInfo {
  return (
    field.type.kind === 'array_type' &&
    field.type.element_type.kind === 'record_type'
  );
}

function isRecordFieldInfo(
  field: Malloy.DimensionInfo
): field is RecordFieldInfo {
  return field.type.kind === 'record_type';
}

function isNumberFieldInfo(
  field: Malloy.DimensionInfo
): field is NumberFieldInfo {
  return field.type.kind === 'number_type';
}

function isDateFieldInfo(field: Malloy.DimensionInfo): field is DateFieldInfo {
  return field.type.kind === 'date_type';
}

function isJSONFieldInfo(field: Malloy.DimensionInfo): field is JSONFieldInfo {
  return field.type.kind === 'json_type';
}

function isStringFieldInfo(
  field: Malloy.DimensionInfo
): field is StringFieldInfo {
  return field.type.kind === 'string_type';
}

function isTimestampFieldInfo(
  field: Malloy.DimensionInfo
): field is TimestampFieldInfo {
  return field.type.kind === 'timestamp_type';
}

function isBooleanFieldInfo(
  field: Malloy.DimensionInfo
): field is BooleanFieldInfo {
  return field.type.kind === 'boolean_type';
}

function isSQLNativeFieldInfo(
  field: Malloy.DimensionInfo
): field is SQLNativeFieldInfo {
  return field.type.kind === 'sql_native_type';
}

export const Field = {
  from(field: Malloy.DimensionInfo, parent: NestField | undefined): Field {
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
    return (
      field instanceof RepeatedRecordField ||
      field instanceof ArrayField ||
      field instanceof RecordField
    );
  },
  pathFromString(path: string) {
    if (path === '') return [];
    return path.split('///'); // TODO this won't work for fields with dots in their names?
  },
  pathStringToPath(path: string[]) {
    return path.join('///'); // TODO this won't work for fields with dots in their names?
  },
};

function tagFromAnnotations(
  annotations: Malloy.Annotation[] | undefined,
  prefix = '# '
) {
  const tagLines =
    annotations?.map(a => a.value)?.filter(l => l.startsWith(prefix)) ?? [];
  return Tag.fromTagLines(tagLines).tag ?? new Tag();
}

function tagFor(field: Malloy.DimensionInfo, prefix = '# ') {
  return tagFromAnnotations(field.annotations, prefix);
}

const RENDER_TAG_LIST = [
  'link',
  'image',
  'cell',
  'list',
  'list_detail',
  'bar_chart',
  'line_chart',
  'dashboard',
  'scatter_chart',
  'shape_map',
  'segment_map',
];

const CHART_TAG_LIST = ['bar_chart', 'line_chart'];

export function shouldRenderChartAs(tag: Tag) {
  const tagNamesInOrder = Object.keys(tag.properties ?? {}).reverse();
  return tagNamesInOrder.find(name => CHART_TAG_LIST.includes(name));
}

export function shouldRenderAs(
  field: Malloy.DimensionInfo,
  parent: Field | undefined,
  tagOverride?: Tag
) {
  const tag = tagOverride ?? tagFor(field);
  const tagNamesInOrder = Object.keys(tag.properties ?? {}).reverse();
  for (const tagName of tagNamesInOrder) {
    if (RENDER_TAG_LIST.includes(tagName)) {
      if (['list', 'list_detail'].includes(tagName)) return 'list';
      if (['bar_chart', 'line_chart'].includes(tagName)) return 'chart';
      return tagName;
    }
  }

  if (field.type.kind === 'record_type' && parent?.renderAs === 'chart') {
    return 'none';
  }

  const isNest =
    field.type.kind === 'array_type' || field.type.kind === 'record_type';

  if (!isNest) return 'cell';
  return 'table';
}

export abstract class FieldBase {
  public readonly tag: Tag;
  public readonly path: string[];
  private readonly metadataTag: Tag;
  public readonly renderAs: string;
  public readonly valueSet = new Set<string | number | boolean>();
  constructor(
    public readonly field: Malloy.DimensionInfo,
    public readonly parent: NestField | undefined
  ) {
    this.tag = tagFor(this.field);
    this.metadataTag = tagFor(this.field, '#(malloy) ');
    this.path = parent
      ? parent.isArray()
        ? [...parent.path]
        : [...parent.path, field.name]
      : [];
    this.renderAs = shouldRenderAs(field, parent);
  }

  populateAllVegaSpecs(_options: GetResultMetadataOptions) {}

  isRoot(): boolean {
    return this.path.length === 0;
  }

  root(): RootField {
    if (this.parent) {
      return this.parent.root();
    } else {
      if (this instanceof RootField) {
        return this;
      }
      throw new Error('Root field was not an instance of RootField');
    }
  }

  get name() {
    return this.field.name;
  }

  fieldAt(path: string[] | string): Field {
    if (typeof path === 'string') {
      return this.fieldAtPath(Field.pathFromString(path));
    }
    return this.fieldAtPath(path);
  }

  get key(): string {
    return Field.pathStringToPath(this.path);
  }

  fieldAtPath(path: string[]): Field {
    if (path.length === 0) {
      return this.asField();
    }
    throw new Error(`${this.constructor.name} cannot contain fields`);
  }

  registerNullValue(): void {
    this.valueSet.add(NULL_SYMBOL);
  }

  get referenceId(): string | undefined {
    return this.metadataTag.text('reference_id');
  }

  drillExpression(): string {
    return this.metadataTag.text('drill_expression') ?? this.name;
  }

  wasDimension(): boolean {
    return !this.wasCalculation();
  }

  wasCalculation(): boolean {
    return this.metadataTag.has('calculation');
  }

  isHidden(): boolean {
    return this.tag.has('hidden');
  }

  get minNumber(): number | undefined {
    return undefined;
  }

  get maxNumber(): number | undefined {
    return undefined;
  }

  get maxString(): string | undefined {
    return undefined;
  }

  asField(): Field {
    if (
      this instanceof ArrayField ||
      this instanceof RepeatedRecordField ||
      this instanceof RecordField ||
      this instanceof NumberField ||
      this instanceof DateField ||
      this instanceof JSONField ||
      this instanceof StringField ||
      this instanceof TimestampField ||
      this instanceof BooleanField ||
      this instanceof SQLNativeField
    ) {
      return this;
    }
    throw new Error('Not a field');
  }

  isArray(): this is ArrayField {
    return this instanceof ArrayField;
  }

  isRepeatedRecord(): this is RepeatedRecordField {
    return this instanceof RepeatedRecordField;
  }

  isRecord(): this is RecordField {
    return this instanceof RecordField;
  }

  isNumber(): this is NumberField {
    return this instanceof NumberField;
  }

  isBoolean(): this is BooleanField {
    return this instanceof BooleanField;
  }

  isDate(): this is DateField {
    return this instanceof DateField;
  }

  isTimestamp(): this is TimestampField {
    return this instanceof TimestampField;
  }

  isTime(): this is TimeField {
    return this.isDate() || this.isTimestamp();
  }

  isSQLNative(): this is SQLNativeField {
    return this instanceof SQLNativeField;
  }

  isJSON(): this is JSONField {
    return this instanceof JSONField;
  }

  isAtomic(): this is AtomicField {
    return !this.isNest();
  }

  isNest(): this is NestField {
    return this.isArray() || this.isRecord() || this.isRepeatedRecord();
  }

  getLocationInParent() {
    return this.parent?.fields.findIndex(f => f === this) ?? -1;
  }

  isLastChild() {
    const parent = this.parent;
    return (
      parent === undefined ||
      this.getLocationInParent() === parent.fields.length
    );
  }

  isFirstChild() {
    return this.getLocationInParent() === 0;
  }

  pathTo(childField: Field): string {
    const parentPath = this.path;
    const childPath = childField.path;
    const startIndex = parentPath.length;

    let i = 0;
    while (parentPath[i]) {
      if (parentPath[i] !== childPath[i])
        throw new Error(
          'Tried to get path from parent field to child field, but parent field is not a parent of child field.'
        );
      i++;
    }
    return childPath.slice(startIndex).join('.');
  }
}

export class ArrayField extends FieldBase {
  public readonly fields: Field[];
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  public readonly eachField: Field;
  // public readonly recordField: RecordField;
  constructor(
    public readonly field: ArrayFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
    this.eachField = Field.from(
      {
        name: 'each',
        type: this.field.type.element_type,
      },
      this
    );
    this.fields = [this.eachField];
    // this.recordField = new RecordField(
    //   {
    //     name: 'as_record',
    //     type: {kind: 'record_type', fields: [this.eachField.field]},
    //   },
    //   this
    // );
  }

  populateAllVegaSpecs(options: GetResultMetadataOptions): void {
    this.fields.forEach(f => f.populateAllVegaSpecs(options));
  }
}

export class RepeatedRecordField extends ArrayField {
  public readonly fields: Field[];
  public vegaChartProps: VegaChartProps | undefined;
  public vegaRuntime: Runtime | undefined;
  public maxRecordCount = 0;
  // public readonly eachField: RecordField;

  constructor(
    public readonly field: RepeatedRecordFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
    // this.eachField = new RecordField(
    //   {
    //     name: 'each',
    //     type: this.field.type.element_type,
    //   },
    //   this
    // );
    // this.fields = field.type.element_type.fields.map(f =>
    //   Field.from(f, this.eachField)
    // );
    const eachField = this.eachField;
    if (!eachField.isRecord())
      throw new Error('Expected eachField of repeatedRecord to be a record');
    this.fields = eachField.fields;
  }

  fieldAtPath(path: string[]): Field {
    if (path.length === 0) {
      return this.asField();
    } else {
      return this.eachField.fieldAtPath(path);
    }
  }

  registerRecordCount(count: number) {
    this.maxRecordCount = Math.max(count, this.maxRecordCount);
  }

  registerValueSetSize(fieldName: string, size: number) {
    this.maxUniqueFieldValueCounts.set(
      fieldName,
      Math.max(this.maxUniqueFieldValueCounts.get(fieldName) ?? 0, size)
    );
  }

  populateAllVegaSpecs(options: GetResultMetadataOptions): void {
    this.populateVegaSpec(options);
    this.fields.forEach(f => f.populateAllVegaSpecs(options));
  }

  populateVegaSpec(options: GetResultMetadataOptions) {
    // Populate vega spec data
    let vegaChartProps: VegaChartProps | null = null;
    console.log(this.tag);
    const chartType = shouldRenderChartAs(this.tag);
    if (chartType === 'bar_chart') {
      vegaChartProps = generateBarChartVegaSpec(this);
    } else if (chartType === 'line_chart') {
      vegaChartProps = generateLineChartVegaSpec(this);
    }
    console.log({name: this.name, vegaChartProps});

    if (vegaChartProps) {
      const vegaConfigOverride =
        options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {};

      const vegaConfig: Config = mergeVegaConfigs(
        baseVegaConfig(),
        options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {}
      );

      const maybeAxisYLabelFont = vegaConfigOverride['axisY']?.['labelFont'];
      const maybeAxisLabelFont = vegaConfigOverride['axis']?.['labelFont'];
      if (maybeAxisYLabelFont || maybeAxisLabelFont) {
        const refLineFontSignal = vegaConfig.signals?.find(
          signal => signal.name === 'referenceLineFont'
        );
        if (refLineFontSignal)
          refLineFontSignal.value = maybeAxisYLabelFont ?? maybeAxisLabelFont;
      }

      this.vegaChartProps = {
        ...vegaChartProps,
        spec: {
          ...vegaChartProps.spec,
          config: vegaConfig,
        },
      };
      this.vegaRuntime = parse(this.vegaChartProps.spec);
      console.log({name: this.name, vegaRuntime: this.vegaRuntime});
    }
  }
}

export class RootField extends RepeatedRecordField {
  public readonly sourceName: string;
  public readonly store: ResultStore;
  public readonly modelTag: Tag;
  constructor(
    public readonly field: RepeatedRecordFieldInfo,
    metadata: {
      sourceName: string;
      store: ResultStore;
      modelTag: Tag;
    }
  ) {
    super(field, undefined);
    this.sourceName = metadata.sourceName;
    this.store = metadata.store;
    this.modelTag = metadata.modelTag;
  }
}

export class RecordField extends FieldBase {
  public readonly fields: Field[];
  public readonly fieldsByName: Record<string, Field>;
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  constructor(
    public readonly field: RecordFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
    this.fields = field.type.fields.map(f => Field.from(f, this));
    this.fieldsByName = Object.fromEntries(this.fields.map(f => [f.name, f]));
  }

  fieldAtPath(path: string[]): Field {
    if (path.length === 0) {
      return this.asField();
    } else {
      const [head, ...rest] = path;
      const field = this.fieldsByName[head];
      if (field === undefined) {
        throw new Error(`No such field ${head} in ${this.path}`);
      }
      return field.fieldAtPath(rest);
    }
  }

  populateAllVegaSpecs(options: GetResultMetadataOptions): void {
    this.fields.forEach(f => f.populateAllVegaSpecs(options));
  }
}

export class NumberField extends FieldBase {
  public min: number | undefined = undefined;
  public max: number | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: NumberFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
  }

  registerValue(value: number) {
    this.valueSet.add(value);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    } else if (this.min === undefined || value < this.min) {
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
    parent: NestField | undefined
  ) {
    super(field, parent);
  }

  get timeframe() {
    return this.field.type.timeframe;
  }

  registerValue(value: Date) {
    const numberValue = Number(value);
    this.valueSet.add(numberValue);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    } else if (this.min === undefined || value < this.min) {
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
}

export class TimestampField extends FieldBase {
  public min: Date | undefined = undefined;
  public max: Date | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: TimestampFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
  }

  get timeframe() {
    return this.field.type.timeframe;
  }

  registerValue(value: Date) {
    const numberValue = Number(value);
    this.valueSet.add(numberValue);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    } else if (this.min === undefined || value < this.min) {
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
    parent: NestField | undefined
  ) {
    super(field, parent);
  }

  registerValue(value: string) {
    this.valueSet.add(value);
    if (this.max === undefined || value > this.max) {
      this.max = value;
    } else if (this.min === undefined || value < this.min) {
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
    parent: NestField | undefined
  ) {
    super(field, parent);
  }
}

export class JSONField extends FieldBase {
  constructor(
    public readonly field: JSONFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
  }
}

export class BooleanField extends FieldBase {
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: BooleanFieldInfo,
    parent: NestField | undefined
  ) {
    super(field, parent);
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
  | BooleanCell;
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
      case 'number_cell': {
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
    }
  },
};

export abstract class CellBase {
  constructor(
    public readonly cell: Malloy.Cell,
    public readonly field: Field,
    public readonly parent: NestCell | undefined
  ) {}

  abstract get value(): CellValue;

  isNull(): this is NullCell {
    return this instanceof NullCell;
  }

  isArray(): this is ArrayCell {
    return this instanceof ArrayCell;
  }

  isRecord(): this is RecordCell {
    return this instanceof RecordCell;
  }

  isRepeatedRecord(): this is RepeatedRecordCell {
    return this instanceof RepeatedRecordCell;
  }

  isRecordOrRepeatedRecord(): this is RecordOrRepeatedRecordCell {
    return this.isRepeatedRecord() || this.isRecord();
  }

  isNest(): this is NestCell {
    return this.isRepeatedRecord() || this.isRecord() || this.isArray();
  }

  isNumber(): this is NumberCell {
    return this instanceof NumberCell;
  }

  isDate(): this is DateCell {
    return this instanceof DateCell;
  }

  isTime(): this is TimeCell {
    return this.isDate() || this.isTimestamp();
  }

  isJSON(): this is JSONCell {
    return this instanceof JSONCell;
  }

  isString(): this is StringCell {
    return this instanceof StringCell;
  }

  isTimestamp(): this is TimestampCell {
    return this instanceof TimestampCell;
  }

  isBoolean(): this is BooleanCell {
    return this instanceof BooleanCell;
  }

  asCell(): Cell {
    if (
      this instanceof ArrayCell ||
      this instanceof RepeatedRecordCell ||
      this instanceof RecordCell ||
      this instanceof NumberCell ||
      this instanceof DateCell ||
      this instanceof JSONCell ||
      this instanceof StringCell ||
      this instanceof TimestampCell ||
      this instanceof BooleanCell ||
      this instanceof NullCell
    ) {
      return this;
    }
    throw new Error('Not a cell');
  }

  root(): Cell {
    if (this.parent) {
      return this.parent.root();
    } else {
      return this.asCell();
    }
  }

  private getPathInfo(path: string): {
    levelsUp: number;
    pathSegments: string[];
  } {
    const pathParts = path.split('/');
    const levelsUp = pathParts.filter(part => part === '..').length + 1;
    const pathSegments = pathParts.filter(part => part !== '..' && part !== '');
    return {levelsUp, pathSegments};
  }

  getParentRecord(levelsUp: number): RecordCell {
    let current: Cell | undefined = this.asCell();
    while (current && levelsUp > 0) {
      current = current.parent;
      while (current?.isArray()) {
        current = current.parent;
      }
    }
    if (!current?.isRecord()) {
      throw new Error(`Parent ${levelsUp} levels up was not a record`);
    }
    return current;
  }

  getRelativeCell(relativeDataPath: string): Cell | undefined {
    try {
      const {levelsUp, pathSegments} = this.getPathInfo(relativeDataPath);
      const scope = this.getParentRecord(levelsUp);
      return scope.cellAtPath(pathSegments);
    } catch {
      return undefined;
    }
  }

  cellAt(path: string[] | string): Cell {
    if (typeof path === 'string') {
      return this.cellAtPath(Field.pathFromString(path));
    }
    return this.cellAtPath(path);
  }

  cellAtPath(path: string[]): Cell {
    if (path.length === 0) {
      return this.asCell();
    }
    throw new Error(`${this.constructor.name} cannot contain columns`);
  }
}

export class ArrayCell extends CellBase {
  public readonly values: Cell[] = [];
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: ArrayField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    for (const value of this.cell.array_value) {
      this.values.push(Cell.from(value, field.eachField, this));
    }
  }

  get value() {
    return this.values;
  }
}

export class RepeatedRecordCell extends ArrayCell {
  public readonly rows: RecordCell[];
  public readonly fieldValueSets: Map<string, Set<CellValue>> = new Map();
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RepeatedRecordField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    this.rows = this.values as RecordCell[];
    // First, create cells for all the rows
    for (const row of this.rows) {
      for (const column of row.columns) {
        const field = column.field;
        let valueSet = this.fieldValueSets.get(field.name);
        if (valueSet === undefined) {
          valueSet = new Set();
          this.fieldValueSets.set(field.name, valueSet);
        }
        valueSet.add(column.value);
      }
    }
    for (const [field, set] of this.fieldValueSets.entries()) {
      this.field.registerValueSetSize(field, set.size);
    }
  }

  get value() {
    return this.rows;
  }

  // TODO I don't think it makes sense to override cellAtPath here -- what would it mean to get a particular column
  // in a repeated record -- would you get the first row always??
}

export class RootCell extends RepeatedRecordCell {
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RootField
  ) {
    super(cell, field, undefined);
  }
}

export type CellValue =
  | string
  | number
  | boolean
  | Date
  | Cell[]
  | Record<string, Cell>
  | null;

export class RecordCell extends CellBase {
  public readonly cells: Record<string, Cell> = {};
  constructor(
    public readonly cell: Malloy.CellWithRecordCell,
    public readonly field: RecordField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    for (let i = 0; i < field.fields.length; i++) {
      const childField = field.fields[i];
      const childCell = Cell.from(cell.record_value.cells[i], childField, this);
      this.cells[childField.name] = childCell;
    }
  }

  public get rows(): RecordCell[] {
    return [this];
  }

  get value() {
    return this.cells;
  }

  column(name: string): Cell {
    return this.cells[name];
  }

  get columns(): Cell[] {
    return this.field.fields.map(f => this.column(f.name));
  }

  allCellValues(): Record<string, CellValue> {
    return Object.fromEntries(
      Object.entries(this.cells).map(([name, cell]) => [name, cell.value])
    );
  }

  cellAtPath(path: string[]): Cell {
    if (path.length === 0) {
      return this.asCell();
    } else {
      const [head, ...rest] = path;
      const cell = this.cells[head];
      if (cell === undefined) {
        throw new Error(`No such column ${head} in ${this.field.path}`);
      }
      return cell.cellAtPath(rest);
    }
  }
}

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
    return this.cell.json_value;
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
}
