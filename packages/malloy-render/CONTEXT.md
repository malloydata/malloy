# Malloy Render

The `malloy-render` package handles visualization and rendering of Malloy query results. It transforms query results into rich, interactive visualizations and tables.

## Purpose

Malloy queries return structured data with metadata about how it should be displayed. The render package:
- Interprets query result metadata
- Generates appropriate visualizations
- Provides interactive data exploration
- Supports multiple rendering formats

## Technology Stack

### Solid.js
The rendering system uses **Solid.js** as its reactive UI framework.

**Why Solid.js:**
- Fine-grained reactivity for efficient updates
- Small bundle size
- Excellent performance for data-heavy applications
- Simple, React-like API

### Vega
The package uses **Vega** for declarative data visualizations.

**Vega capabilities:**
- Grammar of graphics approach
- Declarative visualization specifications
- Wide range of chart types
- Interactive visualizations
- Composable and extensible

## Rendering Process

```
Query Results + Metadata → Renderer → Visualization Selection → Vega Spec / Table → UI Output
```

**Steps:**
1. Query results arrive with rendering metadata
2. Renderer examines result structure and annotations
3. Appropriate visualization type is selected
4. Vega specification is generated (for charts) or table is formatted
5. UI components render the visualization

## Rendering Hints

The renderer respects annotations and metadata from Malloy models:

- **Renderer annotations** (prefix `# `) provide display hints
- **Field types** influence default visualizations
- **Data structure** (nested, flat, aggregated) affects rendering choices
- **User preferences** can override defaults

## Visualization Types

The renderer supports various output formats:

- **Tables** - Default for most query results
- **Bar charts** - For categorical comparisons
- **Line charts** - For time series data
- **Scatter plots** - For correlation analysis
- **Nested tables** - For hierarchical data
- **Sparklines** - For inline visualizations
- And more...

## Package Integration

The render package integrates with:
- **malloy-core** - Consumes query results and metadata
- **VS Code extension** - Provides visualization in editor
- **Web applications** - Can be embedded in web apps
- **Reports** - Generates static visualizations

## Architecture

### Two Renderers
- **New renderer** (`src/component/`) - Solid.js-based, the default
- **Legacy renderer** (`src/html/`) - HTML string-based, activated with `## renderer_legacy` model tag

### Tag System
Render annotations use a tag API to check for rendering hints:
- `field.tag.has('pivot')` - Check if a tag exists
- `field.tag.text('label')` - Get a text property
- `field.tag.textArray('pivot', 'dimensions')` - Get array property with path
- `field.tag.tag('table', 'size')` - Navigate nested tag properties

Tags like `# pivot`, `# transpose`, `# flatten` are standalone tags (not properties of `# table`).

### Table Layout
The table uses CSS Grid with subgrid. Layout is calculated in `table-layout.ts`:
- `getTableLayout()` - Creates base layout from field structure
- `adjustLayoutForPivots()` - Adjusts column counts for pivot expansion
- Column ranges are tracked for each field to support nested tables

### Testing
Use Storybook (`npm run storybook`) to test visual changes. Stories are in `src/stories/*.stories.malloy`.

## Important Notes

- Rendering is **separate from query execution** - it only processes results
- The renderer is **stateless** - same results produce same visualizations
- Visualizations respect **user accessibility** preferences where possible
- The package is designed to be **embeddable** in various contexts
- **Never run the full test suite** without restrictions - use targeted tests or storybook
