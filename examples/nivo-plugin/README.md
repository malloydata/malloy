# Malloy Nivo Plugin Example

This example demonstrates how to integrate [Nivo](https://nivo.rocks/) - a powerful React charting library - with Malloy's plugin system to create rich, interactive data visualizations.

## Overview

This example includes two complete plugin implementations:

1. **Nivo Bar Chart Plugin** - Visualize categorical data with customizable bar charts
2. **Nivo Pie Chart Plugin** - Show proportions and distributions with pie/donut charts

Both plugins demonstrate the DOM-based rendering approach, using React and ReactDOM to render Nivo components within Malloy's visualization framework.

## Features

- **Multiple Chart Types**: Bar charts and pie charts with full Nivo functionality
- **Customizable**: Configure colors, layouts, legends, animations, and more
- **Type-Safe**: Full TypeScript support with proper type definitions
- **Production-Ready**: Error handling, cleanup, and best practices included
- **Easy Integration**: Simple plugin registration with Malloy renderer

## Installation

```bash
# Install dependencies
npm install @malloy-examples/nivo-plugin

# Peer dependencies (if not already installed)
npm install @malloydata/render @malloydata/malloy-tag react react-dom
```

## Quick Start

### 1. Register Plugins

```typescript
import { MalloyRenderer } from '@malloydata/render';
import {
  NivoBarChartPluginFactory,
  NivoPieChartPluginFactory,
} from '@malloy-examples/nivo-plugin';

const renderer = new MalloyRenderer({
  plugins: [
    NivoBarChartPluginFactory,
    NivoPieChartPluginFactory
  ],
  pluginOptions: {
    nivo_bar_chart: {
      colorScheme: 'category10',
      showLegends: true,
      padding: 0.3
    },
    nivo_pie_chart: {
      colorScheme: 'nivo',
      innerRadius: 0.5  // Creates donut chart
    }
  }
});
```

### 2. Use in Malloy Queries

```malloy
source: sales is table('sales.parquet') {
  dimension: product_name, category
  measure: total_revenue is sum(revenue)
}

// Bar chart visualization
query: sales -> {
  nest: by_product is {
    group_by: product_name
    aggregate: total_revenue
  } # nivo_bar_chart
}

// Pie chart visualization
query: sales -> {
  nest: by_category is {
    group_by: category
    aggregate: total_revenue
  } # nivo_pie_chart
}
```

## Plugin Details

### Nivo Bar Chart Plugin

**Tag**: `#nivo_bar_chart`

**Requirements**:
- Field must be a repeated record (nested data)
- Should contain at least one dimension (for x-axis) and one measure (for y-axis)

**Options**:
```typescript
{
  colorScheme?: string;        // Color scheme (default: 'nivo')
  showLegends?: boolean;       // Show/hide legends (default: true)
  enableAnimations?: boolean;  // Enable animations (default: true)
  padding?: number;            // Bar padding 0-1 (default: 0.3)
  layout?: 'horizontal' | 'vertical';  // Chart orientation (default: 'vertical')
}
```

**Example**:
```malloy
query: product_sales is sales -> {
  nest: top_10 is {
    group_by: product_name
    aggregate:
      revenue is sum(revenue)
      units is sum(units_sold)
    order_by: revenue desc
    limit: 10
  } # nivo_bar_chart
}
```

### Nivo Pie Chart Plugin

**Tag**: `#nivo_pie_chart`

**Requirements**:
- Field must be a repeated record
- Should contain one dimension (slice labels) and one measure (slice values)

**Options**:
```typescript
{
  colorScheme?: string;           // Color scheme (default: 'nivo')
  enableSliceLabels?: boolean;    // Show slice labels (default: true)
  enableArcLinkLabels?: boolean;  // Show arc link labels (default: true)
  innerRadius?: number;           // Inner radius 0-1 (0=pie, >0=donut, default: 0)
  padAngle?: number;              // Angle between slices in degrees (default: 0.7)
  cornerRadius?: number;          // Corner radius of slices (default: 3)
}
```

**Example**:
```malloy
query: market_share is sales -> {
  nest: by_category is {
    group_by: category
    aggregate: share is sum(revenue)
  } # nivo_pie_chart
}
```

## Architecture

### DOM-Based Rendering

These plugins use DOM-based rendering (as opposed to SolidJS components) because Nivo is built for React. The architecture works as follows:

1. **Plugin Factory** matches fields with appropriate tags
2. **Plugin Instance** transforms Malloy data to Nivo format
3. **React Component** renders using Nivo's ResponsiveBar/ResponsivePie
4. **ReactDOM** mounts the component into the provided DOM container
5. **Cleanup** unmounts React component when visualization is removed

```typescript
renderToDOM: (container: HTMLElement, props: RenderProps): void => {
  // Transform Malloy data
  const data = transformMalloyDataToNivoFormat(props);

  // Create React component
  const NivoChart = () => <ResponsiveBar data={data} {...options} />;

  // Render to DOM
  const root = ReactDOM.createRoot(container);
  root.render(<NivoChart />);
}
```

### Data Transformation

The plugins automatically transform Malloy's repeated record format to Nivo's expected data structure:

**Malloy Data**:
```javascript
{
  rows: [
    { product_name: "Widget A", revenue: 1000 },
    { product_name: "Widget B", revenue: 1500 }
  ]
}
```

**Nivo Bar Format**:
```javascript
[
  { product_name: "Widget A", revenue: 1000 },
  { product_name: "Widget B", revenue: 1500 }
]
```

**Nivo Pie Format**:
```javascript
[
  { id: "Widget A", value: 1000 },
  { id: "Widget B", value: 1500 }
]
```

## Project Structure

```
nivo-plugin/
├── src/
│   ├── nivo-bar-chart-plugin.tsx    # Bar chart plugin implementation
│   ├── nivo-pie-chart-plugin.tsx    # Pie chart plugin implementation
│   └── index.ts                      # Plugin exports
├── examples/
│   ├── usage-example.ts              # TypeScript usage example
│   └── sample-queries.malloy         # Malloy query examples
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # This file
```

## Advanced Usage

### Custom Color Schemes

Nivo supports many built-in color schemes:
- `nivo`, `category10`, `accent`, `dark2`, `paired`, `pastel1`, `pastel2`, `set1`, `set2`, `set3`
- Plus many more from D3 scales

```typescript
pluginOptions: {
  nivo_bar_chart: {
    colorScheme: 'category10'
  }
}
```

### Donut Charts

Create donut charts by setting `innerRadius` > 0:

```typescript
pluginOptions: {
  nivo_pie_chart: {
    innerRadius: 0.5,  // 0.5 = 50% inner radius
    padAngle: 2,
    cornerRadius: 4
  }
}
```

### Multiple Visualizations

Create dashboards with multiple Nivo visualizations:

```malloy
query: sales_dashboard is sales -> {
  nest:
    // Bar chart
    top_products is {
      group_by: product_name
      aggregate: revenue is sum(revenue)
      limit: 5
    } # nivo_bar_chart

    // Pie chart
    category_split is {
      group_by: category
      aggregate: total is sum(revenue)
    } # nivo_pie_chart
}
```

## Error Handling

Both plugins include comprehensive error handling:

- **Field Type Validation**: Ensures fields are repeated records
- **Data Validation**: Checks for required dimensions and measures
- **Graceful Degradation**: Shows error messages instead of breaking
- **Console Logging**: Errors are logged for debugging

## Building from Source

```bash
# Clone the repository
git clone https://github.com/malloydata/malloy.git
cd malloy/examples/nivo-plugin

# Install dependencies
npm install

# Build
npm run build

# Clean build artifacts
npm run clean
```

## Contributing

This is an example implementation demonstrating the Malloy plugin system. Feel free to:

- Extend with additional Nivo chart types (line, scatter, heatmap, etc.)
- Add more customization options
- Improve data transformation logic
- Contribute back to the Malloy project

## Resources

- [Malloy Documentation](https://malloydata.github.io/malloy/)
- [Malloy Plugin System Docs](https://github.com/malloydata/malloy/blob/main/packages/malloy-render/docs/plugin-system.md)
- [Nivo Documentation](https://nivo.rocks/)
- [Nivo Component Explorer](https://nivo.rocks/components)
- [Nivo GitHub](https://github.com/plouc/nivo)

## License

MIT

## Learn More

For more information about creating Malloy plugins:
- See the [Malloy Plugin System Documentation](https://github.com/malloydata/malloy/blob/main/packages/malloy-render/docs/plugin-system.md)
- Explore other plugin examples in the Malloy repository
- Join the [Malloy Community](https://github.com/malloydata/malloy/discussions)

---

**Note**: This example uses React for Nivo integration. If you prefer not to use React, consider using other charting libraries that support vanilla JavaScript/TypeScript, or explore Nivo's server-side rendering capabilities.
