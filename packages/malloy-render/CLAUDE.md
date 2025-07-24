# Malloy Render Package Context

## Overview
This is the Malloy Renderer package (`@malloydata/render`), a web component for rendering Malloy query results. It provides visualization capabilities for Malloy query results and is included by default in the Malloy VSCode extension.

## Key Features
- JS component that can be embedded in applications
- Renders Malloy query results with various visualization types
- Plugin system for custom visualizations
- Built with SolidJS/TSX and Vega for charting

## Architecture

### Main Entry Points
- `src/index.ts` - Main package exports
- `src/api/malloy-renderer.ts` - Core renderer API
- `src/component/render.tsx` - Main render component

### Component Structure
- `src/component/` - SolidJS components for rendering
  - `chart/` - Chart visualization components
  - `table/` - Table visualization
  - `dashboard/` - Dashboard layouts
  - `vega/` - Vega chart integration

### Data Processing
- `src/data_tree/` - Data transformation utilities

### Plugin System
- `src/plugins/` - Built-in plugins (bar-chart, line-chart, etc.)
- Supports custom visualization plugins
- See `docs/plugin-*.md` for plugin documentation

## Development Notes

### Testing
- Stories for visual testing in `src/stories/`

### Building
- Uses Vite for building
- TypeScript configuration in `tsconfig.json`

### Common Tasks
When working on:
- **New visualizations**: Look at existing plugins in `src/plugins/`
- **Chart modifications**: See `src/component/chart/` and Vega integration
- **Plugin development**: Follow patterns in `src/plugins/` and refer to plugin docs

## Important Files
- `package.json` - Dependencies and scripts
- `vite.config.mts` - Build configuration
- `DEVELOPING.md` - Development setup instructions
- `src/stories/**` - Examples of how malloy queries are written with rendering tags
- `src/api/**` - Details on how the renderer processes data from a malloy query

## Line Chart Nested Data Support

### Overview

This section documents the architecture for supporting nested data in line charts. Currently, line charts only accept flat data and use Vega transforms to group by series. With this enhancement, line charts will also accept pre-nested Malloy query results.

### Current Architecture

- Line charts expect flat data with x, y, and series columns
- Data is grouped using Vega's facet transform (line 251 in generate-line_chart-vega-spec.ts)
- Field references are JSON-stringified arrays: `["field_name"]`
- The `walkFields` utility only traverses top-level fields

### Nested Data Support Design

#### 1. Deep Field Accessor Paths

Support nested field references using array notation in tags:
- `x='["nested_field", "x_field"]'` - JSON array format for nested paths
- Maintains consistency with existing field reference format

#### 2. Data Transformation Approach

**Recommended: Flatten in mapMalloyData**
- Detect nested data structure in the input
- Flatten nested rows while preserving series order
- Map to existing x/y/series structure
- Benefits:
  - Minimal changes to Vega spec
  - Preserves series ordering from query
  - Simpler initial implementation

#### 3. Automatic Field Detection

When no explicit tags are provided:
1. Detect single RepeatedRecordField in root (excluding those tagged with "tooltip")
2. Outer dimension → series
3. Inner dimension → x-axis
4. Inner measure → y-axis

#### 4. Example Queries

```malloy
# Flat query (current)
view: flat is {
  group_by: x_dim, series_dim
  aggregate: measure1
}

# Nested query (new)
view: nested is {
  group_by: series_dim
  nest: x_values is {
    group_by: x_dim
    aggregate: measure1
  }
}

# With explicit tags
# viz=line { series=series_dim x='["x_values", "x_dim"]' y='["x_values", "measure1"]' }

# With embedded tags
# viz=line
view: nested is {
  # series
  group_by: series_dim
  nest: x_values is {
    # x
    group_by: x_dim
    # y
    aggregate: measure1
  }
}
```

### Implementation Notes

- Phase 1: Core support with flattening approach
- Phase 2: Enhanced features (deep field walking, series preservation)
- Phase 3: Future optimization with native nested Vega handling

### Key Files for Line Chart Nested Data

- `get-line_chart-settings.ts`: Tag parsing and field resolution
- `generate-line_chart-vega-spec.ts`: Vega spec generation and data mapping
- `line-chart-plugin.tsx`: Main plugin entry point