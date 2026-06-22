# Dependabot pins — what we deliberately hold, why, and what it costs

The human-facing record behind the held-back versions in the connectors and the
renderer, and the `ignore` entries in `dependabot.yml`. Dependabot **alerts**
(Security → Dependabot alerts) are never suppressed by config — they stay visible
as the running cost. This file says which *decision* owns each held-open advisory
and when we'd revisit it. Reviewed monthly (see [CONTEXT.md](./CONTEXT.md)): for
each pin, is its "Revisit when" now true, and has its cost escalated (a new
critical behind it)?

## Pins (deliberate holds)

### Snowflake — `snowflake-sdk` pinned exactly at `2.3.1`
Owned by `packages/malloy-db-snowflake` (see its CONTEXT.md). The exact pin (no
caret) is intentional: floating the SDK thrashes the native connector chain, so
bumps are made deliberately, not by a lockfile range.

Holds open (alert-only — no PR):
- `fast-xml-parser` — 2×critical, 4×high *(also pulled by BigQuery's
  `@google-cloud/storage`; clears only when every owner moves)*
- `axios` — high/medium *(also via Trino's `trino-client` and the publisher)*
- `bn.js` — 2×medium

Revisit when: a deliberate `snowflake-sdk` bump, verified against the live
Snowflake CI env. Not a lockfile bump.

### Renderer — Vega held at v5 (via `vega-lite ^5`)
Owned by `packages/malloy-render` (see its CONTEXT.md). The fix is Vega 6, a major
across the whole render stack.

Holds open: `vega`, `vega-functions`, `vega-expression` — 3×high. Render-owned
only (nothing else pulls them), so the renderer is the sole place that clears them.

Revisit when: the renderer's Vega 5→6 upgrade.

### uuid — held at `^8`
Direct in `@malloydata/malloy`, and transitive through the cloud SDKs. The only
fix is v11/v14 (six majors). This is the **only** pin that also gets an `ignore`
in `dependabot.yml`, because it was the one emitting an unmergeable PR.

Holds open: `uuid` — 2×medium.

Revisit when: a deliberate uuid migration, or a high/critical uuid advisory lands.

### duckdb-wasm — `@motherduck/wasm-client` held at `^0.6.6`
Owned by `packages/malloy-db-duckdb` (the duckdb-wasm browser connector,
`src/duckdb_wasm_connection_browser.ts`). Held because that code is written
against the old 0.6 API: `0.8` renamed the type exports (`DuckDBDate`,
`DuckDBDecimal`, `DuckDBList`, the `DuckDBTimestamp*` family, …) and reshaped
`SpecialDuckDBValue`, so the bump fails `tsc`. It rode the minor/patch group as a
"minor" — the **0.x trap**, where a 0.x minor is allowed to break — and broke the
#2911 group build. Now ignored for **all** versions in `dependabot.yml`, matching
the `@dependabot ignore @motherduck/wasm-client` comment on #2911. (That comment
lives only in Dependabot's memory; this row + the `ignore` are the durable record.)

Cost: the duckdb-wasm connector can't take `@motherduck/wasm-client` updates, and
latest is `1.5.3-r.2` — so it's far behind, and the gap grows.

Revisit when: a deliberate migration of `duckdb_wasm_connection_browser.ts` to the
new `@motherduck/wasm-client` API.

## Not pins — context, so this list stays short

- **Connector SDKs other than Snowflake** (`trino-client`, `@databricks/sql`,
  `@google-cloud/*`) aren't pinned — just not-yet-upgraded. Their transitive
  advisories (`axios`, `thrift`, `fast-xml-parser`, `uuid`) clear by a deliberate
  per-dialect SDK bump, each verified against that dialect's live CI env. Tracked
  as connector maintenance, not here.
- **Dev/build tooling is the majority of the alert count and never ships.** `tar`,
  `shell-quote`, `ws`, `tmp`, `minimatch`, `js-yaml`, `markdown-it`, `basic-ftp`,
  `@babel/*` and friends arrive transitively via lerna/nx/storybook/karma/eslint/
  node-gyp/typedoc — all `devDependencies`, absent from anything consumers install.
  They clear as those tools update (the monthly minor/patch group folds in what's
  in range). Not pinned, not enumerated.
