# Malloy Render

The `malloy-render` package handles visualization and rendering of Malloy query results. It transforms query results into rich, interactive visualizations and tables.

**Related docs:** [README.md](./README.md) for public-facing installation and usage, [DEVELOPING.md](./DEVELOPING.md) for the local development workflow, [docs/validation.md](./docs/validation.md) for the renderer validation contract, [docs/testing.md](./docs/testing.md) for the testing layers and harnesses, [docs/plugin-system.md](./docs/plugin-system.md) / [docs/plugin-api-reference.md](./docs/plugin-api-reference.md) / [docs/plugin-quick-start.md](./docs/plugin-quick-start.md) for plugin authoring, [docs/renderer_tags_overview.md](./docs/renderer_tags_overview.md) and [docs/renderer_tag_cheatsheet.md](./docs/renderer_tag_cheatsheet.md) for the user-facing tag vocabulary.

Built on **Solid.js** (reactive UI) and **Vega** (declarative charts).

## Distribution & Public Surface

`package.json` `exports` declares a single `.` entry with conditions: `import` → `dist/module/index.mjs` (ESM, added in #2945 so ESM consumers like malloy-explorer resolve the ES build), `require`/`default` → the **UMD bundle** (`dist/module/index.umd.js`). There are no subpath imports and no headless entry. All integration goes through `MalloyRenderer` (or the legacy `HTMLView`, still exported for the VS Code notebook schema view).

Two non-obvious consequences:

- **`@malloydata/malloy-tag` is a runtime dependency for type resolution only.** The UMD inlines malloy-tag (vite `external: []`); nothing escapes to `require()` at runtime. But the published `.d.ts` files (`api/plugin-types.d.ts`, `data_tree/fields/base.d.ts`, `util.d.ts`, etc.) re-export `Tag`, so consumer TypeScript needs the package installed.
- **The bundle cannot be loaded in Node without a DOM stub** (either condition). Solid.js calls `delegateEvents()` at module-eval time and reads `window.document`. The headless validator (`@malloydata/render-validator`) installs and removes global `window`/`document`/`navigator` stubs around its `require()` of this package; any other Node consumer must do the same.

## Vega is pinned at v5 — a deliberate hold

The renderer is built on **Vega 5** (via `vega-lite ^5`). Moving to the current
Vega (6) is a major across the whole render stack — the `vega-lite` peer, the
chart runtime, our typings — i.e. a deliberate renderer upgrade, not a dependency
bump.

**What the pin costs** — visible on Security → Dependabot alerts: `vega`,
`vega-functions`, and `vega-expression` carry open advisories (high) whose only
fix is Vega 6. These are render-owned — nothing else in the monorepo pulls them —
so the renderer is the sole place that clears them. Recorded in the cross-cutting
pin ledger [`DEPENDENCY-MANAGEMENT.md`](../../DEPENDENCY-MANAGEMENT.md);
revisit when we take the Vega 5→6 upgrade.

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
- **Legacy renderer** (`src/html/`) — HTML strings, activated with `## renderer_legacy`. Still publicly exported as `HTMLView`. A few renderers (scatter, maps) still exist only here.

### Internal Data Model (the data tree)

`src/data_tree/` is the spine the rest of the renderer operates on. A `Malloy.Result` becomes two parallel trees rooted at a `RootField`:

- **Fields** (`fields/`) — the *schema*. One class per type: `RootField` (wraps the result's dimension fields) → `RepeatedRecordField` → `ArrayField`, plus `RecordField` and the atomic fields (`NumberField`, `StringField`, `DateField`, …). `getFieldType()` / the `FieldType` enum are what plugin `matches()` switches on.
- **Cells** (`cells/`) — the *data*, a parallel hierarchy (`RepeatedRecordCell`, `RecordCell`, `NumberCell`, …); each cell knows its `Field`. Renderers walk cells; a plugin receives `RenderProps.dataColumn: Cell`.

Worth knowing before editing here:
- `RepeatedRecordField` extends `ArrayField` and carries dedup machinery (`nestedRecordField`, lazy `elementField`, `skipTagParsing`) so child fields aren't re-created/re-parsed per row — see [docs/plans/field-creation-analysis.md](docs/plans/field-creation-analysis.md). Conceptually it's a *table*, not an array; the inheritance is historical.
- `field.key` (`JSON.stringify(field.path)`) is the registry key; `field.path` is the access path from the root.

### Dispatch

`RenderFieldMetadata` (`src/render-field-metadata.ts`) is the orchestrator: for each field it runs every plugin factory's `matches()` and attaches the first hit. At render time, `applyRenderer` (`src/component/renderer/apply-renderer.tsx`) uses the plugin if one matched, otherwise switches on the field's precomputed `renderAs()` value (`table`, `dashboard`, `link`, `image`, `list`, `cell`, `chart`, or a plugin name; last-declared renderer tag wins, and legacy `bar_chart`/`line_chart` are normalized into the `viz` namespace by `convertLegacyToVizTag`).

A parent renderer hands options to a child via `RenderProps.customProps`, keyed by renderer name — e.g. `customProps.table.shouldFillWidth`, `customProps.big_value.embedded`. This is how the dashboard configures the tiles it nests.

**Two similarly-named classes, don't confuse them:** `RenderFieldMetadata` (above — field registry, plugin instantiation, tag validation, all at setup time) is *not* `RenderResultMetadata` (chart-oriented: column min/max, row counts, precompiled Vega runtimes; built by `getResultMetadata` in `render-result-metadata.ts`). The chart/Vega pipeline, the cross-chart interaction store (`ResultStore` / brushes), and the how-to for adding a chart live in [DEVELOPING.md](DEVELOPING.md) and are not duplicated here.

### Tag System
Render annotations use the Malloy Tag API to check for rendering hints. For tag language syntax, see [packages/malloy-tag/CONTEXT.md](../malloy-tag/CONTEXT.md).

**Two annotation routes.** Every field exposes two tags, both parsed from the same `Malloy.Annotation[]` strings but on different routes (`parsePrefix`):
- `field.tag` (route `''`) — user-authored **render hints** (`# bar_chart`, `# currency`, `# label`). This is what the plugin system and validation act on.
- `field.metadataTag` (route `malloy`) — **compiler-emitted query metadata**: `calculation` (→ `wasCalculation()`, i.e. measure-ness), `drill_*`, `source`/`parameters`, `ordered_by`, `query_timezone`, `reference_id`, plus serialized `Malloy.Expression`/`LiteralValue` objects.

The `malloy` route is a metadata **side-channel**, not a renderer concept: rather than widen the typed stable interface, core's `to_stable.ts` (`writeMalloyObjectToTag`) serializes structured metadata into annotation strings under `#(malloy)`, and the renderer reverses it in `data_tree/utils.ts` (`extractMalloyObjectFromTag`). The encoding and ownership are core's; the renderer is only a consumer. Consequence: this metadata is **untyped at the interface boundary and versioned by convention** — that's why the renderer parses tags to reconstruct an `Expression`. Drilling (`data_tree/drilling.ts`, surfaced via the `onDrill(DrillData)` callback) is rebuilt entirely from these `drill_*` metadata tags; timezone resolution (`getEffectiveQueryTimezone`) walks `query_timezone` up the same channel.

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
Test at the cheapest layer that can observe the behavior — the layers and their harnesses are in **[docs/testing.md](docs/testing.md)**. The short version:
- **Dispatch & tag config** (`renderAs()`, `tag-configs.ts` resolvers, chart settings) is a function of the result *schema* — test it compile-only with the `RenderFieldMetadata` harness in `src/render-field-metadata.spec.ts`. No query run, no DOM.
- **Vega spec generation** — `runChartQuery` in `src/plugins/spec-test-support/harness.ts` (runs a query, no DOM).
- **Validation contract** — `test/src/render/render-validator.spec.ts`, which needs the built UMD bundle (full `npm run build`).
- **Pixels** — Storybook (`npm run storybook`), stories in `src/stories/*.stories.malloy`.

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
