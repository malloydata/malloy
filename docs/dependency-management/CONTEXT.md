# Dependency management in the Malloy mono-repo

This directory is the dependency-management context node. This file is the **pin ledger** —
what we hold, why, what it costs, and when to revisit. The **procedures** live beside it as
agent-agnostic runbooks (plain markdown any human or coding agent can follow — no tool is
imposed on contributors):

- [`dependabot-monthly.md`](dependabot-monthly.md) — the monthly Dependabot version-update pass.
- [`npm-security-audit.md`](npm-security-audit.md) — the `npm audit`-driven security sweep + pin release-walk.

## Methodology

We used a tiered strategy, using GitHub's Dependabot as input.  We group these, roughly into these catgories.

1. Security reports. We plan to stay on top of these as soon as they appear.
2. Minor version upgrades. We check these once a month and pull in as many of them as we can.
3. Major version upgrade. These also are checked once a month, however we are likely to simply file an issue and not actually incorporate the new version until another reason appears to make the upgrade.

The monthly Dependabot runs (`.github/dependabot.yml`), with version updates are
collected into groups so a bump lands as one reviewable PR with a clear blast radius
instead of a scatter of one-offs:

- **`connectors`** — the database SDKs (`@google-cloud/*`, `@databricks/*`,
  `@trinodb/*`, `mysql2`, `pg`, …). Historically these have all been problematic when we update them, so we keep them in their own little corner.
- **`toolchain`** — the gts / typescript / eslint / prettier cluster, majors only;
  they move together or not at all.
- **`minor-and-patch`** — everything else's in-range minors/patches, folded into one
  PR (duckdb excluded — it gets its own group for the same deliberate-PR reason).

Dependabot's **automated security updates are turned off** (the repo's
`automated-security-fixes` setting), and the `security:` group is removed with them. For
malloy's tree the auto-fix PRs cost more than they give: nearly every advisory is a
*transitive* dep buried under a package we hold, which Dependabot can't fix by editing a
manifest line — so it opens nothing, or worse bumps an already-safe *direct* copy to a
breaking major. uuid #2959 is the cautionary case: it proposed our already-patched
`11.1.1` → `14.0.0` (the ESM-only major we deliberately hold), fixing none of the
vulnerable transitive copies. Security is instead monitored deliberately with
`npm audit --omit=dev`, reconciled against the holds below; the Dependabot alert tab is
used only to dismiss advisories with a reason.

We may decide to respond to a Dependabot report in one of three ways

1. Bump our internal dependency.
2. Pin our dependency, and file a bug indicating we would like to update later but it is not urgent.
3. Pin our dependency, and document what needs to happen externally before we can update the dependency.

It is important to know that, even for security dependencies, we might have to pin instead of move, and usually this is not really an issue. The security report on the package is a part of the package which we do not actually touch, so it isn't an actual securiry problem for people down stream of the Malloy package.

**A pin has two surfaces, and both are mandatory.** To actually hold a version you
must (1) **constrain the range** in the owning package's `package.json` so a fresh
`npm install` can't reach the bad version — *and* (2) **`ignore`** it in
`dependabot.yml`, or the next group PR re-bumps it straight back. **One without the
other is not a pin.** Databricks is the cautionary tale: #2888 pinned `package.json`
to `1.15.0` but skipped the `ignore`, so connectors-group PR #2934 reverted it a week
later and shipped the break in `@malloydata/malloy` 0.0.418. Every entry below names
both surfaces. (The *transitive* advisories a pin holds open are alert-only — no PR —
and are listed under each entry as the cost.)

**Caret by default; exact only when the caret can't hold.** Prefer a **caret major-cap**
(`^11.1.1`) plus a **major-only** `ignore` — it bars the bad *major* while still
letting CJS-line minors/patches and their security fixes flow (uuid, @noble/hashes,
`@types/*` all work this way). Drop to a hard **exact pin** (no caret) only
when you hit a wall: the breaker is *in-range*, so a caret would still resolve it on a
fresh install (databricks `1.15.0`, snowflake-sdk `2.3.1`). Exact is the
escalation, not the default.

### ESM-only majors — and the downstream-leak trap

The npm ecosystem is migrating to ESM-only packages. Our code ships CommonJS and our
tests run under jest's CJS runtime, so an ESM-only dep can fail to load. Before holding
one, two splits matter: *who pays*, and *what kind of break*.

**Who pays — devDependency vs published runtime dependency.** This is the one we
learned the hard way.
- A **devDependency** (never shipped) only has to satisfy *our* jest. An ESM-only one
  is **takeable**: add it to `transformIgnoreModules` in **both** `jest.config.ts`
  (in `defaultConfig`, which every `projects` entry spreads — the top-level `transform`
  does **not** cascade into `projects`) and `jest.config.simple.ts`; babel-jest then
  rewrites its ESM to CJS and it loads. One line.
- A **published runtime dependency** of a core package (e.g. `@malloydata/malloy`) is
  the opposite. The transform fixes *our* tests but **does nothing for consumers** — a
  downstream app that bundles with esbuild or tests with ts-jest inherits the raw ESM
  and breaks, and can't even see why. **An ESM-only runtime dep leaks downstream
  exactly like a native `.node` binary.** So it is *not* takeable; it's a hold — pin to
  the last CJS-consumable major. This bit us in 0.0.419: `uuid` v14 and `@noble/hashes`
  v2 were taken as "takeable", green in malloy's own CI, and broke the vscode extension
  and malloy-cli the moment they consumed it (see the hold below).
- A **runtime dependency of a package that bundles** is takeable again. What leaks is
  raw ESM in the *published artifact*, so a package whose build inlines its deps ends
  the question: `@malloydata/render` externalizes nothing (`external: []` in
  `vite.config.base.mts`), publishes CJS+ESM entries, and therefore runs the ESM-only
  vega 6 / vega-lite 6 line with no consumer able to tell. Read the build config, not
  the dependency block — `dependencies` vs `devDependencies` does not answer this.
  (It is also the standing exit for the uuid / @noble holds: bundle `@malloydata/malloy`
  and the whole class retires.)

**What kind of break — static ESM vs runtime dynamic `import()`.**
- **Static ESM** (plain `import`/`export`): babel-jest can transform it (devDep case),
  or you pin (runtime-dep case).
- **Runtime dynamic `import()` of an ESM-only target** (e.g. `gaxios` 7's
  `await import('node-fetch')`): also transformable, but you must name **both** the
  importer and the target in the list — babel rewrites the `import()` to a `require`,
  which then needs the target to be CJS too. And when the pair lives under another
  package's `node_modules`, `transformIgnorePatterns` has to reach nested copies:
  `node_modules/(?!.*(${transformIgnoreModules})/)`. Neither this nor the static case
  needs `--experimental-vm-modules`, which we still reject: it cannot be made invisible
  for a bare `npx jest FILE -t NAME`, so it breaks the single-test workflow.

(`@motherduck/wasm-client` stays in `transformIgnoreModules` defensively, but it's held
at CJS 0.6, so it doesn't actually exercise the transform. `vega-lite`, `vega-util`,
`vega-expression` and `vega-event-selector` are there for real — the vega 6 line is
ESM-only and a render spec loads them at runtime.)

### `Cannot find module 'x/lib/y.js'` is a jest-resolver symptom, not a version skew

When a dep adds an `exports` map, jest resolves its subpaths through the
`resolve.exports` copy that **jest itself** depends on — not through node's resolver.
`resolve.exports` **1.x cannot match subpath patterns** (`"./lib/*.js": "./lib/*.js"`),
so every deep import into that dep fails under jest while `node -e "require(…)"`
succeeds. 2.x matches them. Jest's own lockfile position therefore decides whether a
dependency bump is takeable.

The tell is that split: node resolves the path, jest doesn't. When you see it, check
`node_modules/resolve.exports/package.json` before concluding anything about the two
packages named in the error. Anything that deep-imports a sibling's internals —
`pg-cursor` into `pg`, and the pattern generally — sits behind this.

## Held because the upgrade breaks this repo

Each of these is `ignore`d only until the linked fix lands — the new version breaks
*our* build, tests, or codegen, so the hold clears when we do the work.

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

### duckdb-wasm — `apache-arrow` held at `^17.0.0`
Owned by `packages/malloy-db-duckdb`. Not our choice: **both** wasm deps require
`apache-arrow ^17.0.0` — `@duckdb/duckdb-wasm` as a dependency and
`@motherduck/wasm-client` as one too (a peer dep from its 1.x on). Raising our
declaration to 21 leaves `npm ls` reporting `invalid` and puts our arrow typings a
major ahead of the `Table` / `StructRow` values duckdb-wasm actually hands back — a
skew `tsc` cannot see, because the values arrive as `any` across the wasm boundary.
The build stays green throughout, so nothing here catches it; this row is the catch.
`ignore`d in `dependabot.yml` (it opens a PR every month otherwise — #3074 is the
current one).

Cost: arrow held at 17 while latest is 21; no advisory rides on it.

Revisit when: `@duckdb/duckdb-wasm` and `@motherduck/wasm-client` both accept a newer
arrow. Read *their* dependency ranges — our own version is not the constraint.

### BigQuery — `@google-cloud/bigquery` + `common` + `paginator` held at v7/v5
Owned by `packages/malloy-db-bigquery`, exact-pinned to **best-v7** (`7.9.4` /
`5.0.2` / `5.0.2`) as a coupled set.

**The blocker is `projectId`, not ESM.** `BigQueryConnection`'s constructor reads
`this.bigQuery.projectId` synchronously (`bigquery_connection.ts`, and again on the
tables-API round-trip below it). v7's SDK has a project id by then; v8/v9's resolves
it asynchronously, so the constructor stores nothing and every query fails
`Invalid SQL, ProjectId must be non-empty`. Making the connector await
`getProjectId()` from a synchronous constructor is the work the bump needs.

The ESM story that used to occupy this entry is settled and was wrong. `gaxios@7`
does `await import('node-fetch')` when no `fetchImplementation` is configured, which
throws `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` under jest's CJS VM and surfaces
as "Unexpected Gaxios Error". The entry said babel could not help because the import
target is ESM-only. **It can**: transform the importer *and* the target — `gaxios`,
`node-fetch`, `teeny-request` and node-fetch's own ESM deps — and the whole auth path
runs, live queries included, no `--experimental-vm-modules`. Verified against live
BigQuery on bigquery 9.0.3 / common 8.0.2. Two mechanics matter if you redo it: the
transform list must name the *target* as well as the importer, and
`transformIgnorePatterns` must be written to reach **nested** copies
(`node_modules/(?!.*(mods)/)`) since these live under
`node_modules/@google-cloud/common/node_modules/`.

So this hold no longer waits on jest→vitest. It waits on us.

Cost: bigquery connector held on the v7 SDK line; whatever transitive security the
v8 stack would clear stays open.

Revisit when: issue #2932 — teach the connector to resolve `projectId`
asynchronously, then bump the trio together with the transform entries above, and
confirm `db-bigquery` **and** the ci-core bigquery `streaming.spec` pass **without**
the flag.

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

**Judging a fix version — don't probe, defer to this boundary.** `2.3.1` is the **last
pre-native** release; the pin is a point *inside* the 2.x line, not a semver-major cap.
A newer 2.x (`2.4.3`, …) is on the *far* side of the native boundary — same npm major,
wrong side of the line. npm metadata **cannot** tell you which side: the native binary
loads via a bundled `.node` + `eval('require')` (see below), invisible to `npm view
version`, `optionalDependencies`, `dependencies`, and install `scripts` alike — a
security sweep once floated `2.3.1 → 2.4.3` as a "cheap same-major fix" off exactly that
blind check. It isn't: bumping across this line is the native-chain thrash the pin
exists to hold, so the `fast-xml-parser` critical below stays a standing cost until a
deliberate, native-aware bump verified against live Snowflake CI. Same trap on every
boundary pin — `@databricks/sql 1.15.0` (last pre-native), `uuid ^11` / `@noble/hashes
^1` (last CJS): the ledger's boundary is authoritative; npm metadata won't show you the
binary.

There's also a **downstream-bundling** dimension, the same family of problem as
Databricks: snowflake-sdk's native form loads its binary via `eval('require')`, which
is invisible to esbuild, so it can't be bundled cleanly into the embedding apps. Part
of what we're waiting for is Snowflake **restructuring their npm package** so the
native pieces externalize/bundle properly downstream. *(Current understanding, not yet
tied to a specific Snowflake issue — verify before acting on it.)*

Holds open (alert-only — no PR):
- `fast-xml-parser` — 2×critical, 4×high *(also pulled by BigQuery's
  `@google-cloud/storage`; clears only when every owner moves)*
- `bn.js` — 2×medium

Snowflake's `axios` resolves to the tree's single hoisted copy, held at `1.19.0` by
the Trino axios pin below. No axios advisory is open against it.

Waiting for: a security advisory to force our hand (the held `fast-xml-parser` /
`bn.js` alerts are the standing cost, reviewed monthly), **or** Snowflake
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
release. The hold's *reason* is the native break, not security — but two high
`thrift` advisories now ride on 1.15.0's `thrift@0.16.0` (see Cost). **1.16.0 clears
neither** (still `thrift ^0.16.0`) and *adds* the native kernel — a strict regression;
only **2.0.0** bumps thrift to `^0.23.0`, and it carries the same kernel, so the
security fix is gated behind the very packaging work below, not a bump we can make now.

The cautionary half — the two-surfaces rule's headline example: **#2888 pinned
`package.json` to 1.15.0 but did not add the `dependabot.yml` ignore.** A pin
without its ignore is not a pin — a week later the connectors-group PR #2934
re-bumped it to 1.16.0, silently reverting #2888, and it shipped in
`@malloydata/malloy` 0.0.418, breaking that release's downstream PRs. The durable
fix is both surfaces: exact-pin `1.15.0` in `package.json` **and**
`ignore: @databricks/*` in `dependabot.yml` (so the connectors group can't squat it).

Cost: databricks connector held one minor behind. Two high `thrift` advisories ride
on the held `thrift@0.16.0` — GHSA-r67j-r569-jrwp (uncontrolled recursion, `<0.23.0`)
and GHSA-526f-jxpj-jmg2 (path traversal / request-response splitting, `<=0.22.0`) —
both alert-only, no PR. Not a live worry: both are Thrift **server** / adversarial-peer
surfaces (a malicious message parser, or someone hitting a Thrift *server*), and malloy
is only a **client** over TLS to the user's own authenticated warehouse, so nothing
attacker-controlled reaches them. Clears at 2.0.0 (thrift `^0.23.0`) — i.e. with the
native-packaging work above, not before.

Waiting for: one of two triggers — **(a)** a security advisory, direct or transitive,
against 1.15.0 (it lights the alerts tab regardless of the ignore), or **(b)** a
customer who actually needs the native kernel. Absent both, we stay on 1.15.0
indefinitely. Either trigger unblocks the same work: give the embedding apps (vscode
extension + malloy-cli) native-kernel packaging — externalize and ship the
per-platform `@databricks/databricks-sql-kernel-*` `.node` binaries, `approve-native`
them in each — then take 1.16.0+ and verify against the live Databricks CI env. Until
then it's supported-or-rots: the connector is welded to the embedding apps' bundlers,
so it can't float.

### Trino — `axios` pinned exactly at `1.19.0` to match the connector's own pin
Owned by the **root** `package.json`. `@trinodb/trino-js-client` declares `axios` as
an exact version, not a range; no upstream rationale is recorded. npm hoists one
`axios` only while the root resolves to that same version. At any other value — a
routine in-range float to `1.20.0` included — a **second copy** nests under
`node_modules/@trinodb/trino-js-client`, and the advisories land on it.

Both surfaces: exact `1.19.0` in the root `package.json` **and** `ignore: axios` in
`dependabot.yml`.

**The connector is exact-pinned too — `@trinodb/trino-js-client` at `0.3.2` in
`packages/malloy-db-trino` — and the two move together.** Upstream ships releases
whose only change is the axios pin (`0.3.0`/`0.3.1` carried `1.13.2`; `0.3.2` carries
`1.19.0` and nothing else). Under a caret, such a release lands a connector whose
exact axios no longer matches the root, npm nests a second copy, and the `ignore`
above guarantees nothing ever proposes re-converging it. **Any `@trinodb` bump must
move the root `axios` pin to that release's exact axios, in the same PR.**

Deliberately *not* in the `ignore` list: it stays in the `connectors` group so their
`1.0.0` still arrives as a standalone PR. The group is the notification; the rule
above is the guard.

The publisher declares `axios ^1.19.0` — a floor, not a pin. `malloy-db-publisher`
is published, so its range is what downstream consumers resolve; the floor keeps them
above the advisory range rather than inheriting it. `1.19.0` satisfies it here, so the
hoisted copy still serves it and there is nothing extra to unwind.

Cost: axios security fixes arrive on the connector's release cadence, not npm's. An
advisory against `1.19.0` is answered by a `@trinodb/trino-js-client` release
carrying a newer pin, not by bumping axios here.

Waiting for: **trinodb/trino-js-client#956** — drops axios for native `fetch` +
`undici`, public API unchanged, targeted at their `1.0.0` (their #982). Taking that
release ends the constraint and the root returns to a caret.

### uuid + @noble/hashes — held below their ESM-only majors
Owned by `packages/malloy` (core, published as `@malloydata/malloy`). **uuid 12+ and
@noble/hashes 2+ dropped CommonJS** — pure ESM (`"type": "module"`, no `require`
build). malloy is CJS and is consumed by apps that bundle with esbuild and test with
ts-jest, so a pure-ESM runtime dep breaks every consumer's bundle and test runner —
while malloy's own CI stays green (babel-jest transforms it locally). Same leak as a
native binary, different mechanism. It shipped in 0.0.419 and broke the vscode
extension and malloy-cli on the spot; 0.0.420 pins both back to their last CJS majors.

Held: `uuid ^11.1.1` and `@noble/hashes ^1.8.0` in `packages/malloy/package.json`
(plus the root devDep `uuid`) — caret ranges that cap below the ESM major, with a
**major-only** `ignore` in `dependabot.yml` so CJS-line minors/patches still flow.
@noble/hashes also needed two import-path reverts in `model/utils.ts`
(`/sha2.js`→`/sha256`, drop the `.js`); the digest is byte-identical. Both are out of
`transformIgnoreModules` now — they're CJS again, so no transform is needed.

Cost: held on uuid 11 / @noble 1; no security advisory rides on either today.

Revisit when: consumers can take ESM — the embedding apps' bundler **and** test runner
handle ESM-only deps, or `@malloydata/malloy` ships a **bundled** artifact that inlines
its runtime deps (making consumer module-format moot, and retiring this whole class of
leak). Until then, the core stays CJS-consumable.

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

Not a hold we're waiting to *clear* — a standing constraint that keeps a `@types/*`
package locked to the major of the thing it types. `ignore`d for the **major only**
in `dependabot.yml` (minors/patches still flow), and documented here only because the
rule is "everything ignored is written down."

- **`@types/node`** — held to the Node **runtime** major (24). Moves when the runtime
  major moves (see the Node runtime hold above), not on @types/node's own schedule.
  The declarations currently say 22 while the runtime says 24 — PR #3002 syncs them
  and adds `npm run check-tracking-types` so the two can't drift again.

## Not pins — context, so this list stays short

- **Connector SDKs other than Snowflake and Databricks** (`@trinodb/*`,
  `@google-cloud/*`, `mysql2`, …) aren't pinned — just not-yet-upgraded.
  Their transitive advisories (`thrift`, `fast-xml-parser`, `uuid`) clear
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
