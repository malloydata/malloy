# Nivo Plugin Implementation Guide

This guide explains how the Malloy Nivo plugins were built and how you can create similar plugins for other charting libraries.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Implementation Decisions](#key-implementation-decisions)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Data Transformation Strategy](#data-transformation-strategy)
5. [Error Handling](#error-handling)
6. [Testing Considerations](#testing-considerations)
7. [Extending to Other Chart Types](#extending-to-other-chart-types)

## Architecture Overview

### Why DOM-Based Rendering?

Nivo is built for React, but Malloy uses SolidJS. We chose DOM-based rendering to:

1. **Avoid Framework Conflicts**: React and SolidJS have different reactivity models
2. **Leverage Nivo Directly**: Use Nivo's full feature set without adaptation
3. **Maintain Isolation**: Keep React rendering isolated within the plugin
4. **Simplify Cleanup**: Use React's own cleanup mechanisms

### Plugin Lifecycle

```
Registration → Matching → Instantiation → Render → Cleanup
     ↓             ↓            ↓            ↓         ↓
  Config      Field Tags    Create        DOM      Unmount
  Options     Validation    Instance    Render     React
```

## Key Implementation Decisions

### 1. Plugin Type Selection

**Decision**: Use `DOMRenderPluginInstance` instead of `SolidJSRenderPluginInstance`

**Rationale**:
- Nivo components are React-based
- DOM rendering provides clean separation
- Avoids complex framework bridging

```typescript
export interface DOMRenderPluginInstance {
  readonly renderMode: 'dom';
  renderToDOM(container: HTMLElement, props: RenderProps): void;
  cleanup?(container: HTMLElement): void;
}
```

### 2. React Root Management

**Decision**: Store React root in closure, create once, reuse

**Rationale**:
- Avoids creating multiple roots
- Proper cleanup on unmount
- Matches React 18 best practices

```typescript
create: (field: Field, pluginOptions?: unknown) => {
  let reactRoot: ReactDOM.Root | null = null;

  return {
    renderToDOM: (container, props) => {
      if (!reactRoot) {
        reactRoot = ReactDOM.createRoot(container);
      }
      reactRoot.render(<Component />);
    },
    cleanup: (container) => {
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
    }
  };
}
```

### 3. Data Transformation

**Decision**: Transform data in `renderToDOM`, not `processData`

**Rationale**:
- `processData` is optional and for expensive pre-computation
- Simple transformations can happen during render
- Keeps data fresh on re-renders

## Step-by-Step Implementation

### Step 1: Define Plugin Metadata

```typescript
interface NivoBarChartPluginMetadata {
  type: 'nivo_bar_chart';
  fieldName: string;
  // Add any metadata you need for debugging or introspection
}
```

### Step 2: Define Plugin Options

```typescript
interface NivoBarChartOptions {
  colorScheme?: string;
  showLegends?: boolean;
  // Include all user-configurable options
}
```

### Step 3: Create Plugin Factory

```typescript
export const NivoBarChartPluginFactory: RenderPluginFactory<
  DOMRenderPluginInstance<NivoBarChartPluginMetadata>
> = {
  name: 'nivo_bar_chart',

  matches: (field, fieldTag, fieldType) => {
    const hasTag = fieldTag.has('nivo_bar_chart');
    const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

    // Validation
    if (hasTag && !isRepeatedRecord) {
      throw new Error('Plugin requires repeated record field');
    }

    return hasTag && isRepeatedRecord;
  },

  create: (field, pluginOptions) => {
    // Implementation in next steps
  }
};
```

### Step 4: Implement Data Transformation

```typescript
renderToDOM: (container, props) => {
  if (!props.dataColumn.isRepeatedRecord()) {
    // Handle error
    return;
  }

  const rows = props.dataColumn.rows;
  const childFields = props.field.isNest()
    ? props.field.children
    : [];

  // Transform to Nivo format
  const data = rows.map(row => {
    const datum: Record<string, any> = {};
    childFields.forEach(field => {
      const cell = row.column(field.name);
      datum[field.name] = cell.value ?? null;
    });
    return datum;
  });

  // Continue with rendering...
}
```

### Step 5: Render React Component

```typescript
const NivoChart = () => (
  <div style={{ width: '100%', height: '400px' }}>
    <ResponsiveBar
      data={data}
      // ...Nivo configuration
    />
  </div>
);

if (!reactRoot) {
  reactRoot = ReactDOM.createRoot(container);
}
reactRoot.render(<NivoChart />);
```

### Step 6: Implement Cleanup

```typescript
cleanup: (container) => {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  container.innerHTML = '';
}
```

### Step 7: Add Metadata

```typescript
getMetadata: () => ({
  type: 'nivo_bar_chart',
  fieldName: field.name,
})
```

## Data Transformation Strategy

### Understanding Malloy Data Structure

Malloy repeated records come as:
```typescript
{
  rows: Array<{
    column(name: string): Cell
  }>
}
```

### Transformation Pattern

```typescript
function transformMalloyToNivo(props: RenderProps) {
  const rows = props.dataColumn.rows;
  const fields = props.field.isNest() ? props.field.children : [];

  return rows.map(row => {
    const item: Record<string, any> = {};
    fields.forEach(field => {
      const cell = row.column(field.name);
      let value = cell.value;

      // Handle nulls
      if (value === null || value === undefined) {
        value = field.isNumber() ? 0 : '';
      }

      // Type coercion if needed
      if (field.isNumber()) {
        value = Number(value);
      } else if (field.isDate() || field.isTime()) {
        value = String(value);
      }

      item[field.name] = value;
    });
    return item;
  });
}
```

### Chart-Specific Transformations

#### Bar Charts
- Use all fields as-is
- First non-numeric field becomes `indexBy`
- All numeric fields become `keys`

#### Pie Charts
- Need exactly two fields: label and value
- Transform to `{ id, label, value }` format

## Error Handling

### Validation Levels

1. **Match-Time Validation** (in `matches`):
   ```typescript
   matches: (field, fieldTag, fieldType) => {
     const hasTag = fieldTag.has('my_chart');
     if (hasTag && fieldType !== FieldType.RepeatedRecord) {
       throw new Error('Chart requires repeated record');
     }
     return hasTag && fieldType === FieldType.RepeatedRecord;
   }
   ```

2. **Render-Time Validation** (in `renderToDOM`):
   ```typescript
   if (!props.dataColumn.isRepeatedRecord()) {
     container.innerHTML = '<div>Error: Invalid data type</div>';
     return;
   }

   if (rows.length === 0) {
     container.innerHTML = '<div>No data available</div>';
     return;
   }
   ```

3. **Try-Catch for Rendering**:
   ```typescript
   try {
     // Rendering logic
   } catch (error) {
     console.error('Rendering error:', error);
     container.innerHTML = `<div>Error: ${error.message}</div>`;
   }
   ```

## Testing Considerations

### Unit Tests

1. **Test Plugin Matching**:
   ```typescript
   test('matches fields with correct tag', () => {
     const field = createMockField();
     const tag = createMockTag(['nivo_bar_chart']);
     expect(factory.matches(field, tag, FieldType.RepeatedRecord)).toBe(true);
   });
   ```

2. **Test Data Transformation**:
   ```typescript
   test('transforms Malloy data to Nivo format', () => {
     const malloyData = createMockMalloyData();
     const nivoData = transformData(malloyData);
     expect(nivoData).toMatchSnapshot();
   });
   ```

3. **Test Error Cases**:
   ```typescript
   test('throws on invalid field type', () => {
     expect(() => {
       factory.matches(field, tag, FieldType.String);
     }).toThrow();
   });
   ```

### Integration Tests

Test with actual Malloy queries and data:

```typescript
test('renders bar chart from Malloy query', async () => {
  const result = await runMalloyQuery(query);
  const container = document.createElement('div');
  plugin.renderToDOM(container, {
    dataColumn: result.data,
    field: result.field
  });
  expect(container.querySelector('.nivo-bar')).toBeTruthy();
});
```

## Extending to Other Chart Types

### Adding a Line Chart

```typescript
export const NivoLineChartPluginFactory: RenderPluginFactory<...> = {
  name: 'nivo_line_chart',
  matches: (field, fieldTag, fieldType) => {
    return fieldTag.has('nivo_line_chart') &&
           fieldType === FieldType.RepeatedRecord;
  },
  create: (field, pluginOptions) => {
    return {
      renderToDOM: (container, props) => {
        // Transform to line chart format:
        // [{ id: 'series', data: [{x, y}] }]
        const data = transformToLineFormat(props);

        const LineChart = () => (
          <ResponsiveLine data={data} {...options} />
        );

        // Render...
      }
    };
  }
};
```

### Adding a Heatmap

```typescript
export const NivoHeatMapPluginFactory: RenderPluginFactory<...> = {
  name: 'nivo_heatmap',
  matches: (field, fieldTag, fieldType) => {
    return fieldTag.has('nivo_heatmap') &&
           fieldType === FieldType.RepeatedRecord;
  },
  create: (field, pluginOptions) => {
    return {
      renderToDOM: (container, props) => {
        // Transform to heatmap format:
        // [{ id: 'row', data: [{x, y}] }]
        const data = transformToHeatmapFormat(props);

        const HeatMap = () => (
          <ResponsiveHeatMap data={data} {...options} />
        );

        // Render...
      }
    };
  }
};
```

## Best Practices

1. **Always Validate Field Types**: Throw early if wrong type
2. **Handle Null/Undefined**: Provide sensible defaults
3. **Cleanup React Roots**: Prevent memory leaks
4. **Provide Error Messages**: Help users debug issues
5. **Document Options**: Make configuration clear
6. **Type Everything**: Use TypeScript for safety
7. **Test Edge Cases**: Empty data, null values, wrong types

## Common Pitfalls

1. **Not Unmounting React**: Always cleanup in `cleanup()`
2. **Creating Multiple Roots**: Reuse the React root
3. **Ignoring Null Values**: Handle missing data gracefully
4. **Missing Type Checks**: Validate before transforming
5. **Poor Error Messages**: Be specific about requirements

## Performance Considerations

1. **Use `processData` for Expensive Operations**:
   ```typescript
   processData: (field, cell) => {
     // Expensive aggregations, sorting, etc.
     this.cachedData = expensiveOperation(cell);
   }
   ```

2. **Memoize Transformations** (if needed):
   ```typescript
   let lastProps: RenderProps | null = null;
   let cachedData: any[] | null = null;

   renderToDOM: (container, props) => {
     if (props !== lastProps) {
       cachedData = transform(props);
       lastProps = props;
     }
     // Use cachedData...
   }
   ```

3. **Limit Data Size**: Consider adding row limits for large datasets

## Further Reading

- [Malloy Plugin System Docs](https://github.com/malloydata/malloy/blob/main/packages/malloy-render/docs/plugin-system.md)
- [Nivo Documentation](https://nivo.rocks/)
- [React 18 API Reference](https://react.dev/reference/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Questions or Issues?** Open an issue on the [Malloy GitHub repository](https://github.com/malloydata/malloy/issues).
