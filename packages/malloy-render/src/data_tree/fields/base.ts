import {tagFor, extractLiteralFromTag, shouldRenderAs} from '../utils';
import * as Malloy from '@malloydata/malloy-interfaces';
import type {Tag} from '@malloydata/malloy-tag';
import {renderTagFromAnnotations, NULL_SYMBOL, notUndefined} from '../../util';
import type {
  Field,
  NestField,
  RecordField,
  RecordOrRepeatedRecordField,
  BasicAtomicField,
  TimeField,
  RootField,
} from '.';
import {
  ArrayField,
  BooleanField,
  DateField,
  JSONField,
  NumberField,
  RecordField as RecordFieldType,
  RepeatedRecordField,
  SQLNativeField,
  StringField,
  TimestampField,
} from '.';
import type {RenderPluginInstance} from '@/api/plugin-types';

export abstract class FieldBase {
  public readonly tag: Tag;
  public readonly path: string[];
  protected readonly metadataTag: Tag;
  public readonly valueSet = new Set<string | number | boolean>();
  protected plugins: RenderPluginInstance[] = [];
  protected _renderAs = '';

  // Get the plugins registered for this field
  getPlugins(): RenderPluginInstance[] {
    return this.plugins;
  }

  setPlugins(plugins: RenderPluginInstance[]) {
    this.plugins = plugins;
    // TODO: legacy until everything is migrated to plugins
    this._renderAs = shouldRenderAs({field: this});
  }

  renderAs(): string {
    return this._renderAs;
  }

  constructor(
    public readonly field: Malloy.DimensionInfo,
    public readonly parent: Field | undefined
  ) {
    this.tag = renderTagFromAnnotations(this.field.annotations);
    this.metadataTag = tagFor(this.field, '#(malloy) ');
    this.path = parent ? [...parent.path, field.name] : [];
  }

  isRoot(): boolean {
    return this.path.length === 0;
  }

  root(): RootField {
    if (this.parent) {
      return this.parent.root();
    } else if (this.isRoot()) {
      return this as unknown as RootField;
    }
    throw new Error('Root field was not an instance of RootField');
  }

  get drillPath(): string[] {
    if (this.parent) {
      const view = this.metadataTag.text('drill_view');
      const parentPath = this.parent.drillPath;
      if (view === undefined) {
        const referencePath = this.metadataTag.textArray('drill_path');
        if (referencePath) return referencePath;
        return parentPath;
      }
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
      return this.fieldAtPath(JSON.parse(path));
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
    return JSON.stringify(this.path);
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
      this instanceof RecordFieldType ||
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
    return this instanceof RecordFieldType;
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
    return this.isRecord() || this.isRepeatedRecord();
  }

  getLocationInParent() {
    if (this.parent && 'fields' in this.parent) {
      return this.parent.fields.findIndex(f => f === this) ?? -1;
    }
    return -1;
  }

  isLastChild() {
    const parent = this.parent;
    if (parent === undefined) {
      return true;
    }
    if ('fields' in parent) {
      return this.getLocationInParent() === parent.fields.length;
    }
    return true;
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
    return JSON.stringify(childPath.slice(startIndex));
  }
}
