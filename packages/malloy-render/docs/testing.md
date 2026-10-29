# Testing the renderer

The renderer's behavior splits into layers with very different testing costs.
Test at the cheapest layer that can observe the behavior; escalate only when a
lower layer can't see it.

| Layer | What it answers | Harness | Needs |
|---|---|---|---|
| Dispatch & tag config | "Does this markup select the right renderer, with the right resolved settings?" | `src/render-field-metadata.spec.ts` (compile-only, see below) | schema only — no query run, no data, no DOM |
| Chart spec generation | "Does the generated Vega spec encode the data and tags correctly?" | `src/plugins/spec-test-support/harness.ts` (`runChartQuery`) | runs a real DuckDB query, no DOM |
| Tag validation contract | "Do bad tags produce the right diagnostics?" | `test/src/render/render-validator.spec.ts` | the **built UMD bundle** — run a full `npm run build` first, `npm run dev` is not enough |
| Pixels | "Does it look right?" | Storybook (`npm run storybook`), stories in `src/stories/*.stories.malloy` | a browser and your eyes |

## The compile-only harness (dispatch & tag config)

Everything the renderer decides at setup time — which renderer a field gets
(`renderAs()`), what the tag resolvers in `tag-configs.ts` produce, what chart
settings resolve to — is a function of the result **schema**, not the data.
That means these tests never need to execute a query: compile the model with
`getPreparedResult()` and construct `RenderFieldMetadata` directly on the
stable result. DuckDB is used only to describe an inline `duckdb.sql(...)`
table at compile time.

```typescript
async function metadataFor(malloySource: string): Promise<RenderFieldMetadata> {
  const pr = await runtime
    .loadModel(malloySource)
    .loadQueryByName('q')
    .getPreparedResult();
  return new RenderFieldMetadata(pr.toStableResult());
}
```

From the metadata you can assert on `field.renderAs()` (dispatch),
`field.getTagConfig<T>()` (setup-time resolvers), and per-plugin settings
functions like `getBarChartSettings(field)`. These tests run in plain Node in
under a second — no Solid, no Vega runtime, no DOM stubs.

Prefer this harness for any new tag, any change to dispatch precedence, and
any resolver in `tag-configs.ts`. If a behavior can be pinned here, a
Storybook story for it is documentation, not the test.

## The chart-query harness (spec generation)

When the behavior lives in a Vega spec generator (axis titles, legend scales,
tooltip shapes), use `runChartQuery` from `src/plugins/spec-test-support/`.
It runs a real query, builds the full render metadata, and hands back what the
spec generators consume. Costs a query execution per test but still no DOM.

## Pinning known bugs

Some tests deliberately pin behavior that is known to be wrong (they are
labeled `KNOWN BUG` / `PINNED` in the test name, with a comment explaining
the actual behavior). Their job is to make a behavior change *loud*: if a
change flips one, update it knowingly — don't "fix" the test to keep it
green without understanding what changed.

## Running

Renderer unit tests live in the `malloy-render` jest project:

```
npx jest --selectProjects malloy-render
```

Do not run the repo's full test suite unrestricted; use targeted projects or
paths.
