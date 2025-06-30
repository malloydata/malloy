import {tagFromAnnotations} from '@/util';
import {type Field, RootField, getFieldType} from '@/data_tree';
import type {
  RenderPluginFactory,
  RenderPluginInstance,
} from '@/api/plugin-types';
import type {
  RenderFieldRegistryEntry,
  RenderFieldRegistry,
} from '@/registry/types';

import type * as Malloy from '@malloydata/malloy-interfaces';
import {ErrorPlugin} from './plugins/error/error-plugin';

export class RenderFieldMetadata {
  private registry: RenderFieldRegistry;
  private rootField: RootField;
  private pluginRegistry: RenderPluginFactory[];
  private pluginOptions: Record<string, unknown>;

  constructor(
    result: Malloy.Result,
    pluginRegistry: RenderPluginFactory[] = [],
    pluginOptions: Record<string, unknown> = {}
  ) {
    this.pluginRegistry = pluginRegistry;
    this.pluginOptions = pluginOptions;
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
      }
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
          const pluginOptions = this.pluginOptions[factory.name];
          const modelTag = this.rootField.modelTag;
          const pluginInstance = factory.create(field, pluginOptions, modelTag);
          plugins.push(pluginInstance);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `Plugin ${factory.name} failed to instantiate for field ${field.key}:`,
          error
        );
        const errorPlugin = ErrorPlugin.create(error.message);
        plugins.push(errorPlugin);
      }
    }

    field.setPlugins(plugins);

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
          // TODO placeholder until we migrate everything to plugins
          renderAs: field.renderAs(),
          sizingStrategy: 'fit',
          properties: {},
          errors: [],
        },
        plugins,
      };
      // TODO: legacy to keep renderer working until all viz are migrated to plugins
      const vizProperties = this.populateRenderFieldProperties(field, plugins);
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
  private populateRenderFieldProperties(
    field: Field,
    plugins: RenderPluginInstance[]
  ): {
    properties: Record<string, unknown>;
    errors: Error[];
  } {
    const properties: Record<string, unknown> = {};
    const errors: Error[] = [];

    for (const plugin of plugins) {
      properties[plugin.name] = plugin.getMetadata();
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

  getFieldEntry(fieldKey: string): RenderFieldRegistryEntry | undefined {
    return this.registry.get(fieldKey);
  }
}
