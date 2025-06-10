import {tagFromAnnotations} from '@/util';
import {
  type Field,
  RootField,
  RecordField,
  ArrayField,
  type NestField,
  RepeatedRecordField,
  type FieldRegistry as DataTreeFieldRegistry,
} from '@/data_tree';
import {shouldRenderChartAs} from '@/component/render-result-metadata';
import {getBarChartSettings} from '@/component/bar-chart/get-bar_chart-settings';

import type * as Malloy from '@malloydata/malloy-interfaces';

type RenderFieldProps<T = unknown> = {
  field: Field;
  renderAs: string;
  sizingStrategy: string;
  properties: T;
  errors: Error[];
};

type RenderFieldRegistryEntry = {
  field: Field;
  renderProperties: RenderFieldProps;
  plugins: never[];
};

type RenderFieldRegistry = Map<string, RenderFieldRegistryEntry>;

// Registry to track field instances across the schema tree
// TODO deprecate this
interface FieldRegistry extends DataTreeFieldRegistry {
  rendererFields: Map<string, RenderFieldRegistryEntry>;
}

export class RenderFieldMetadata {
  private registry: RenderFieldRegistry;
  private legacyRegistry: FieldRegistry;
  private rootField: RootField;

  constructor(result: Malloy.Result) {
    // Create the field registry
    this.legacyRegistry = {
      rendererFields: new Map(),
      fieldInstances: new Map(),
      plugins: new Map(),
    };
    this.registry = new Map();

    // Create the root field with all its metadata
    this.rootField = new RootField(
      {
        name: 'root',
        type: {
          kind: 'array_type',
          element_type: {
            kind: 'record_type',
            fields: result.schema.fields.filter(f => f.kind === 'dimension'),
          },
        },
        annotations: result.annotations,
      },
      {
        modelTag: tagFromAnnotations(result.model_annotations, '## '),
        queryTimezone: result.query_timezone,
      },
      this.legacyRegistry
    );

    // Register all fields in the registry
    this.registerFields(this.rootField);
  }

  // Recursively register fields in the registry
  private registerFields(field: Field): void {
    const fieldKey = field.key;
    if (!this.registry.has(fieldKey)) {
      const renderFieldEntry: RenderFieldRegistryEntry = {
        field,
        renderProperties: {
          field,
          renderAs: field.renderAs,
          sizingStrategy: 'fit',
          properties: {},
          errors: [],
        },
        plugins: [],
      };
      // calculate chart metadata (eventually via plugins)
      const vizProperties = this.populateRenderFieldProperties(field);
      renderFieldEntry.renderProperties.properties = vizProperties.properties;
      renderFieldEntry.renderProperties.errors = vizProperties.errors;

      this.registry.set(fieldKey, renderFieldEntry);
      this.legacyRegistry.rendererFields.set(fieldKey, renderFieldEntry);
    }
    if (!this.legacyRegistry.fieldInstances.has(fieldKey)) {
      this.legacyRegistry.fieldInstances.set(fieldKey, []);
    }
    this.legacyRegistry.fieldInstances.get(fieldKey)!.push(field);
    // Recurse for nested fields
    if (field.isNest()) {
      for (const childField of field.fields) {
        this.registerFields(childField);
      }
    }
  }

  // TODO: replace with plugin logic, type it
  private populateRenderFieldProperties(field: Field): {
    properties: Record<string, unknown>;
    errors: Error[];
  } {
    const properties: Record<string, unknown> = {};
    const errors: Error[] = [];

    if (field.renderAs === 'chart' && !(field instanceof RepeatedRecordField)) {
      // TODO: push this error down to the individual chart code
      errors.push(new Error('Charts require tabular data'));
    }
    const chartType = shouldRenderChartAs(field.tag);

    // TODO throw error if field type doesn't match chart type
    if (chartType === 'bar' && field instanceof RepeatedRecordField) {
      try {
        const settings = getBarChartSettings(field);
        properties['settings'] = settings;
      } catch (error) {
        errors.push(error);
      }
    }
    return {properties, errors};
  }

  // Get a field by its path
  getField(path: string[]): Field | undefined {
    return this.rootField.fieldAtPath(path);
  }

  // Get all fields in the schema
  getAllFields(): Field[] {
    return Array.from(this.registry.values()).map(entry => entry.field);
  }

  // Get the root field
  getRootField(): RootField {
    return this.rootField;
  }

  // Get all fields of a specific type
  getFieldsByType<T extends Field, F extends Malloy.DimensionInfo>(
    type: new (
      field: F,
      parent: NestField | undefined,
      registry?: FieldRegistry
    ) => T
  ): T[] {
    return this.getAllFields().filter(
      (field): field is T => field instanceof type
    );
  }

  // Get all record fields
  getRecordFields(): RecordField[] {
    return this.getFieldsByType(RecordField);
  }

  // Get all array fields
  getArrayFields(): ArrayField[] {
    return this.getFieldsByType(ArrayField);
  }

  // Get all repeated record fields
  getRepeatedRecordFields(): RepeatedRecordField[] {
    return this.getFieldsByType(RepeatedRecordField);
  }
}
