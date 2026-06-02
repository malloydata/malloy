# Malloy Render

The `malloy-render` package handles visualization and rendering of Malloy query results. It transforms query results into rich, interactive visualizations and tables.

**Related docs:** [README.md](./README.md) for public-facing installation and usage, [DEVELOPING.md](./DEVELOPING.md) for the local development workflow, [docs/validation.md](./docs/validation.md) for the renderer validation contract, [docs/plugin-system.md](./docs/plugin-system.md) / [docs/plugin-api-reference.md](./docs/plugin-api-reference.md) / [docs/plugin-quick-start.md](./docs/plugin-quick-start.md) for plugin authoring, [docs/renderer_tags_overview.md](./docs/renderer_tags_overview.md) and [docs/renderer_tag_cheatsheet.md](./docs/renderer_tag_cheatsheet.md) for the user-facing tag vocabulary.

Built on **Solid.js** (reactive UI) and **Vega** (declarative charts).

## Distribution & Public Surface

Ships as a **single UMD bundle** (`dist/module/index.umd.js`). `package.json` `exports` declares one entry; there are no subpath imports, no public ESM, no headless entry. All integration goes through `MalloyRenderer` (or the legacy `HTMLView`, still exported for the VS Code notebook schema view).

Two non-obvious consequences:

- **`@malloydata/malloy-tag` is a runtime dependency for type resolution only.** The UMD inlines malloy-tag (vite `external: []`); nothing escapes to `require()` at runtime. But the published `.d.ts` files (`api/plugin-types.d.ts`, `data_tree/fields/base.d.ts`, `util.d.ts`, etc.) re-export `Tag`, so consumer TypeScript needs the package installed.
- **The UMD cannot be loaded in Node without a DOM stub.** Solid.js calls `delegateEvents()` at module-eval time and reads `window.document`. The headless validator (`@malloydata/render-validator`) installs and removes global `window`/`document`/`navigator` stubs around its `require()` of this package; any other Node consumer must do the same.

`dist/module/index.mjs` exists but is not an exports entry — treat as internal.

### Public API

- `MalloyRenderer(options)` — factory; plugins registered here.
- `renderer.createViz(vizOptions)` → `MalloyViz` — per-result instance.
- `viz.setResult(result)` → `viz.render(element)` → optional `viz.remove()`. Tag validation runs in `setResult`; rendering can be skipped for headless use.
- `viz.getLogs()` — accumulated warnings/errors (consumed by VS Code diagnostics and `@malloydata/render-validator`).
- `viz.getHTML()` — off-screen render to HTML string for export/clipboard.
- Consumer callbacks via `createViz` options: `onDrill(DrillData)`, `onReady()`, `onClick`, plus `tableConfig`.
- Theming is bridged via `--malloy-*` CSS custom properties on the host element.

## Architecture

### Two Renderers
- **New renderer** (`src/component/`) — Solid.js, the default.
- **Legacy renderer** (`src/html/`) — HTML strings, activated with `## renderer_legacy`. Still publicly exported as `HTMLView`.

### Dispatch

`RenderFieldMetadata` (`src/render-field-metadata.ts`) is the orchestrator: for each field it runs every plugin factory's `matches()` and attaches the first hit. At render time, `applyRenderer` (`src/component/renderer/apply-renderer.tsx`) uses the plugin if one matched, otherwise switches on the field's precomputed `renderAs()` value (`table`, `dashboard`, `link`, `image`, `list`, `cell`).

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

Plugins add visualization types. Two parts:

1. **`RenderPluginFactory`** — registered globally; `matches()` decides applicability, `create()` builds instances.
2. **`RenderPluginInstance`** — per-field; handles rendering, data processing, metadata.

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

```typescript
import {MalloyRenderer} from '@malloydata/render';

const renderer = new MalloyRenderer({plugins: [MyPluginFactory]});
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

### Validation

Renderer tags are validated during `setResult()`; the log messages drive the VS Code Problems panel and the headless `@malloydata/render-validator`. **Before adding tags, validation rules, or plugin error throws, read [docs/validation.md](docs/validation.md).**

The short version for plugin authors:
- Tag-quality errors (wrong type, invalid enum, structural rule) belong in `validateFieldTags()` with `log.error(msg, tagRef)` so source locations survive.
- `throw` from `matches()` / `create()` only when the plugin literally cannot produce output; throws are wrapped and **lose the `Tag` reference**.
- Any tag read after `setResult()` returns must be in a setup-time resolver (`tag-configs.ts`) or in `getValidationSpec().ownedPaths` / `childOwnedPaths`, or it will trigger false unread-tag warnings.

### Rendering Modes

- **`solidjs`** — return a `JSXElement` from `renderComponent()`. Used by built-in charts and tables.
- **`dom`** — implement `renderToDOM(container, props)` for direct DOM manipulation (for third-party libraries that need a DOM node). Optional `cleanup(container)`.

### Core Viz Plugins

Plugins that implement `CoreVizPluginMethods` (settings schema, serialization to/from tags) get additional integration with the settings UI. See `CoreVizPluginInstance` in `plugin-types.ts`.

## Important Notes

- The renderer is **stateless** — same result produces the same visualization.
- **Never run the full test suite** without restrictions — use targeted tests or storybook.
