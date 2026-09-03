# Chart image output: `# line_chart { output=svg }`

Status: design only, nothing implemented.

## Goal

When a query is tagged `# line_chart`, `# bar_chart`, or `# combo_chart`, let a
consumer get back a standalone SVG (or PNG) instead of mounting HTML. Targets:
MCP tool responses, CLI output, Slack/email, notebooks, static docs.

## Why this is lightweight

The chart plugins already split into two phases:

1. `beforeRender()` builds the Vega spec and `vega.parse()`s it into a `Runtime`.
   No DOM is touched here.
2. `renderComponent()` mounts that runtime in Solid: `<ChartV2>` → `<VegaChart>`
   → `new View(runtime).initialize(el).renderer('svg')`.

Vega can produce a standalone SVG string from the same runtime with
`new View(runtime, {renderer: 'none'}).toSVG()`. The shape-map plugin and the
legacy `html/chart.ts` already do exactly this. And loading the renderer in Node
is already solved once, by `@malloydata/render-validator`, which wraps
`require('@malloydata/render')` in a fake DOM and then calls `setResult()`
without ever calling `render()`.

So the work is: one shared runtime-to-SVG helper, a plugin hook, an API method
on `MalloyViz`, and unhooking the three DOM dependencies in the pre-render path.

## Tag design

Canonical form, inside the chart tag, so it lives next to `size`, `title`, and
`subtitle`:

```malloy
# line_chart { output=svg }
# bar_chart { output=png output.scale=2 size.width=800 size.height=400 }
# combo_chart.output=svg
```

All three chart tags are normalized into `viz` by `convertLegacyToVizTag`, so
one read in `resolveChartDisplayConfig` (`chartTag.text('output')`) covers them.
A top-level `# line_chart output=svg` fallback (`fieldTag.text('output')`) is
supported the same way `# size` is today.

| Property | Values | Default | Notes |
|---|---|---|---|
| `output` | `svg`, `png` | unset | Unset means "no image requested". |
| `output.scale` | number | `1` | PNG only. Device pixel ratio. |
| `size`, `size.width`, `size.height` | existing | existing | Reused as-is. No new size vocabulary. |

Sizing: a root-level chart with no `size` is `fill` mode, which needs a
container. Headless there is no container, so `fill` resolves to the `lg` preset
(570 px wide, 12 rows tall). Explicit `size.width` / `size.height` win.

Semantics: the tag declares intent. It is honored by consumers that call
`toImage()`. The interactive DOM renderer ignores it, so VS Code, Publisher,
and the Explorer see no behavior change. (A later option is a static mode in
the DOM renderer when `output` is present, with no tooltips or brushing. Not
proposed now.)

Validation: `ownedPaths: [['line_chart']]` and friends already own everything
under the chart tag, so `output` never trips the unknown-tag warning. The read
happens in `create()` at setup time, which marks it consumed. `create()` logs an
error for a value outside `svg | png`, and a warning when `output` is set on a
nested (non-root) field, since only the query's top-level chart can be returned
as an image.

## API

```ts
// MalloyViz
getImageOutputFormat(): 'svg' | 'png' | undefined;   // from the tag; no rendering
toImage(options?: ImageRenderOptions): Promise<MalloyImage>;

interface ImageRenderOptions {
  format?: 'svg' | 'png';      // overrides the tag; default tag value, else 'svg'
  width?: number;              // plot size overrides; default tag size, fill → lg
  height?: number;
  scale?: number;              // png only; default output.scale, else 1
  embedFonts?: boolean;        // svg: inline @font-face; default false (svg), true (png)
}

interface MalloyImage {
  format: 'svg' | 'png';
  mimeType: 'image/svg+xml' | 'image/png';
  width: number;               // CSS px of the full image incl. title bar
  height: number;
  svg?: string;                // when format === 'svg'
  data?: Uint8Array;           // when format === 'png'
}
```

Consumer flow (an MCP server, for example):

```ts
viz.setResult(result);
if (viz.getImageOutputFormat()) {
  const img = await viz.toImage();          // honors the tag
  return {type: 'image', mimeType: img.mimeType, data: ...};
}
return {type: 'text', text: JSON.stringify(result.data)};
```

`toImage()` rejects with a clear error when the root field's renderer has no
image support (table, dashboard, big_value, list, ...). Making those into images
would need a real browser or HTML-in-foreignObject and is out of scope.

Node convenience, in the package that is already the Node-safe entry:

```ts
// @malloydata/render-validator (candidate rename: render-headless)
export function renderResultToImage(
  result: Malloy.Result,
  options?: ImageRenderOptions
): Promise<MalloyImage>;
```

## Plugin hook

```ts
export interface ImageRenderPluginMethods {
  /** Standalone SVG for this field's cell. beforeRender() must have run. */
  renderToSVG(cell: Cell, options: {width: number; height: number}): Promise<string>;
}
export function isImageRenderPlugin(p: RenderPluginInstance): p is ... ;
```

Line, bar, and combo implement it in about fifteen lines each by calling one
shared helper, `component/vega/render-runtime-to-svg.ts`:

```ts
export async function vegaRuntimeToSVG(runtime: Runtime, opts: {
  values: unknown[];
  explore: RepeatedRecordField;
  width: number; height: number;
  useVegaInterpreter?: boolean;
}): Promise<string> {
  const view = new View(runtime, {renderer: 'none', ...(interpreter)});
  view.logger().level(-1);
  setSignalIfExists(view, 'malloyExplore', opts.explore);   // same as VegaChart
  view.data('values', opts.values);
  view.width(opts.width).height(opts.height);
  return view.toSVG();
}
```

Title and subtitle are drawn by `<ChartV2>` in HTML above the plot, not by
Vega. The helper wraps Vega's SVG in an outer `<svg>` with `<text>` elements
using the same font settings as `.malloy-chart__title`, offsetting the plot by
`totalHeight - plotHeight`, which `chart-layout-settings` already computes. A
zero-row result produces the same "No Data" text as the DOM path. The
scatter, shape-map, and segment-map plugins already call `toSVG()` and can
adopt the hook trivially.

## Three DOM dependencies to unhook

| Where | Today | Proposed |
|---|---|---|
| Module load | Solid's `delegateEvents()` reads `window.document` at eval time. | No change. Keep the fake-DOM shim in `render-validator`. |
| Text measurement | `getTextWidthDOM` / `getTextHeightDOM` in `chart-layout-settings.ts` (7 call sites) size axis extents by appending a div and measuring it. | Add `measureText?: TextMeasurer` to `GetResultMetadataOptions`. Browser keeps the DOM measurer (pixel-identical). Headless uses Vega's `textMetrics`, which uses node-canvas when present and a width estimate otherwise. Only axis extents are affected. |
| Container size | `parentSize` comes from a ResizeObserver in `MalloyRenderInner`. | Headless supplies `parentSize` from options, the tag, or the `lg` default. |

The one real refactor: the `createMemo` in `MalloyRenderInner` that calls
`getResultMetadata()` and then runs every plugin's `beforeRender()` becomes a
plain function, `prepareRenderMetadata(rootField, options)`, used by both the
Solid path and `toImage()`. `processData()` already runs inside `getDataTree()`
via `NestCell`, so it needs nothing.

## PNG

SVG is the primary artifact. PNG is a rasterization of it:

- Browser: `view.toCanvas(scale)` then `canvas.toBlob('image/png')`. Vega does
  this natively.
- Node: `view.toCanvas()` needs the native `canvas` package. Do not add it to
  the renderer. Instead expose `MalloyRendererOptions.rasterizer?: (svg,
  {width, height, scale}) => Promise<Uint8Array>`. The renderer ships the
  browser default. `renderResultToImage` lazy-imports `@resvg/resvg-js`
  (WASM, no native build) as an optional peer and throws a clear "install
  @resvg/resvg-js for PNG output" error when it is missing.

## Fonts

Vega's SVG text carries `font-family="Inter, sans-serif"`. A bare SVG opened
where Inter is not installed falls back to the viewer's sans-serif, with small
width differences against the measured layout. `embedFonts` inlines the woff2
in `src/fonts/` as an `@font-face` data URI (tens of KB). For Node PNG, the
same file is handed to resvg as a font source, so PNGs are deterministic.

## Out of scope, noted for later

- Table, dashboard, big_value, and list to image.
- Nested charts inside table cells (the hook is root-field only through `toImage()`).
- A static, non-interactive mode in the DOM renderer keyed off `output`.
- Dashboard-to-image by composing child chart SVGs.

## Testing

- Spec level, in `src/plugins/**` with the existing `runChartQuery` harness:
  `output` parsing, size fallback to `lg`, the error and warning cases. Note the
  harness comment: Vega 6 is ESM-only and the Jest Node environment cannot
  instantiate a `View`, so no `toSVG()` here.
- Integration, in `test/src/render/render-image.spec.ts` next to
  `render-validator.spec.ts`, using the built bundle through
  `renderResultToImage`. Assert the SVG's `viewBox`, axis titles (honoring
  `# label`), and the number of series paths. PNG case gated on resvg being
  installed.

## Files touched

| File | Change |
|---|---|
| `component/chart/resolve-chart-display.ts` | Read `output`, `output.scale`. |
| `api/plugin-types.ts` | `ImageRenderPluginMethods`, `isImageRenderPlugin`. |
| `component/vega/render-runtime-to-svg.ts` | New. Shared helper plus title wrapper. |
| `component/chart/chart-layout-settings.ts`, `component/util.ts` | Text measurer injection. |
| `component/render-result-metadata.ts` | `measureText` option, `prepareRenderMetadata()`. |
| `component/render.tsx` | Use `prepareRenderMetadata()`. |
| `plugins/{line,bar,combo}-chart/*-plugin.tsx` | `renderToSVG()`. |
| `api/malloy-viz.tsx` | `getImageOutputFormat()`, `toImage()`. |
| `api/types.ts` | `rasterizer` option. |
| `packages/malloy-render-validator/src/index.ts` | `renderResultToImage()`. |
| `docs/renderer_tags_overview.md`, `docs/renderer_tag_cheatsheet.md`, `docs/plugin-api-reference.md` | Document `output` and the hook. |

Roughly 400 lines, no new hard dependencies, no change to the interactive
renderer's output.
