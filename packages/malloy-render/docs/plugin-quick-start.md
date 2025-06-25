# Malloy Render Plugin Quick Start

## Minimal Plugin Example

```typescript
import type { RenderPluginFactory, SolidJSRenderPluginInstance } from '@/api/plugin-types';

export const MinimalPluginFactory: RenderPluginFactory<SolidJSRenderPluginInstance> = {
  name: 'minimal',

  matches: (field, fieldTag) => fieldTag.has('minimal'),

  create: (field) => ({
    name: 'minimal',
    field,
    renderMode: 'solidjs',
    sizingStrategy: 'fixed',

    renderComponent: (props) => (
      <div>{props.dataColumn.value}</div>
    ),

    getMetadata: () => ({ type: 'minimal' })
  })
};
```

## Key Concepts

### 1. Factory Pattern

- **Factory** creates plugin instances
- **Instance** handles rendering

### 2. Matching Fields

Plugins match fields based on:

- Tags (e.g., `# my_plugin`)
- Field types (String, Number, RepeatedRecord, etc.)
- Custom logic

### 3. Render Modes

- **solidjs**: Reactive components (recommended)
- **dom**: Direct DOM manipulation

### 4. Sizing Strategies

- **fixed**: Plugin controls its size
- **fill**: Adapts to container

## Common Patterns

### Chart Plugin

```typescript
matches: (field, fieldTag, fieldType) => {
  return fieldType === FieldType.RepeatedRecord && fieldTag.has('my_chart');
};
```

### Formatter Plugin

```typescript
matches: (field, fieldTag, fieldType) => {
  return fieldType === FieldType.Number && fieldTag.has('currency');
};
```

### Conditional Styling

```typescript
renderComponent: (props) => {
  const value = props.dataColumn.value;
  const className = value > 100 ? 'high' : 'low';
  return <div class={className}>{value}</div>;
}
```

## Usage in Malloy

```malloy
source: data is table('data.csv') {
  group_by:
    # currency
    price
    # my_chart
    sales_trend
}
```

## Registration

```typescript
const renderer = new MalloyRenderer({
  plugins: [MinimalPluginFactory],
});
```
