import {tagFromAnnotations} from '../util';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {type Field, RootField, type NestField} from './fields';
import {RootCell} from './cells';
import {type FieldRegistry} from './types';
import type {RenderPlugin} from './plugins';
import {getFieldType} from './utils';

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
    for (const childField of (field as NestField).fields) {
      registerPluginsForField(childField, allPlugins, registry);
    }
  }
}

// Export everything from the old file, but now from the new modules
export * from './cells/base';
export * from './types';
export * from './plugins';
export * from './fields';
export * from './cells';
export * from './utils';
export * from './drilling';
