# Dependency management in the Malloy mono-repo

## Methodology

We used a tiered strategy, using GitHub's Dependabot as input.  We group these, roughly into these catgories.

1. Security reports. We plan to stay on top of these as soon as they appear.
2. Minor version upgrades. We check these once a month and pull in as many of them as we can.
3. Major version upgrade. These also are checked once a month, however we are likely to simply file an issue and not actually incorporate the new version until another reason appears to make the upgrade.

The monthly Dependabot runs (`.github/dependabot.yml`), with version updates are
collected into groups so a bump lands as one reviewable PR with a clear blast radius
instead of a scatter of one-offs:

- **`connectors`** — the database SDKs (`@google-cloud/*`, `@databricks/*`,
  `trino-client`, `mysql2`, `pg`, …). Historically these have all been problematic when we update them, so we keep them in their own little corner.
- **`toolchain`** — the gts / typescript / eslint / prettier cluster, majors only;
  they move together or not at all.
- **`minor-and-patch`** — everything else's in-range minors/patches, folded into one
  PR (duckdb excluded — it gets its own group for the same deliberate-PR reason).

The security check fires on advisory *publication*, not the monthly cadence, and only
collapses advisories that land in the same run into one PR.

We may decide to respond to a Dependabot report in one of three ways

1. Bump our internal dependency.
2. Pin our dependency, and file a bug indicating we would like to update later but it is not urgent.
3. Pin our dependency, and document what needs to happen externally before we can update the dependency.

It is important to know that, even for security dependencies, we might have to pin instead of move, and usually this is not really an issue. The security report on the package is a part of the package which we do not actually touch, so it isn't an actual securiry problem for people down stream of the Malloy package.

**A pin has two surfaces, and both are mandatory.** To actually hold a version you
must (1) **exact-pin** it in the owning package's `package.json` — the existing
`^range` would otherwise let a fresh `npm install` resolve the bad version — *and*
(2) **`ignore`** it in `dependabot.yml`, or the next group PR re-bumps it straight
back. **One without the other is not a pin.** Databricks is the cautionary tale:
#2888 pinned `package.json` to `1.15.0` but skipped the `ignore`, so connectors-group
PR #2934 reverted it a week later and shipped the break in `@malloydata/malloy`
0.0.418. Every entry below names both surfaces. (The *transitive* advisories a pin
holds open are alert-only — no PR — and are listed under each entry as the cost.)

### ESM-only majors — triage before holding

The npm ecosystem is migrating to ESM-only packages. Our code ships CommonJS and our
tests run under jest's CJS runtime, so an ESM-only dep can fail to load. But **not
every ESM-only major is a hold** — split them before deciding:

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
  which we reject (see the BigQuery hold). **A genuine hold**, untouchable by
  `transformIgnoreModules`.

Note both *compile* under TypeScript; the divide is purely how jest loads them at
runtime. A Class-1 dep also typically forces small source edits for the package's
own API changes (noble v2: `/sha256`→`/sha2.js`, `.js` extensions mandatory,
`Uint8Array`-only inputs via `utf8ToBytes`).

## Held because the upgrade breaks this repo

Each of these is `ignore`d only until the linked fix lands — the new version breaks
*our* build, tests, or codegen, so the hold clears when we do the work.

### Renderer — Vega held at v5 (via `vega-lite ^5`)
Owned by `packages/malloy-render` (see its CONTEXT.md). The fix is Vega 6, a major
across the whole render stack. `vega-lite` is a *direct* dep, so its major opens a
recurring monthly PR — its **major** is `ignore`d in `dependabot.yml` so it stops
squatting the limit; the v5 minors still flow.

Holds open: `vega`, `vega-functions`, `vega-expression` — 3×high (transitive,
alert-only). Render-owned only (nothing else pulls them), so the renderer is the
sole place that clears them.

Revisit when: the planned renderer **rewrite**, which replaces this stack wholesale.
There is deliberately no standalone Vega 5→6 issue — we don't intend to bump Vega in
place; v6 comes for free with the rewrite, or not at all. (The exception to "majors
get a tracking issue": the upgrade is subsumed by larger planned work.)

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

Revisit when: issue #2950 — migrate `duckdb_wasm_connection_browser.ts` to the
`@motherduck/wasm-client` 1.x API, then unpin (drop the `^0.6.6` range and the
`ignore`).

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

## Held for reasons outside this repo's build

These don't break malloy's own build — the hold protects something else: an upstream
regression, a native chain too volatile to float, or a break that only lands in the
downstream apps that embed us.

### Snowflake — `snowflake-sdk` pinned exactly at `2.3.1`
Owned by `packages/malloy-db-snowflake` (see its CONTEXT.md). The exact pin (no
caret) is intentional: floating the SDK thrashes the native connector chain, so
bumps are made deliberately, not by a lockfile range. Also `ignore`d in
`dependabot.yml` so Dependabot stops proposing bumps (it would otherwise pull
snowflake-sdk into the connectors group).

There's also a **downstream-bundling** dimension, the same family of problem as
Databricks: snowflake-sdk's native form loads its binary via `eval('require')`, which
is invisible to esbuild, so it can't be bundled cleanly into the embedding apps. Part
of what we're waiting for is Snowflake **restructuring their npm package** so the
native pieces externalize/bundle properly downstream. *(Current understanding, not yet
tied to a specific Snowflake issue — verify before acting on it.)*

Holds open (alert-only — no PR):
- `fast-xml-parser` — 2×critical, 4×high *(also pulled by BigQuery's
  `@google-cloud/storage`; clears only when every owner moves)*
- `axios` — high/medium *(also via Trino's `trino-client` and the publisher)*
- `bn.js` — 2×medium

Waiting for: a security advisory to force our hand (the held `fast-xml-parser` /
`axios` / `bn.js` alerts are the standing cost, reviewed monthly), **or** Snowflake
restructuring the npm package so it bundles downstream. Either way the bump is
deliberate, verified against the live Snowflake CI env — never a lockfile float.

### Databricks — `@databricks/sql` pinned exactly at `1.15.0` (last pre-native release)
Owned by `packages/malloy-db-databricks`. **1.16.0 introduced a native Rust
kernel** — eight optional `@databricks/databricks-sql-kernel-*@0.2.0` packages,
each shipping a `.node` binary. esbuild can't inline `.node`, so the bump breaks
the **downstream embedding apps' bundles** (the vscode extension and malloy-cli),
where `check-native` fails on kernel packages absent from `approved-native-deps.json`.

This hold is unlike the ones above in *where* it bites: **malloy's own CI passes** —
malloy uses the SDK in plain Node, which loads `.node` fine — so nothing here
catches it. The guard lives only downstream and fires at *release time*, when the
embedding apps run `malloy-update` + bundle. 1.15.0 is the last pure-JS (thrift)
release. Not a security hold: 1.16.0 clears nothing 1.15.0 had (`thrift` is
`^0.16.0` in both); the kernel is the *only* delta, and it's the problem, not a fix.

The cautionary half — the two-surfaces rule's headline example: **#2888 pinned
`package.json` to 1.15.0 but did not add the `dependabot.yml` ignore.** A pin
without its ignore is not a pin — a week later the connectors-group PR #2934
re-bumped it to 1.16.0, silently reverting #2888, and it shipped in
`@malloydata/malloy` 0.0.418, breaking that release's downstream PRs. The durable
fix is both surfaces: exact-pin `1.15.0` in `package.json` **and**
`ignore: @databricks/*` in `dependabot.yml` (so the connectors group can't squat it).

Cost: databricks connector held one minor behind; no security advisory rides on it.

Waiting for: one of two triggers — **(a)** a security advisory, direct or transitive,
against 1.15.0 (it lights the alerts tab regardless of the ignore), or **(b)** a
customer who actually needs the native kernel. Absent both, we stay on 1.15.0
indefinitely. Either trigger unblocks the same work: give the embedding apps (vscode
extension + malloy-cli) native-kernel packaging — externalize and ship the
per-platform `@databricks/databricks-sql-kernel-*` `.node` binaries, `approve-native`
them in each — then take 1.16.0+ and verify against the live Databricks CI env. Until
then it's supported-or-rots: the connector is welded to the embedding apps' bundlers,
so it can't float.

### Node runtime — pinned at `24.16.0` via `.node-version`
Not a dependency, but a deliberate hold that belongs here. Node **24.17.0** carries
a `http.Agent` keep-alive socket-reuse regression that makes `node-fetch` (under
`google-auth-library`/`gaxios`) throw a false `ERR_STREAM_PREMATURE_CLOSE` —
surfaced as `Invalid response body while trying to fetch
https://www.googleapis.com/oauth2/v4/token: Premature close` — whenever Google's
OAuth endpoint closes a pooled idle connection. It hits the ci-core bigquery
`streaming.spec` (which authenticates to BigQuery and runs live queries), and
because socket reuse is timing-dependent it presents as an **intermittent** failure,
not every run.

`.node-version` pins `24.16.0`; the CI workflows read it via
`actions/setup-node` `node-version-file: '.node-version'` (they previously floated
`node-version: 24.x` and so silently picked up 24.17.0 while ignoring the committed
pin). `scripts/ci-env-sanity-check.sh` already asserts `.node-version` exists, so the
pin has one authoritative source.

Cost: held one Node patch behind until the regression is fixed upstream.

Two horizons. **Patch:** the `24.16.0`-vs-`.17` hold clears when Node ships the
keep-alive fix (or `google-auth-library`/`gaxios` stops reusing the socket) — then
bump `.node-version` within the 24 line and confirm the bigquery `streaming.spec` is
stable across repeated runs. **Major:** the long-term plan is to **stay on the Node 24
major until it leaves active LTS** — we don't chase Node majors; 24 holds until LTS
itself moves on, at which point we move with it.

## Tracking ignores — `@types/*` slaved to another major

Not holds we're waiting to *clear* — standing constraints that keep a `@types/*`
package locked to the major of the thing it types. Both are `ignore`d for the
**major only** in `dependabot.yml` (minors/patches still flow); both are documented
here only because the rule is "everything ignored is written down."

- **`@types/node`** — held to the Node **runtime** major (24). Moves when the runtime
  major moves (see the Node runtime hold above), not on @types/node's own schedule.
- **`@types/jasmine`** — held to **jasmine-core**'s major (5). Clears with a
  deliberate jasmine-core 5→6 bump, which moves both together.

## Not pins — context, so this list stays short

- **Connector SDKs other than Snowflake and Databricks** (`trino-client`,
  `@google-cloud/*`, `mysql2`, …) aren't pinned — just not-yet-upgraded.
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
