# Malloy Render

The `malloy-render` package handles visualization and rendering of Malloy query results. It transforms query results into rich, interactive visualizations and tables.

**Related docs:** [README.md](./README.md) for public-facing installation and usage, [DEVELOPING.md](./DEVELOPING.md) for the local development workflow, [docs/validation.md](./docs/validation.md) for the renderer validation contract.

## Purpose

Malloy queries return structured data with metadata about how it should be displayed. The render package:
- Interprets query result metadata
- Generates appropriate visualizations
- Provides interactive data exploration
- Supports multiple rendering formats

## Technology Stack

### Solid.js
The rendering system uses **Solid.js** as its reactive UI framework.

### Vega
The package uses **Vega** for declarative data visualizations.

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
Render annotations use the Malloy Tag API to check for rendering hints. For tag language syntax, see [packages/malloy-tag/CONTEXT.md](../malloy-tag/CONTEXT.md).
Low-level Tag API patterns (primarily for setup-time resolution/validation code):
- `field.tag.has('pivot')` - Check if a tag exists
- `field.tag.text('label')` - Get a text property
- `field.tag.textArray('pivot', 'dimensions')` - Get array property with path
- `field.tag.tag('table', 'size')` - Navigate nested tag properties

Component code should prefer resolved values from field metadata when available:
- `field.getTagConfig<T>()`
- `field.getLabel()`
- `field.getColumnConfig<T>()`

### Table Layout
The table uses CSS Grid with subgrid. Layout is calculated in `table-layout.ts`:
- `getTableLayout()` - Creates base layout from field structure
- `adjustLayoutForPivots()` - Adjusts column counts for pivot expansion
- Column ranges are tracked for each field to support nested tables

### Testing
Use Storybook (`npm run storybook`) to test visual changes. Stories are in `src/stories/*.stories.malloy`.
For non-visual logic (settings serialization, tag parsing, drill query behavior, utility formatting), add targeted Jest tests under `src/**/*.spec.ts` where possible.

## Plugin System

Render plugins are the mechanism for adding new visualization types to the renderer. Each plugin is a factory that matches fields based on their tags and data type, then creates an instance that renders the visualization.

### Plugin Architecture

A plugin has two parts:

1. **`RenderPluginFactory`** — Registered globally. Decides whether a field should use this plugin (`matches()`) and creates instances (`create()`).
2. **`RenderPluginInstance`** — Created per-field. Handles rendering, data processing, and metadata.

```
RenderPluginFactory.matches(field, tag, fieldType)
  → true: RenderPluginFactory.create(field) → RenderPluginInstance
  → false: skip this plugin
```

### Writing a Plugin

#### 1. Create the Factory

```typescript
import type {RenderPluginFactory, RenderPluginInstance, RenderProps} from '@/api/plugin-types';
import type {Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';

export const MyPluginFactory: RenderPluginFactory = {
  name: 'my_plugin',

  matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
    // Check if the field's tag requests this plugin
    return fieldTag.has('my_plugin');
  },

  create: (field: Field): RenderPluginInstance => {
    // Validate field structure — throw if the data shape is wrong
    if (!field.isNest()) {
      throw new Error('My Plugin: field must be a nested query');
    }

    return {
      name: 'my_plugin',
      field,
      renderMode: 'solidjs',     // or 'dom' for raw DOM rendering
      sizingStrategy: 'fixed',   // or 'fill' to expand to container

      renderComponent: (props: RenderProps): JSXElement => {
        // Render the visualization
        return <div>...</div>;
      },

      getMetadata: () => ({ /* plugin-specific metadata */ }),
    };
  },
};
```

#### Renderer Validation Spec

Plugins and built-in renderers can declare semantic tag ownership with `RendererValidationSpec`.

Use it to declare:
- tags owned on the renderer field itself (`ownedPaths`)
- context-sensitive tags owned on direct children (`childOwnedPaths`)

```typescript
export const MyPluginFactory: RenderPluginFactory = {
  name: 'my_plugin',

  getValidationSpec: () => ({
    renderer: 'my_plugin',
    ownedPaths: [['my_plugin']],
    childOwnedPaths: [['tooltip']],
  }),

  matches: (field, fieldTag, fieldType) => {
    return fieldTag.has('my_plugin');
  },

  create: (field) => { /* ... */ },
};
```

Important:
- declare tags this renderer **owns**, not every tag it might incidentally read
- if removing this renderer would make the tag meaningless, declare it here
- do not declare globally meaningful tags like `label`, `hidden`, `description`, `column`

#### 2. Register the Plugin

Plugins are registered when creating a `MalloyRenderer`:

```typescript
import {MalloyRenderer} from '@malloydata/render';

const renderer = new MalloyRenderer({
  plugins: [MyPluginFactory],
});
```

### Plugin Lifecycle

```
setResult()
  → RenderFieldMetadata constructed
    → For each field in schema:
      → factory.matches(field, tag, fieldType)  — can the plugin handle this?
      → factory.create(field)                   — create instance (may throw)
      → validateFieldTags(field)                — semantic tag validation
      → markOwnedTagPaths(field, factories)     — mark renderer-owned tag paths
render(element)
  → Solid.js mounts component tree
    → plugin.beforeRender(metadata, options)    — pre-render setup (e.g. generate Vega spec)
    → plugin.processData(field, cell)           — process data rows
    → plugin.renderComponent(props)             — produce UI
  → onReady fires when rendering is visually complete
getLogs()
  → Returns all collected warnings and errors
```

For headless validation workflows, `setResult()` + `getLogs()` can be used without rendering.

### Validation

Renderer tags are validated during `setResult()` and the resulting log messages drive the VS Code Problems panel and the headless `@malloydata/render-validator` package. **Before adding tags, validation rules, or plugin error throws, read [docs/validation.md](docs/validation.md).** It covers what validation is, how it works, where new checks go, and the pre-PR checklist that keeps the validator honest.

The short version for plugin authors:
- Tag-quality errors (wrong type, invalid enum, structural rule) belong in `validateFieldTags()` with `log.error(msg, tagRef)` so source locations survive.
- `throw` from `matches()` / `create()` only when the plugin literally cannot produce output; throws are wrapped and **lose the `Tag` reference**.
- Any tag read after `setResult()` returns must be in a setup-time resolver (`tag-configs.ts`) or in `getValidationSpec().ownedPaths` / `childOwnedPaths`, or it will trigger false unread-tag warnings.

### Rendering Modes

Plugins can render in two modes:

- **`solidjs`** — Return a `JSXElement` from `renderComponent()`. Used by built-in chart and table plugins.
- **`dom`** — Implement `renderToDOM(container, props)` for direct DOM manipulation. Useful for third-party libraries that need a DOM node. Optionally implement `cleanup(container)`.

### Core Viz Plugins

Plugins that implement `CoreVizPluginMethods` (settings schema, serialization to/from tags) get additional integration with the settings UI. See `CoreVizPluginInstance` in `plugin-types.ts`.

## Important Notes

- Rendering is **separate from query execution** - it only processes results
- The renderer is **stateless** - same results produce same visualizations
- Visualizations respect **user accessibility** preferences where possible
- The package is designed to be **embeddable** in various contexts
- **Never run the full test suite** without restrictions - use targeted tests or storybook
