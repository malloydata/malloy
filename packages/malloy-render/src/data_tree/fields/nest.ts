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
  protected _elementField?: Field;

  constructor(
    public readonly field: ArrayFieldInfo,
    parent: Field | undefined,
    skipTagParsing = false
  ) {
    super(field, parent, skipTagParsing);
  }

  /**
   * Lazy getter for elementField to optimize field creation.
   *
   * Performance optimization: For RepeatedRecordField, this getter is overridden
   * to return the nestedRecordField, preventing duplicate field creation.
   * For regular ArrayField instances, the element field is created on-demand.
   */
  get elementField(): Field {
    if (!this._elementField) {
      const elementFieldInfo = {
        name: 'element',
        type: this.field.type.element_type,
      };
      this._elementField = Field.from(elementFieldInfo, this);
    }
    return this._elementField;
  }

  get isDrillable() {
    return this.metadataTag.has('drillable');
  }
}

export class RepeatedRecordField extends ArrayField {
  public readonly fields: Field[];
  public readonly fieldsByName: Record<string, Field>;
  public maxRecordCount = 0;
  public readonly nestedRecordField: RecordField;

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

    /**
     * Performance optimization: Create a synthetic RecordField that shares
     * the same field instances to avoid duplicate field creation.
     *
     * This RecordField is used by RepeatedRecordCell when creating RecordCell
     * instances for each row. By sharing fields, we avoid creating duplicate
     * Field objects and parsing tags multiple times.
     */
    const recordFieldInfo: RecordFieldInfo = {
      name: 'record',
      type: this.field.type.element_type,
    };

    this.nestedRecordField = new RecordField(recordFieldInfo, this, {
      fields: this.fields,
      skipTagParsing: true
    });
  }

  /**
   * Override elementField to return the shared nestedRecordField.
   *
   * This prevents duplicate field creation that would occur if we let
   * ArrayField create its own elementField. Since RepeatedRecordField
   * already knows its elements are records, we can reuse the nestedRecordField.
   */
  override get elementField(): Field {
    if (!this._elementField) {
      this._elementField = this.nestedRecordField;
    }
    return this._elementField;
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
    parent: Field | undefined,
    /**
     * Optional configuration for performance optimizations.
     * - fields: Pre-created fields to share (avoids duplicate field creation)
     * - skipTagParsing: Skip metadata tag parsing for synthetic fields
     */
    options?: {
      fields?: Field[];
      skipTagParsing?: boolean;
    }
  ) {
    super(field, parent, options?.skipTagParsing);
    
    if (options?.fields) {
      // Use provided fields to avoid duplication
      this.fields = options.fields;
      this.fieldsByName = Object.fromEntries(this.fields.map(f => [f.name, f]));
    } else {
      // Create fields normally
      this.fields = field.type.fields.map(f => Field.from(f, this));
      this.fieldsByName = Object.fromEntries(this.fields.map(f => [f.name, f]));
    }
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
