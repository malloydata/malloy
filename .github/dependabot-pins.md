# Dependabot pins — what we deliberately hold, why, and what it costs

The human-facing record behind the held-back versions in the connectors and the
renderer, and the `ignore` entries in `dependabot.yml`. Dependabot **alerts**
(Security → Dependabot alerts) are never suppressed by config — they stay visible
as the running cost. This file says which *decision* owns each held-open advisory
and when we'd revisit it. Reviewed monthly (see [CONTEXT.md](./CONTEXT.md)): for
each pin, is its "Revisit when" now true, and has its cost escalated (a new
critical behind it)?

**Two surfaces per pin.** A pinned *direct* dependency (`snowflake-sdk`,
`vega-lite`, `@motherduck/wasm-client`, `vscode-textmate`) emits its own
recurring version-update PR, so each is `ignore`d in `dependabot.yml` to stop it
squatting the PR limit — and exact-pinned in its `package.json` where the existing
range would otherwise let a fresh `npm install` resolve the bad version. The
*transitive* advisories a pin holds open are alert-only (no PR); those are what's
listed under each entry.

## ESM-only majors — the two classes (triage before holding)

The npm ecosystem is migrating to ESM-only packages. Our code ships CommonJS and
our tests run under jest's CJS runtime, so an ESM-only dep can fail to load. But
**not every ESM-only major is a hold** — split them before deciding:

- **Class 1 — static ESM** (plain `import`/`export`, e.g. `@noble/hashes` v2,
  `uuid` v14 — whose `node` export condition is itself ESM).
  jest's default `transformIgnorePatterns` skips `node_modules`, so it sees the raw
  `import` and throws *"Cannot use import statement outside a module."* The fix is
  to **transform** it: add the package to `transformIgnoreModules` in
  **both** `jest.config.ts` (in `defaultConfig`, which every `projects` entry
  spreads — the top-level `transform` does **not** cascade into `projects`) and
  `jest.config.simple.ts`. babel-jest then rewrites its ESM to CJS and it loads.
  **Takeable**, one line. (`@motherduck/wasm-client` is listed there too, but it's
  held at CJS 0.6, so it doesn't actually exercise this.)
- **Class 2 — runtime dynamic `import()` of an ESM-only target** (e.g. gaxios 7
  under `@google-cloud/bigquery` 8). The break isn't syntax jest can transform —
  it's a `require`-an-ESM call at runtime needing `--experimental-vm-modules`,
  which we reject (see the BigQuery pin). **A genuine hold**, untouchable by
  `transformIgnoreModules`.

Note both *compile* under TypeScript; the divide is purely how jest loads them at
runtime. A Class-1 dep also typically forces small source edits for the package's
own API changes (noble v2: `/sha256`→`/sha2.js`, `.js` extensions mandatory,
`Uint8Array`-only inputs via `utf8ToBytes`).

## Pins (deliberate holds)

### Snowflake — `snowflake-sdk` pinned exactly at `2.3.1`
Owned by `packages/malloy-db-snowflake` (see its CONTEXT.md). The exact pin (no
caret) is intentional: floating the SDK thrashes the native connector chain, so
bumps are made deliberately, not by a lockfile range. Now also `ignore`d in
`dependabot.yml` so Dependabot stops proposing bumps (it would otherwise pull
snowflake-sdk into the connectors group).

Holds open (alert-only — no PR):
- `fast-xml-parser` — 2×critical, 4×high *(also pulled by BigQuery's
  `@google-cloud/storage`; clears only when every owner moves)*
- `axios` — high/medium *(also via Trino's `trino-client` and the publisher)*
- `bn.js` — 2×medium

Revisit when: a deliberate `snowflake-sdk` bump, verified against the live
Snowflake CI env. Not a lockfile bump.

### Renderer — Vega held at v5 (via `vega-lite ^5`)
Owned by `packages/malloy-render` (see its CONTEXT.md). The fix is Vega 6, a major
across the whole render stack. `vega-lite` is a *direct* dep, so its major opens a
recurring monthly PR — its **major** is `ignore`d in `dependabot.yml` so it stops
squatting the limit; the v5 minors still flow.

Holds open: `vega`, `vega-functions`, `vega-expression` — 3×high (transitive,
alert-only). Render-owned only (nothing else pulls them), so the renderer is the
sole place that clears them.

Revisit when: the renderer's Vega 5→6 upgrade.

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

### syntax-highlight — `vscode-textmate` held at `9.0.0`
Owned by `packages/malloy-syntax-highlight`. Unlike the others, the dep isn't the
problem — *our code is*. `scripts/generateMonarchGrammar.ts` deep-imports internal
paths (`vscode-textmate/release/theme`, `/rawGrammar`) and relies on
`TextMateBeginEndRule`'s private shape. `9.3.2` — an **in-range minor** — stopped
exporting those internals, breaking the syntax-highlight codegen in the #2911
group. Exact-pinned to `9.0.0` (the `^9.0.0` range would otherwise resolve the
breaker) and `ignore`d in `dependabot.yml`.

Cost: held one minor behind; no security advisory rides on it.

Revisit when: issue #2918 — stop deep-importing vscode-textmate internals, then
unpin. (Relates to the textmate-grammar-rebuild work.)

### Postgres — `pg` + `pg-query-stream` held as a coupled set
Owned by `packages/malloy-db-postgres`. `pg-query-stream` pulls `pg-cursor`, which
**deep-imports `pg`'s internal `lib/result.js`**. The connectors-group PR #2923
bumped `pg` 8.7→8.22, skewing those versions, and `pg-cursor` could no longer
resolve the internal path — which broke module resolution in **every** dialect's
test suite (the shared harness loads the postgres path), not just postgres. `pg`,
`pg-cursor`, and `pg-query-stream` are a **coupled set** that must move together
(like the gts/eslint cluster). `pg` is exact-pinned to `8.7.3` in `package.json`
(the `^8.7.1` range admitted the breaker on a fresh install); both are `ignore`d.

Cost: postgres connector held a few minors behind; no security advisory rides on it.

Revisit when: issue #2928 — bump `pg` + `pg-cursor` + `pg-query-stream` together to
compatible versions, verify `db-postgres` + the shared harness, then unpin.

### BigQuery — `@google-cloud/bigquery` + `common` + `paginator` held at v7/v5
Owned by `packages/malloy-db-bigquery`, exact-pinned to **best-v7** (`7.9.4` /
`5.0.2` / `5.0.2`) as a coupled set. bigquery **8** pulls `@google-cloud/common@6`
→ `google-auth-library@10` → `gaxios@7`, and gaxios 7 does an **ESM-only dynamic
`import()`** in its token/request path. Under jest's CommonJS VM that throws
`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`, surfaced as "Unexpected Gaxios
Error" → every bigquery test fails. The only thing that fixes jest is
`NODE_OPTIONS=--experimental-vm-modules`; babel-transforming gaxios can't help (the
import target is ESM-only, can't be `require`d). We don't take the flag: it can't
be made invisible for a bare `npx jest FILE -t NAME` (no project-local
`NODE_OPTIONS`), so it breaks the single-test workflow, and it's an experimental
Node API applied suite-wide. **bigquery 8 itself is fine in plain node** — the
break is jest-only.

Cost: bigquery connector held on the v7 SDK line; whatever transitive security the
v8 stack would clear stays open.

Revisit when: issue #2932 — when the test runner handles the ESM-only import
without the experimental flag (jest → vitest, or jest gains stable ESM), or gaxios
drops the ESM-only `import()`. Then bump the trio together, confirm `db-bigquery`
**and** the ci-core bigquery `streaming.spec` pass **without** the flag, and unpin.

## Not pins — context, so this list stays short

- **Connector SDKs other than Snowflake** (`trino-client`, `@databricks/sql`,
  `@google-cloud/*`, `mysql2`, `pg`, …) aren't pinned — just not-yet-upgraded.
  Their transitive advisories (`axios`, `thrift`, `fast-xml-parser`, `uuid`) clear
  by a deliberate per-dialect SDK bump, each verified against that dialect's live
  CI env. They're collected into the `connectors` group in `dependabot.yml` so a
  bump lands as its own deliberate PR instead of riding the routine minor/patch
  merge. Tracked as connector maintenance, not here.
- **Dev/build tooling is the majority of the alert count and never ships.** `tar`,
  `shell-quote`, `ws`, `tmp`, `minimatch`, `js-yaml`, `markdown-it`, `basic-ftp`,
  `@babel/*` and friends arrive transitively via lerna/nx/storybook/karma/eslint/
  node-gyp/typedoc — all `devDependencies`, absent from anything consumers install.
  They clear as those tools update (the monthly minor/patch group folds in what's
  in range). Not pinned, not enumerated.
