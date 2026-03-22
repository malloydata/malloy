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

      // Optional: declare tag paths this plugin reads at render/interaction time.
      // Prevents false-positive "unknown tag" warnings for tags not read during setResult().
      getDeclaredTagPaths: () => [
        ['my_plugin', 'some_option'],
        ['my_plugin', 'nested', 'prop'],
      ],
    };
  },
};
```

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

### Error Handling: Renderable vs Loggable

Plugins produce two kinds of errors. The distinction is simple: **can the component still produce output?**

#### Renderable Errors (throw in `matches()` or `create()`)

The component **cannot render** — the data is fundamentally incompatible. Throw an error and the `ErrorPlugin` will replace the visualization with an error message in its place.

Use for:
- Missing required fields (e.g. bar chart has no x dimension)
- Wrong data shape (e.g. chart tag on a scalar field that isn't a nested query)
- Too many/few dimensions for the chart type

```typescript
matches: (field, fieldTag, fieldType) => {
  const hasTag = fieldTag.has('my_chart');
  if (hasTag && fieldType !== FieldType.RepeatedRecord) {
    // Can't render — show error where the chart would be
    throw new Error('My Chart: field must be a nested query');
  }
  return hasTag;
},
```

#### Loggable Errors (via `logCollector`)

The component **can still render** but a tag was wrong, ignored, or didn't do what the author intended. The visualization degrades gracefully (falls back to defaults). The log tells the author what to fix.

Use for:
- Invalid enum values (e.g. `# currency=yen` — unknown code, ignored)
- Tags on wrong field types (e.g. `# link` on a number — ignored)
- Misspelled tag properties (detected automatically via unread tag tracking)
- Invalid combinations (e.g. `# big_value` with `group_by` fields)

Loggable validation is centralized in `RenderFieldMetadata.validateFieldTags()` in `render-field-metadata.ts`, not in individual plugins. This keeps validation consistent and runs during `setResult()`, before rendering.

### Tag Validation

Tag validation runs in `validateFieldTags()` during `setResult()`. To add new validations:

```typescript
// In render-field-metadata.ts, inside validateFieldTags():

// 1. Tag on wrong field type
if (tag.has('my_tag') && fieldType !== FieldType.String) {
  log.error(
    `Tag 'my_tag' on field '${field.name}' requires a string field, but field is ${fieldType}`,
    tag.tag('my_tag')  // pass the tag for source location
  );
}

// 2. Invalid enum value
const modeVal = tag.text('my_tag', 'mode');
if (modeVal !== undefined) {
  const validModes = ['a', 'b', 'c'];
  if (!validModes.includes(modeVal)) {
    log.error(
      `Invalid my_tag mode '${modeVal}' on field '${field.name}'. Valid modes: ${validModes.join(', ')}`,
      tag.tag('my_tag')
    );
  }
}

// 3. Detect original literal type (e.g. bare number vs quoted string)
const myTag = tag.tag('my_tag');
if (myTag?.scalarType() === 'number') {
  log.error(
    `Tag 'my_tag' expects a quoted string, not a bare number`,
    myTag
  );
}
```

Always pass the relevant `Tag` object as the second argument to `log.error()` / `log.warn()` — it carries source location information that helps the author find the problem in their Malloy source.

### Tag Read Pattern for Components (Important)

Unread-tag warnings are part of typo/unknown-tag detection, so tag access patterns matter.

Preferred pattern:
1. Read/resolve tags during `setResult()` setup (for built-ins, use `resolveBuiltInTags()` in `tag-configs.ts` and/or `validateFieldTags()` in `render-field-metadata.ts`).
2. Store resolved values on fields (`setTagConfig`, `setResolvedLabel`, `setColumnConfig`).
3. In components, read resolved values (`getTagConfig`, `getLabel`, `getColumnConfig`) instead of reading `field.tag.*` directly at render time.

If a plugin intentionally reads tags during render/interaction, declare those paths via `getDeclaredTagPaths()` so they are marked as consumed.

### Unread Tag Detection

Tags track whether they've been accessed. Unread properties are logged as warnings to catch misspellings and unknown tags.

Current lifecycle:
1. `setResult()` builds `RenderFieldMetadata`, which runs setup-time resolution/validation and marks declared plugin paths (`getDeclaredTagPaths()` via `markDeclaredTags()`).
2. `getLogs()` and `onReady` both trigger unread-tag collection in `MalloyViz` (collection is one-time and idempotent).
3. Logs include semantic validation messages plus unread-tag warnings.

Notes:
- For built-in renderer tags, prefer setup-time reads in `resolveBuiltInTags()` over component-time reads.
- `onReady` is useful for UI flow completeness, but it is not strictly required to include unread-tag warnings in logs.

### Error Message Pattern (LLM-Friendly Guideline)

For validation errors, include explicit fix hints when possible. A useful guideline:

`Invalid <tag-path> on '<field>': expected <constraint>, got <value>. Fix: <example> (or <fallback>).`

Example:
- `Invalid # dashboard.gap on 'sales_dashboard': expected number >= 0, got -2. Fix: use '# dashboard { gap = 0 }' (or remove 'gap').`

Keep using `log.error(..., tagRef)` / `log.warn(..., tagRef)` with the relevant `Tag` object so source locations are preserved.

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
