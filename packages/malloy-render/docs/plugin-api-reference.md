# Plugin API Reference

## Core Types

### RenderPluginFactory<TInstance>

```typescript
interface RenderPluginFactory<TInstance extends RenderPluginInstance> {
  readonly name: string;
  matches(field: Field, fieldTag: Tag, fieldType: FieldType): boolean;
  create(field: Field, pluginOptions?: unknown, modelTag?: Tag): TInstance;
}
```

#### Properties
- `name`: Unique identifier for the plugin

#### Methods
- `matches()`: Determines if plugin should handle a field
  - `field`: Field metadata and structure
  - `fieldTag`: Field annotations/tags
  - `fieldType`: Enumerated field type
  - Returns: `boolean`

- `create()`: Instantiates plugin for a matched field
  - `field`: Field to render
  - `pluginOptions`: Configuration from renderer options
  - `modelTag`: Model-level annotations
  - Returns: Plugin instance

### RenderPluginInstance

Base type: Union of `SolidJSRenderPluginInstance` and `DOMRenderPluginInstance`

#### Common Properties
```typescript
interface BaseRenderPluginInstance<TMetadata = unknown> {
  readonly name: string;
  readonly field: Field;
  readonly sizingStrategy: 'fixed' | 'fill';
  
  getMetadata(): TMetadata;
  processData?(field: NestField, cell: NestCell): void;
  beforeRender?(metadata: RenderMetadata, options: GetResultMetadataOptions): void;
}
```

### SolidJSRenderPluginInstance

```typescript
interface SolidJSRenderPluginInstance<TMetadata = unknown>
  extends BaseRenderPluginInstance<TMetadata> {
  readonly renderMode: 'solidjs';
  renderComponent(props: RenderProps): JSXElement;
}
```

### DOMRenderPluginInstance

```typescript
interface DOMRenderPluginInstance<TMetadata = unknown>
  extends BaseRenderPluginInstance<TMetadata> {
  readonly renderMode: 'dom';
  renderToDOM(container: HTMLElement, props: RenderProps): void;
  cleanup?(container: HTMLElement): void;
}
```

### CoreVizPluginInstance

```typescript
interface CoreVizPluginMethods {
  getSchema(): JSONSchemaObject;
  getSettings(): Record<string, unknown>;
  getDefaultSettings(): Record<string, unknown>;
  settingsToTag(settings: Record<string, unknown>): Tag;
}

type CoreVizPluginInstance<TMetadata = unknown> = 
  SolidJSRenderPluginInstance<TMetadata> & CoreVizPluginMethods;
```

## Supporting Types

### RenderProps

```typescript
interface RenderProps {
  dataColumn: Cell;
  field: Field;
  customProps?: Record<string, unknown>;
}
```

### FieldType Enum

```typescript
enum FieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Timestamp = 'timestamp',
  JSON = 'json',
  Record = 'record',
  RepeatedRecord = 'repeated_record',
  SQLNative = 'sql_native'
}
```

### Field Interface (Key Methods)

```typescript
interface Field {
  name: string;
  key: string;
  tag: Tag;
  
  isString(): boolean;
  isNumber(): boolean;
  isBoolean(): boolean;
  isDate(): boolean;
  isTime(): boolean;
  isJSON(): boolean;
  isNest(): boolean;
  isBasic(): boolean;
  
  // For nested fields
  fields?: Field[];
  fieldAt(path: string): Field | undefined;
}
```

### Cell Interface (Key Methods)

```typescript
interface Cell {
  value: any;
  
  isNull(): boolean;
  isString(): boolean;
  isNumber(): boolean;
  isBoolean(): boolean;
  isDate(): boolean;
  isTime(): boolean;
  isJSON(): boolean;
  isRepeatedRecord(): boolean;
  
  // For nested cells
  column(name: string): Cell;
}
```

### Tag Interface (Key Methods)

```typescript
interface Tag {
  has(key: string): boolean;
  text(key: string): string | undefined;
  boolean(key: string): boolean | undefined;
  number(key: string): number | undefined;
  json(key: string): any | undefined;
}
```

## Renderer Integration

### MalloyRendererOptions

```typescript
interface MalloyRendererOptions {
  plugins?: RenderPluginFactory[];
  pluginOptions?: Record<string, unknown>;
  // ... other options
}
```

### Plugin Registration

```typescript
const renderer = new MalloyRenderer({
  plugins: [Plugin1Factory, Plugin2Factory],
  pluginOptions: {
    'plugin1': { /* options */ },
    'plugin2': { /* options */ }
  }
});
```

## Utility Functions

### isCoreVizPluginInstance

```typescript
function isCoreVizPluginInstance(
  plugin: RenderPluginInstance
): plugin is CoreVizPluginInstance
```

Checks if a plugin implements the core visualization interface.

## Lifecycle Methods

### processData(field, cell)
- Called during data processing phase
- Use for expensive calculations
- Results can be stored in plugin instance

### beforeRender(metadata, options)
- Called before rendering
- Access to full result metadata
- Can access Vega config overrides

### renderComponent(props) / renderToDOM(container, props)
- Called to render the visualization
- Access to current data cell and field metadata

### cleanup(container)
- DOM plugins only
- Called when visualization is removed
- Clean up event listeners, timers, etc.