import {tagFromAnnotations} from '@/util';
import {
  type Field,
  RootField,
  RecordField,
  ArrayField,
  type NestField,
  RepeatedRecordField,
  type RenderPluginInstance,
  getFieldType,
} from '@/data_tree';
import type {RenderPluginFactory} from '@/api/plugin-types';
import {shouldRenderChartAs} from '@/component/render-result-metadata';
import {getBarChartSettings} from '@/component/bar-chart/get-bar_chart-settings';
import type {
  RenderFieldRegistryEntry,
  RenderFieldRegistry,
} from '@/registry/types';

import type * as Malloy from '@malloydata/malloy-interfaces';

export class RenderFieldMetadata {
  private registry: RenderFieldRegistry;
  private rootField: RootField;
  private pluginRegistry: RenderPluginFactory[];

  constructor(
    result: Malloy.Result,
    pluginRegistry: RenderPluginFactory[] = []
  ) {
    this.pluginRegistry = pluginRegistry;
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
      this.registry
    );

    // Register all fields in the registry
    this.registerFields(this.rootField);
  }

  // Instantiate plugins for a field that match
  private instantiatePluginsForField(field: Field): RenderPluginInstance[] {
    const plugins: RenderPluginInstance[] = [];

    for (const factory of this.pluginRegistry) {
      try {
        if (factory.matches(field, field.tag, getFieldType(field))) {
          const pluginInstance = factory.create(field);
          plugins.push(pluginInstance);
        }
      } catch (error) {
        console.warn(
          `Plugin ${factory.name} failed to instantiate for field ${field.key}:`,
          error
        );
      }
    }

    return plugins;
  }

  // Recursively register fields in the registry
  private registerFields(field: Field): void {
    const fieldKey = field.key;
    if (!this.registry.has(fieldKey)) {
      // Instantiate plugins for this field
      const plugins = this.instantiatePluginsForField(field);

      const renderFieldEntry: RenderFieldRegistryEntry = {
        field,
        renderProperties: {
          field,
          renderAs: field.renderAs,
          sizingStrategy: 'fit',
          properties: {},
          errors: [],
        },
        plugins,
      };
      // calculate chart metadata (eventually via plugins)
      const vizProperties = this.populateRenderFieldProperties(field);
      renderFieldEntry.renderProperties.properties = vizProperties.properties;
      renderFieldEntry.renderProperties.errors = vizProperties.errors;

      this.registry.set(fieldKey, renderFieldEntry);
    }
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

  // Get all fields in the schema
  getAllFields(): Field[] {
    return Array.from(this.registry.values()).map(entry => entry.field);
  }

  // Get the root field
  getRootField(): RootField {
    return this.rootField;
  }

  // Get plugins for a specific field
  getPluginsForField(fieldKey: string): RenderPluginInstance[] {
    const entry = this.registry.get(fieldKey);
    return entry ? entry.plugins : [];
  }
}
