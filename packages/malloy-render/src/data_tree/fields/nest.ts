import type {Tag} from '@malloydata/malloy-tag';
import {FieldBase} from './base';
import {Field} from '.';
import type {
  ArrayFieldInfo,
  RecordFieldInfo,
  RepeatedRecordFieldInfo,
  SortableField,
} from '../types';
import type {RenderFieldRegistry} from '../../registry/types';
import type {NestField} from '.';

export class ArrayField extends FieldBase {
  public readonly fields: Field[];
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  public readonly eachField: Field;
  constructor(
    public readonly field: ArrayFieldInfo,
    parent: NestField | undefined,
    registry: RenderFieldRegistry
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
    registry: RenderFieldRegistry
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
    registry: RenderFieldRegistry
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
    registry: RenderFieldRegistry
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
