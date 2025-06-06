/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import {
  NULL_SYMBOL,
  tagFromAnnotations,
  renderTagFromAnnotations,
  valueToMalloy,
  renderTimeString,
  notUndefined,
} from './util';
import * as Malloy from '@malloydata/malloy-interfaces';
import {isDateUnit, isTimestampUnit} from '@malloydata/malloy';
import {convertLegacyToVizTag, VIZ_CHART_TYPES} from './component/tag-utils';

export type DrillEntry =
  | {
      field: Field;
      value: string | number | boolean | Date | null;
    }
  | {where: string};

// Global registry to track field instances across the data tree
export interface FieldRegistry {
  // Maps field path to all instances of that field
  fieldInstances: Map<string, Field[]>;
  // Store plugin instances by field path
  plugins: Map<string, RenderPluginInstance[]>;
}

export function getDataTree(
  result: Malloy.Result,
  plugins: RenderPlugin[] = []
) {
  const fields: Malloy.DimensionInfo[] = [];
  for (const field of result.schema.fields) {
    if (field.kind === 'dimension') {
      fields.push(field);
    }
  }

  // Create registry to track fields and their instances
  const registry: FieldRegistry = {
    fieldInstances: new Map(),
    plugins: new Map(),
  };

  const metadataTag = tagFromAnnotations(result.annotations, '#(malloy) ');
  const rootName = metadataTag.text('query_name') ?? 'root';
  const rootFieldMeta = new RootField(
    {
      name: rootName,
      type: {
        kind: 'array_type',
        element_type: {
          kind: 'record_type',
          fields,
        },
      },
      annotations: result.annotations,
    },
    {
      modelTag: tagFromAnnotations(result.model_annotations, '## '),
      queryTimezone: result.query_timezone,
    },
    registry
  );

  // Register plugins for fields based on matching
  registerPluginsForField(rootFieldMeta, plugins, registry);

  const cell: Malloy.DataWithArrayCell =
    result.data!.kind === 'record_cell'
      ? {kind: 'array_cell', array_value: [result.data!]}
      : result.data!;

  const rootCell = new RootCell(cell, rootFieldMeta, plugins, registry);
  return rootCell;
}

// Helper to register plugins for a field and all its children
function registerPluginsForField(
  field: Field,
  allPlugins: RenderPlugin[],
  registry: FieldRegistry
) {
  // Register this field in the registry
  const fieldKey = field.key;
  if (!registry.fieldInstances.has(fieldKey)) {
    registry.fieldInstances.set(fieldKey, []);
  }
  registry.fieldInstances.get(fieldKey)!.push(field);

  // Check which plugins match this field
  const fieldType = getFieldType(field);
  const matchingPlugins = allPlugins.filter(plugin =>
    plugin.matches(field.tag, fieldType)
  );

  if (matchingPlugins.length > 0) {
    registry.plugins.set(
      fieldKey,
      matchingPlugins.map(plugin => plugin.plugin(field))
    );
  }

  // Recurse for nested fields
  if (field.isNest()) {
    for (const childField of field.fields) {
      registerPluginsForField(childField, allPlugins, registry);
    }
  }
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
export type SortableField = {field: Field; dir: 'asc' | 'desc' | undefined};

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
  from(
    field: Malloy.DimensionInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
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
  pathToString(path: string[]) {
    return JSON.stringify(path);
  },
};

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

type DrillValue = {field: Field; value: Cell} | {where: string};

export function shouldRenderAs(
  field: Malloy.DimensionInfo,
  parent: Field | undefined,
  tagOverride?: Tag
) {
  const tag = convertLegacyToVizTag(
    tagOverride ?? renderTagFromAnnotations(field.annotations)
  );

  // Check viz property first (new approach)
  const vizType = tag.text('viz');
  if (vizType) {
    if (vizType === 'table') return 'table';
    if (vizType === 'dashboard') return 'dashboard';
    if (VIZ_CHART_TYPES.includes(vizType)) return 'chart';
    // Handle other viz types if needed in the future
  }

  // Fall back to legacy tag detection for non-chart tags
  const properties = tag.properties ?? {};
  const tagNamesInOrder = Object.keys(properties).reverse();
  for (const tagName of tagNamesInOrder) {
    if (RENDER_TAG_LIST.includes(tagName) && !properties[tagName].deleted) {
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
  protected readonly metadataTag: Tag;
  public readonly renderAs: string;
  public readonly valueSet = new Set<string | number | boolean>();
  private _pluginData: Map<string, unknown> = new Map();
  protected registry?: FieldRegistry;

  registerPluginData<T>(pluginType: string, data: T) {
    this._pluginData.set(pluginType, data);
  }

  getPluginData<T>(pluginType: string): T | undefined {
    return this._pluginData.get(pluginType) as T;
  }

  // Get all field instances that match this field's key from the registry
  getAllFieldInstances(): Field[] {
    if (!this.registry) return [this.asField()];
    return this.registry.fieldInstances.get(this.key) || [this.asField()];
  }

  // Get the plugins registered for this field
  getPlugins(): RenderPluginInstance[] {
    if (!this.registry) return [];
    return this.registry.plugins.get(this.key) || [];
  }

  constructor(
    public readonly field: Malloy.DimensionInfo,
    public readonly parent: NestField | undefined,
    registry?: FieldRegistry
  ) {
    this.tag = renderTagFromAnnotations(this.field.annotations);
    this.metadataTag = tagFor(this.field, '#(malloy) ');
    this.path = parent
      ? parent.isArray()
        ? [...parent.path]
        : [...parent.path, field.name]
      : [];
    this.renderAs = shouldRenderAs(field, parent);
    this.registry = registry;
  }

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

  get drillPath(): string[] {
    if (this.parent) {
      const view = this.metadataTag.text('drill_view');
      const parentPath = this.parent.drillPath;
      if (view === undefined) return parentPath;
      return [...parentPath, view];
    }
    return [];
  }

  get sourceName() {
    return this.metadataTag.text('source', 'name') ?? '__source__';
  }

  get sourceArguments(): Malloy.ParameterValue[] | undefined {
    const argTags = this.metadataTag.array('source', 'parameters');
    if (argTags === undefined) return undefined;
    const args: Malloy.ParameterValue[] = [];
    for (const argTag of argTags) {
      const name = argTag.text('name');
      const valueTag = argTag.tag('value');
      if (name === undefined || valueTag === undefined) continue;
      const literal = extractLiteralFromTag(valueTag);
      if (literal !== undefined) {
        args.push({
          name,
          value: literal,
        });
      }
    }
    if (args.length === 0) return undefined;
    return args;
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

  getParentRecord(levelsUp: number): RecordField {
    let current: Field | undefined = this.asField();
    while (current && levelsUp > 0) {
      current = current.parent;
      while (current?.isArray()) {
        current = current.parent;
      }
      levelsUp--;
    }
    if (!current?.isRecord()) {
      throw new Error(`Parent ${levelsUp} levels up was not a record`);
    }
    return current;
  }

  get key(): string {
    return Field.pathToString(this.path);
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

  get drillFilters(): string[] {
    return (this.metadataTag.array('drill_filters') ?? [])
      .map(filterTag => {
        if (filterTag.text('drill_view')) return undefined;
        const stableFilter = this.getStableDrillFilter(filterTag);
        if (stableFilter === undefined) {
          return filterTag.text('code');
        }
        return Malloy.filterToMalloy(stableFilter);
      })
      .filter(notUndefined);
  }

  getStableDrillFilter(filter: Tag): Malloy.Filter | undefined {
    const kind = filter.text('kind');
    const field = filter.textArray('field_reference');
    if (kind === undefined || field === undefined) return undefined;
    const fieldReference: Malloy.Reference = {
      name: field[field.length - 1],
      path: field.slice(0, -1),
    };
    if (kind === 'filter_expression') {
      const filterExpression = filter.text('filter_expression');
      if (filterExpression === undefined) return undefined;
      return {
        kind: 'filter_string',
        field_reference: fieldReference,
        filter: filterExpression,
      };
    } else if (kind === 'literal_equality') {
      const value = filter.tag('value');
      const literal = extractLiteralFromTag(value);
      if (literal !== undefined) {
        return {
          kind: 'literal_equality',
          field_reference: fieldReference,
          value: literal,
        };
      }
    }
    return undefined;
  }

  get stableDrillFilters(): Malloy.Filter[] | undefined {
    const result: Malloy.Filter[] = [];
    const filterTags = this.metadataTag.array('drill_filters');
    for (const filterTag of filterTags ?? []) {
      if (filterTag.text('drill_view')) continue;
      const stableFilter = this.getStableDrillFilter(filterTag);
      if (stableFilter === undefined) return undefined;
      result.push(stableFilter);
    }
    return result;
  }

  get referenceId(): string | undefined {
    return this.metadataTag.text('reference_id');
  }

  private escapeIdentifier(str: string) {
    return str.replace(/\\/g, '\\\\').replace('`', '\\`');
  }

  private identifierCode() {
    if (this.name.match(/^[A-Za-z_][0-9A-Za-z_]*$/)) return this.name;
    return `\`${this.escapeIdentifier(this.name)}\``;
  }

  drillExpression(): string {
    return this.metadataTag.text('drill_expression') ?? this.identifierCode();
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

  isString(): this is StringField {
    return this instanceof StringField;
  }

  isRecordOrRepeatedRecord(): this is RecordOrRepeatedRecordField {
    return this.isRecord() || this.isRepeatedRecord();
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

  isBasic(): this is BasicAtomicField {
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
    return Field.pathToString(childPath.slice(startIndex));
  }
}

export class ArrayField extends FieldBase {
  public readonly fields: Field[];
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  public readonly eachField: Field;
  constructor(
    public readonly field: ArrayFieldInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
  ) {
    super(field, parent, registry);
    this.eachField = Field.from(
      {
        name: 'each',
        type: this.field.type.element_type,
      },
      this,
      registry
    );
    this.fields = [this.eachField];
  }

  get isDrillable() {
    return this.metadataTag.has('drillable');
  }
}

export class RepeatedRecordField extends ArrayField {
  public readonly fields: Field[];
  public maxRecordCount = 0;

  constructor(
    public readonly field: RepeatedRecordFieldInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
  ) {
    super(field, parent, registry);
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

  private _fieldsWithOrder: SortableField[] | undefined = undefined;
  public get fieldsWithOrder(): SortableField[] {
    if (!this._fieldsWithOrder) {
      const orderedByTag = this.metadataTag.tag('ordered_by');
      const orderedByFields =
        (orderedByTag &&
          orderedByTag.array()?.map(t => {
            const name = Object.keys(t.properties ?? {})[0];
            const direction = t.text(name) as 'asc' | 'desc';
            return {field: this.fieldAt(name), dir: direction};
          })) ??
        [];

      const orderByFieldSet = new Set(orderedByFields.map(f => f.field.name));
      this._fieldsWithOrder = [
        ...orderedByFields,
        ...this.fields
          .filter(f => !orderByFieldSet.has(f.name))
          .map<SortableField>(field => ({field, dir: 'asc'})),
      ];
    }
    return this._fieldsWithOrder;
  }
}

export class RootField extends RepeatedRecordField {
  public readonly modelTag: Tag;
  public readonly queryTimezone: string | undefined;
  constructor(
    public readonly field: RepeatedRecordFieldInfo,
    metadata: {
      modelTag: Tag;
      queryTimezone: string | undefined;
    },
    registry?: FieldRegistry
  ) {
    super(field, undefined, registry);
    this.modelTag = metadata.modelTag;
    this.queryTimezone = metadata.queryTimezone;
  }
}

export class RecordField extends FieldBase {
  public readonly fields: Field[];
  public readonly fieldsByName: Record<string, Field>;
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  constructor(
    public readonly field: RecordFieldInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
  ) {
    super(field, parent, registry);
    this.fields = field.type.fields.map(f => Field.from(f, this, registry));
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

  private _fieldsWithOrder: SortableField[] | undefined = undefined;
  public get fieldsWithOrder(): SortableField[] {
    if (this._fieldsWithOrder === undefined) {
      this._fieldsWithOrder = [
        ...this.fields.map<SortableField>(field => ({field, dir: 'asc'})),
      ];
    }
    return this._fieldsWithOrder;
  }
}

export class NumberField extends FieldBase {
  public min: number | undefined = undefined;
  public max: number | undefined = undefined;
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: NumberFieldInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
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
    registry?: FieldRegistry
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
    registry?: FieldRegistry
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
    registry?: FieldRegistry
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
    registry?: FieldRegistry
  ) {
    super(field, parent, registry);
  }
}

export class JSONField extends FieldBase {
  constructor(
    public readonly field: JSONFieldInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
  ) {
    super(field, parent, registry);
  }
}

export class BooleanField extends FieldBase {
  private _maxString: string | undefined = undefined;
  constructor(
    public readonly field: BooleanFieldInfo,
    parent: NestField | undefined,
    registry?: FieldRegistry
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

export abstract class CellBase {
  constructor(
    public readonly cell: Malloy.Cell,
    public readonly field: Field,
    public readonly parent: NestCell | undefined
  ) {}

  get literalValue(): Malloy.LiteralValue | undefined {
    return undefined;
  }

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
      this instanceof NullCell ||
      this instanceof SQLNativeCell
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
      levelsUp--;
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

  compareTo(_other: Cell): number {
    return 0;
  }

  canDrill() {
    let current: Cell | undefined = this.asCell();
    while (current) {
      if (current && current.isArray()) {
        if (!current.field.isDrillable) {
          return false;
        }
        current = current.parent;
      }
    }
    return true;
  }

  getStableDrillQuery(): Malloy.Query | undefined {
    const drillClauses = this.getStableDrillClauses();
    if (drillClauses === undefined) return undefined;
    const drillOperations: Malloy.ViewOperationWithDrill[] = drillClauses.map(
      d => ({
        kind: 'drill',
        ...d,
      })
    );
    const root = this.field.root();
    return {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: root.sourceName,
          parameters: root.sourceArguments,
        },
        view: {
          kind: 'segment',
          operations: [...drillOperations],
        },
      },
    };
  }

  getStableDrillClauses(): Malloy.DrillOperation[] | undefined {
    let current: Cell | undefined = this.asCell();
    const result: Malloy.DrillOperation[] = [];
    while (current) {
      if (current && current.isArray()) {
        const filters = current.field.stableDrillFilters;
        if (filters === undefined) return undefined;
        // TODO handle filters in views that did not come from a view
        result.unshift(
          ...filters.map(f => ({
            kind: 'drill',
            filter: f,
          }))
        );
        current = current.parent;
      }
      if (current === undefined) {
        break;
      }
      if (current && current.isRecord()) {
        const dimensions = current.field.fields.filter(
          f => f.isBasic() && f.wasDimension()
        );
        const newClauses: Malloy.DrillOperation[] = [];
        for (const dimension of dimensions) {
          const cell = current.column(dimension.name);
          const value = cell.literalValue;
          if (value === undefined) {
            continue;
          }
          const filter: Malloy.FilterWithLiteralEquality = {
            kind: 'literal_equality',
            field_reference: {
              name: dimension.name,
              path: dimension.drillPath,
            },
            value,
          };
          newClauses.push({filter});
        }
        result.unshift(...newClauses);
      }
      current = current.parent;
    }
    return result;
  }

  getDrillValues(): DrillValue[] {
    let current: Cell | undefined = this.asCell();
    const result: DrillValue[] = [];
    while (current) {
      if (current && current.isArray()) {
        const filters = current.field.drillFilters;
        result.unshift(...filters.map(f => ({where: f})));
        current = current.parent;
      }
      if (current === undefined) {
        break;
      }
      if (current && current.isRecord()) {
        const dimensions = current.field.fields.filter(
          f => f.isBasic() && f.wasDimension()
        );
        const newClauses: DrillValue[] = [];
        for (const dimension of dimensions) {
          const cell = current.column(dimension.name);
          const value = cell.literalValue;
          if (value === undefined) {
            continue;
          }
          const filter: Malloy.FilterWithLiteralEquality = {
            kind: 'literal_equality',
            field_reference: {
              name: dimension.name,
              path: dimension.drillPath,
            },
            value,
          };
          newClauses.push({where: Malloy.filterToMalloy(filter)});
        }
        result.unshift(...newClauses);
      }
      current = current.parent;
    }
    return result;
  }

  getDrillExpressions(): string[] {
    const drillValues = this.getDrillValues();
    return drillValues.map(drill => {
      if ('where' in drill) return drill.where;
      const valueStr = valueToMalloy(drill.value);
      return `${drill.field.drillExpression()} = ${valueStr}`;
    });
  }

  getDrillEntries(): DrillEntry[] {
    const drillValues = this.getDrillValues();
    const result: DrillEntry[] = [];
    for (const drill of drillValues) {
      if ('where' in drill) result.push(drill);
      else if (
        drill.value.isNull() ||
        drill.value.isTime() ||
        drill.value.isString() ||
        drill.value.isNumber() ||
        drill.value.isBoolean()
      ) {
        result.push({field: drill.field, value: drill.value.value});
      }
    }
    return result;
  }

  getStableDrillQueryMalloy(): string | undefined {
    if (this.getStableDrillClauses()?.length === 0) {
      return `run: ${this.field.root().sourceName} -> { select: * }`;
    }
    const query = this.getStableDrillQuery();
    if (query === undefined) return undefined;
    return Malloy.queryToMalloy(query) + ' + { select: * }';
  }

  getDrillQueryMalloy(): string {
    const stableMalloy = this.getStableDrillQueryMalloy();
    if (stableMalloy !== undefined) return stableMalloy;
    const expressions = this.getDrillExpressions();
    let query = `run: ${this.field.root().sourceName} ->`;
    if (expressions.length > 0) {
      query += ` {
  drill:
${expressions.map(entry => `    ${entry}`).join(',\n')}
} +`;
    }
    query += ' { select: * }';
    return query;
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
  private plugins: RenderPlugin[];
  private registry?: FieldRegistry;

  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RepeatedRecordField,
    public readonly parent: NestCell | undefined,
    plugins: RenderPlugin[] = [],
    registry?: FieldRegistry
  ) {
    super(cell, field, parent);
    this.plugins = plugins;
    this.registry = registry;
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

    // Run plugins for this field
    const fieldPlugins = this.field.getPlugins();
    for (const plugin of fieldPlugins) {
      plugin.processData(this.field, this);
    }
  }

  get value() {
    return this.rows;
  }
}

export class RootCell extends RepeatedRecordCell {
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RootField,
    plugins: RenderPlugin[] = [],
    registry?: FieldRegistry
  ) {
    super(cell, field, undefined, plugins, registry);
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
      const childCell = Cell.from(cell.record_value[i], childField, this);
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
    const difference = this.value - other.value;
    if (difference > 0) {
      return 1;
    } else if (difference === 0) {
      return 0;
    }

    return -1;
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

function extractLiteralFromTag(
  value: Tag | undefined
): Malloy.LiteralValue | undefined {
  if (value === undefined) return undefined;
  const valueKind = value.text('kind');
  if (valueKind === undefined) return undefined;
  switch (valueKind) {
    case 'string_literal': {
      const stringValue = value.text('string_value');
      if (stringValue === undefined) return undefined;
      return {
        kind: 'string_literal',
        string_value: stringValue,
      };
    }
    case 'number_literal': {
      const numberValue = value.numeric('number_value');
      if (numberValue === undefined) return undefined;
      return {
        kind: 'number_literal',
        number_value: numberValue,
      };
    }
    case 'date_literal': {
      const dateValue = value.text('date_value');
      const granularity = value.text('granularity');
      const timezone = value.text('timezone');
      if (granularity && !isDateUnit(granularity)) return undefined;
      if (dateValue === undefined) return undefined;
      return {
        kind: 'date_literal',
        date_value: dateValue,
        granularity: granularity as Malloy.DateTimeframe,
        timezone,
      };
    }
    case 'timestamp_literal': {
      const timestampValue = value.text('timestamp_value');
      const granularity = value.text('granularity');
      const timezone = value.text('timezone');
      if (timestampValue === undefined) return undefined;
      if (granularity && !isTimestampUnit(granularity)) return undefined;
      return {
        kind: 'timestamp_literal',
        timestamp_value: timestampValue,
        granularity: granularity as Malloy.TimestampTimeframe,
        timezone,
      };
    }
    case 'boolean_literal': {
      const booleanValue = value.text('boolean_value');
      if (booleanValue === undefined) return undefined;
      return {
        kind: 'boolean_literal',
        boolean_value: booleanValue === 'true',
      };
    }
    case 'null_literal':
      return {
        kind: 'null_literal',
      };
    case 'filter_expression_literal': {
      const filterExpressionValue = value.text('filter_expression_value');
      if (filterExpressionValue === undefined) return undefined;
      return {
        kind: 'filter_expression_literal',
        filter_expression_value: filterExpressionValue,
      };
    }
  }
  return undefined;
}

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

export type RenderPluginInstance = {
  // TODO duplication of name in multiple places...
  name: string;
  processData(field: NestField, cell: NestCell): void;
};

export type RenderPlugin<
  T extends RenderPluginInstance = {} & RenderPluginInstance,
> = {
  name: string;
  matches: (fieldTag: Tag, fieldType: FieldType) => boolean;
  plugin: RenderPluginFactory<T>;
};

export type RenderPluginFactory<T extends RenderPluginInstance> = (
  field: Field
) => T;

export function getFieldType(field: Field): FieldType {
  if (field instanceof RepeatedRecordField) return FieldType.RepeatedRecord;
  if (field instanceof ArrayField) return FieldType.Array;
  if (field instanceof RecordField) return FieldType.Record;
  if (field instanceof NumberField) return FieldType.Number;
  if (field instanceof DateField) return FieldType.Date;
  if (field instanceof JSONField) return FieldType.JSON;
  if (field instanceof StringField) return FieldType.String;
  if (field instanceof TimestampField) return FieldType.Timestamp;
  if (field instanceof BooleanField) return FieldType.Boolean;
  if (field instanceof SQLNativeField) return FieldType.SQLNative;
  throw new Error('Unknown field type');
}
