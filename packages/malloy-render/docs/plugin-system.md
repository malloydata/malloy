# Malloy Render Plugin System

## Overview

The Malloy Render plugin system provides a flexible way to extend the visualization capabilities of Malloy. Plugins allow you to create custom renderers for specific field types or data patterns, enabling rich, interactive visualizations beyond the built-in rendering options.

## Architecture

The plugin system consists of three main components:

1. **Plugin Factories** - Create plugin instances for matching fields
2. **Plugin Instances** - Handle the actual rendering of data
3. **Plugin Registry** - Manages available plugins and their lifecycle

## Plugin Types

### SolidJS Plugins
Use SolidJS components for reactive, efficient rendering.

```typescript
interface SolidJSRenderPluginInstance {
  readonly renderMode: 'solidjs';
  renderComponent(props: RenderProps): JSXElement;
  // ... other methods
}
```

### DOM Plugins
Direct DOM manipulation for custom rendering needs.

```typescript
interface DOMRenderPluginInstance {
  readonly renderMode: 'dom';
  renderToDOM(container: HTMLElement, props: RenderProps): void;
  cleanup?(container: HTMLElement): void;
  // ... other methods
}
```

## Plugin API

### RenderPluginFactory

The factory interface defines how plugins are matched and instantiated:

```typescript
interface RenderPluginFactory<TInstance extends RenderPluginInstance> {
  readonly name: string;
  
  // Determine if this plugin should handle a field
  matches(field: Field, fieldTag: Tag, fieldType: FieldType): boolean;
  
  // Create a plugin instance for a matched field
  create(field: Field, pluginOptions?: unknown, modelTag?: Tag): TInstance;
}
```

### RenderPluginInstance

Base interface for all plugin instances:

```typescript
interface BaseRenderPluginInstance<TMetadata = unknown> {
  readonly name: string;
  readonly field: Field;
  readonly sizingStrategy: 'fixed' | 'fill';
  
  // Return plugin-specific metadata
  getMetadata(): TMetadata;
  
  // Optional: Process data before rendering
  processData?(field: NestField, cell: NestCell): void;
  
  // Optional: Prepare for rendering
  beforeRender?(metadata: RenderMetadata, options: GetResultMetadataOptions): void;
}
```

### Core Visualization Plugins

Core visualization plugins extend the base interface with additional methods:

```typescript
interface CoreVizPluginMethods {
  getSchema(): JSONSchemaObject;
  getSettings(): Record<string, unknown>;
  getDefaultSettings(): Record<string, unknown>;
  settingsToTag(settings: Record<string, unknown>): Tag;
}

type CoreVizPluginInstance = SolidJSRenderPluginInstance & CoreVizPluginMethods;
```

## Writing a Plugin

### 1. Basic SolidJS Plugin

```typescript
import type { RenderPluginFactory, SolidJSRenderPluginInstance } from '@/api/plugin-types';
import { Field, FieldType } from '@/data_tree';
import type { Tag } from '@malloydata/malloy-tag';

const MyPluginFactory: RenderPluginFactory<SolidJSRenderPluginInstance> = {
  name: 'my_plugin',
  
  matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
    // Match fields with #my_plugin tag
    return fieldTag.has('my_plugin');
  },
  
  create: (field: Field): SolidJSRenderPluginInstance => {
    return {
      name: 'my_plugin',
      field,
      renderMode: 'solidjs',
      sizingStrategy: 'fixed',
      
      renderComponent: (props) => {
        const value = props.dataColumn.value;
        return <div class="my-plugin">{value}</div>;
      },
      
      getMetadata: () => ({
        type: 'my_plugin',
        fieldName: field.name
      })
    };
  }
};
```

### 2. DOM Plugin Example

```typescript
const MyDOMPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> = {
  name: 'my_dom_plugin',
  
  matches: (field, fieldTag, fieldType) => {
    return fieldTag.has('my_dom_plugin');
  },
  
  create: (field): DOMRenderPluginInstance => {
    return {
      name: 'my_dom_plugin',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',
      
      renderToDOM: (container, props) => {
        container.innerHTML = `<div>Value: ${props.dataColumn.value}</div>`;
      },
      
      cleanup: (container) => {
        container.innerHTML = '';
      },
      
      getMetadata: () => ({ type: 'my_dom_plugin' })
    };
  }
};
```

### 3. Advanced Visualization Plugin

For complex visualizations with settings and data processing:

```typescript
const AdvancedVizFactory: RenderPluginFactory<CoreVizPluginInstance> = {
  name: 'advanced_viz',
  
  matches: (field, fieldTag, fieldType) => {
    return fieldType === FieldType.RepeatedRecord && fieldTag.has('advanced_viz');
  },
  
  create: (field, pluginOptions, modelTag) => {
    let processedData: any = null;
    
    return {
      name: 'advanced_viz',
      field,
      renderMode: 'solidjs',
      sizingStrategy: 'fill',
      
      processData: (field, cell) => {
        // Pre-process data for efficiency
        processedData = analyzeData(cell);
      },
      
      beforeRender: (metadata, options) => {
        // Prepare rendering context
      },
      
      renderComponent: (props) => {
        return <MyComplexVisualization data={processedData} />;
      },
      
      getMetadata: () => ({ type: 'advanced_viz' }),
      
      // Core viz methods
      getSchema: () => mySettingsSchema,
      getSettings: () => currentSettings,
      getDefaultSettings: () => defaultSettings,
      settingsToTag: (settings) => convertToTag(settings)
    };
  }
};
```

## Using Plugins

### 1. Register Plugins with Renderer

```typescript
import { MalloyRenderer } from '@malloydata/malloy-render';

const renderer = new MalloyRenderer({
  plugins: [
    MyPluginFactory,
    MyDOMPluginFactory,
    AdvancedVizFactory
  ],
  pluginOptions: {
    'my_plugin': { color: 'blue' },
    'advanced_viz': { theme: 'dark' }
  }
});
```

### 2. Tag Fields in Malloy

```malloy
source: users is table('users') {
  dimension: 
    status # my_plugin
    age # advanced_viz { "max_value": 100 }
}
```

## Plugin Lifecycle

1. **Registration** - Plugins are registered when creating a MalloyRenderer
2. **Matching** - For each field, the system checks all plugins' `matches()` method
3. **Instantiation** - Matching plugins are instantiated via `create()`
4. **Data Processing** - Optional `processData()` is called during result processing
5. **Pre-render** - Optional `beforeRender()` prepares the rendering context
6. **Rendering** - `renderComponent()` or `renderToDOM()` displays the visualization
7. **Cleanup** - For DOM plugins, `cleanup()` is called when removing the visualization

## Best Practices

### 1. Field Type Validation
Always validate field types in `matches()` to prevent runtime errors:

```typescript
matches: (field, fieldTag, fieldType) => {
  if (fieldTag.has('my_chart') && fieldType !== FieldType.RepeatedRecord) {
    throw new Error('my_chart requires a repeated record field');
  }
  return fieldTag.has('my_chart') && fieldType === FieldType.RepeatedRecord;
}
```

### 2. Efficient Data Processing
Use `processData()` for expensive computations to avoid re-processing during re-renders:

```typescript
processData: (field, cell) => {
  // Calculate once during data loading
  this.aggregatedData = expensiveCalculation(cell);
}
```

### 3. Sizing Strategy
- Use `'fixed'` for plugins with predetermined dimensions
- Use `'fill'` for plugins that adapt to container size

### 4. Error Handling
Implement robust error handling to prevent breaking the entire visualization:

```typescript
renderComponent: (props) => {
  try {
    return <MyVisualization {...props} />;
  } catch (error) {
    return <div class="error">Visualization error: {error.message}</div>;
  }
}
```

### 5. Plugin Options
Accept configuration through pluginOptions for flexibility:

```typescript
create: (field, pluginOptions) => {
  const options = pluginOptions as MyPluginOptions || defaultOptions;
  // Use options in plugin implementation
}
```

## Built-in Plugins

Malloy Render includes several built-in plugins:

- **LineChartPlugin** - Time series and trend visualizations
- **BarChartPlugin** - Categorical data comparisons

These serve as excellent examples for creating custom plugins.

## Debugging

Enable console warnings to see plugin matching and instantiation issues:

```typescript
// Plugin instantiation failures are logged to console
console.warn(`Plugin ${factory.name} failed to instantiate for field ${field.key}:`, error);
```

## Future Considerations

The plugin system is designed to be extensible. Future enhancements may include:
- Plugin communication mechanisms
- Shared plugin state management
- Plugin composition patterns
- Enhanced lifecycle hooks