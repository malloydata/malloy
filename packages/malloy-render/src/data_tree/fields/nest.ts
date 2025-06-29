import type {Tag} from '@malloydata/malloy-tag';
import {FieldBase} from './base';
import {Field} from '.';
import type {
  ArrayFieldInfo,
  RecordFieldInfo,
  RepeatedRecordFieldInfo,
  SortableField,
} from '../types';

export class ArrayField extends FieldBase {
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  constructor(
    public readonly field: ArrayFieldInfo,
    parent: Field | undefined
  ) {
    super(field, parent);
  }

  get isDrillable() {
    return this.metadataTag.has('drillable');
  }
}

export class RepeatedRecordField extends ArrayField {
  public readonly fields: Field[];
  public readonly fieldsByName: Record<string, Field>;
  public maxRecordCount = 0;

  constructor(
    public readonly field: RepeatedRecordFieldInfo,
    parent: Field | undefined
  ) {
    super(field, parent);
    // Directly parse fields from the record type
    const recordType = this.field.type.element_type;
    if (recordType.kind !== 'record_type') {
      throw new Error(
        'Expected element_type of RepeatedRecordField to be a record'
      );
    }
    this.fields = recordType.fields.map(f => Field.from(f, this));
    this.fieldsByName = Object.fromEntries(this.fields.map(f => [f.name, f]));
  }

  fieldAtPath(path: string[]): Field {
    console.log('fieldAtPath', path);
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
    }
  ) {
    super(field, undefined);
    this.modelTag = metadata.modelTag;
    this.queryTimezone = metadata.queryTimezone;
  }
}

export class RecordField extends FieldBase {
  public fields: Field[];
  public fieldsByName: Record<string, Field>;
  public readonly maxUniqueFieldValueCounts: Map<string, number> = new Map();
  constructor(
    public readonly field: RecordFieldInfo,
    parent: Field | undefined
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
