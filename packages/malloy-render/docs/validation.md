# Renderer Validation

## What validation is

Renderer tags (`# bar_chart`, `# viz.x = ...`, `# currency=usd`, etc.) are a DSL embedded in Malloy annotations. The renderer interprets that DSL to decide what to draw and how. Validation is the layer that catches DSL mistakes — wrong tag on wrong field type, invalid enum values, bad field references, structural conflicts — and surfaces them as errors with source locations the user can act on.

Two things consume validation:

- **The VS Code Problems panel.** Validation runs during `setResult()` so logs are available synchronously after the result lands.
- **`@malloydata/render-validator`.** A headless wrapper that runs the validator in Node.js (no DOM, no Solid.js) so MCP pipelines and CI can validate a query's renderer tags without a browser.

Validation only needs the result **schema** (field names, types, annotations). It does not need data rows. Anything that requires inspecting rows (e.g., "transpose column limit exceeded") cannot be validated this way and must remain a render-time check.

## The design principle

> Push tag interpretation as far toward setup-time as possible. Anything resolved at setup-time can be validated at setup-time.

Concretely, this means:

- **Do tag reads in `create()` or in a `tag-configs.ts` resolver**, not in `renderComponent()`, `beforeRender()`, or any shared code they call into. Setup-time reads are automatically marked-as-read by the tag API, and their results are available for validation.
- **Store resolved values on the plugin instance or via `setTagConfig` / `setColumnConfig`**, and have render-time code consume the resolved values. Render-time code should never call `field.tag.*` directly.
- **When a render-time read is unavoidable** (e.g., a context-sensitive per-child tag like dashboard's `break`, where setup-time resolution would be materially worse than ownership), declare the path in `getValidationSpec().ownedPaths` or `childOwnedPaths` so unread-tag detection doesn't warn on valid uses.

If you internalize one thing from this document: **setup-time is the default; render-time reads are exceptions that must be declared**.

## How it works

### Pipeline

```
setResult(result)
  → new RenderFieldMetadata(result, plugins)
      → registerFields(rootField)               // recursive, depth-first
          for each field:
            instantiatePluginsForField(field)   // factory.matches + factory.create — may throw
            resolveBuiltInTags(field)           // typed config resolvers (image, link, ...)
            validateFieldTags(field)            // semantic checks → logCollector
            markOwnedTagPaths(field, ...)       // mark renderer-owned tag paths as read
getLogs()
  → semantic logs (from validateFieldTags + resolvers + plugin-error wrappers)
  → unread-tag warnings (collected once, idempotent)
```

### The four producers of log entries

1. **Semantic validation in `validateFieldTags()`** (`src/render-field-metadata.ts`) — The central place for "this tag is wrong" checks. Calls `log.error(msg, tagRef)` / `log.warn(msg, tagRef)`. The `tagRef` carries a source location so VS Code can underline the offending tag.

2. **Built-in tag config resolvers in `tag-configs.ts`** — Read tags at setup time, return typed configs, optionally log issues with the same `tagRef` pattern. Components consume the typed config rather than re-reading the tag.

3. **Plugin throws from `matches()` / `create()`** — Caught in `instantiatePluginsForField` and routed to `ErrorPlugin`, which renders a red error tile in place of the visualization with the thrown message. This is the correct UX when the user asked for a specific renderer (e.g., `# bar_chart`) and the renderer literally cannot produce output (wrong field shape, missing required structure). The thrown message gets wrapped as `"Plugin <name> failed for field '<key>': <msg>"` so the source location of the offending tag is **not** preserved — see "Throw vs log" below for when this trade-off is right.

4. **Unread-tag detection** — After validation, any tag property the user wrote that no resolver, validator, or ownership spec touched becomes a warning. This is the safety net for misspellings and unknown tags.

### Tag ownership

A renderer "owns" a tag when removing the renderer would make the tag meaningless (e.g., `viz.x` only matters when a chart is active). Ownership is declared on the factory:

```typescript
getValidationSpec: (): RendererValidationSpec => ({
  renderer: 'bar',
  ownedPaths:      [['viz', 'x'], ['viz', 'y'], ['bar_chart'], ...],
  childOwnedPaths: [['tooltip']],   // claimed on direct children
}),
```

`markOwnedTagPaths` walks these declarations and calls `tag.find(path)` on each one, marking the path as read so unread-tag detection won't false-warn. Built-in renderers use the same mechanism via `renderer-validation-specs.ts`.

Ownership is **bookkeeping**, not validation. It tells the framework "these tag paths are legitimate when this renderer is active." It does not check whether the values are sane — that is `validateFieldTags`'s job.

Ownership is a manual list with no compile-time check. Adding a new render-time tag read without updating `getValidationSpec()` produces false unread-tag warnings on valid input. Keeping the list in sync with actual render-time reads is the author's responsibility.

### Why a tag path needs ownership

A tag path needs to be in an ownership spec **only if it is read after `setResult()` returns** (i.e., at render time or interaction time) and is not consumed by a setup-time resolver. Setup-time reads already mark the tag as read; ownership specs cover the gap for tags that are still render-time-only.

When a tag migrates from render-time to a setup-time typed config, its entry in `ownedPaths` becomes redundant and should be removed.

## How to validate well

### Throw vs log — when you actually want each

This is the rule that matters most and is easiest to get wrong.

**Throw** from `matches()` / `create()` **when the user asked for a specific renderer and that renderer cannot produce output for this field.** The thrown message replaces the visualization with a red error tile (via `ErrorPlugin`). **That red tile is the feature, not a workaround** — it tells the author, visibly and unmissably: "you asked for X, here's why X can't happen." Examples:

- `# bar_chart` on a scalar field → throw. Bar chart was requested; can't deliver.
- `# big_value` on a non-record → throw. Big value was requested; can't deliver.
- `# bar_chart` on a nested query with zero dimensions → throw. Bar chart needs an x axis; can't deliver.

**Log** via `validateFieldTags()` with `log.error(msg, tagRef)` **when a renderer is still going to render, but one tag or setting is wrong.** The render proceeds with defaults; the log tells the author their setting was ignored. Examples:

- `# currency=yen` on a number → log. Table still renders, currency tag ignored.
- `# big_value { comparison_format=yuh }` → log. Big value still renders, bad format defaults to `pct`.
- `# viz.x = nonexistent_field` on a bar chart → log. Chart still renders, chooses x differently.
- `# y` on a non-numeric dimension → log. Chart still renders, chooses y from measures instead.

**The hinge:** *is the plugin unable to produce output at all, or just unable to apply this one setting?*

- Unable at all → red box. Throw.
- One setting wrong, main render still works → log + default.

A second way to check: **would the author prefer a red box, or a silently-defaulted render with a line in the Problems panel?** A whole failed viz deserves a red box. One ignored setting deserves a log.

### The source-location caveat

Thrown errors do not carry their `Tag` reference through `instantiatePluginsForField`, so red-box messages do not get a clickable source location. The red-box UX is still the right choice when the plugin can't produce output — do not route a whole-renderer failure through `validateFieldTags()` just to get a source location, since that produces a warning in the Problems panel while rendering the broken chart, which is worse UX than the red box.

### The ownership test

Separately from throw-vs-log: **if a tag gets read after `setResult()` returns**, its path must be in `getValidationSpec().ownedPaths` (or `childOwnedPaths` for direct children). Otherwise the unread-tag detector will warn about it on every valid use. Better still: move the read into a setup-time resolver (see `tag-configs.ts`) and drop the ownership entry.

### What the validator can't catch

- Anything that needs actual data rows (transpose limit exceeded, empty result handling).
- Anything that depends on layout measurements (sizing fallbacks).
- Logic errors in renderer code that produce a wrong-but-rendered chart.

For these, a Storybook case is the regression net. If you are adding a validation rule, also add a story exercising the bad input — the story exercises the validator path, and visual regressions cover what validation can't.

### Pre-PR checklist

- [ ] New tag or property a renderer reads → it is consumed by a setup-time resolver in `tag-configs.ts` **or** declared in the relevant plugin's `getValidationSpec().ownedPaths` / `childOwnedPaths`.
- [ ] New constraint on a tag value (enum members, type compatibility, structural rule) → encoded in `validateFieldTags()` with `log.error(msg, tagRef)` so the user sees a source-located error.
- [ ] New throw in `matches()` / `create()` → the failure is "this plugin cannot produce output for this field," and a red-box tile is the UX you want. If the main renderer would still work fine and only one tag-setting is wrong, use `validateFieldTags()` with a logged error instead.
- [ ] New plugin factory → defines `getValidationSpec()` on the factory (not on the instance).
- [ ] Storybook case added or updated to exercise the new tag/validation path.

## Key files

| File | Role |
|---|---|
| `src/render-field-metadata.ts` | Validation engine — `validateFieldTags`, `markOwnedTagPaths`, plugin instantiation |
| `src/component/render-log-collector.ts` | Log collection, unread-tag walking |
| `src/component/tag-configs.ts` | Setup-time resolvers for built-in renderers (image, link, list, cell format, table nest, dashboard) |
| `src/component/renderer-validation-specs.ts` | Built-in renderer ownership specs |
| `src/api/plugin-types.ts` | `RenderPluginFactory`, `RendererValidationSpec` interfaces |
| `packages/malloy-render-validator/src/index.ts` | Headless wrapper — `validateRenderTags(result)` |
