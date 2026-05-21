# GitHub Actions Workflows — AI Guide

This directory is the repo's CI and release machinery. The two things you most likely came here to understand: **what CI runs on a pull request**, and **how packages get published to npm**. Both have pieces that aren't visible from the YAML at a glance — including one security rule you must not break.

## What CI runs

`run-tests.yaml` ("Malloy Tests") is the entry point. It runs on every pull request and on push to `main`, and fans out to one job per database dialect plus a core job, then a rollup:

- **`main.yaml` ("Core")** — the dialect-agnostic tests (`npm run ci-core`): everything that doesn't touch a database, plus tests that touch duckdb/bigquery/postgres but don't need to run once per dialect. Also runs `npm run lint` and the `scripts/ci-*-sanity-check.sh` guards.
- **`db-<dialect>.yaml`** — one reusable workflow (`on: workflow_call`) per dialect: duckdb, duckdb-wasm, bigquery, postgres, mysql, snowflake, trino, presto, databricks, publisher. Each runs `npm run ci-<dialect>` — the **same script you run locally** (see "Mirroring CI locally" in the root CONTEXT.md). So `db-trino.yaml` ≈ `npm run ci-trino`.
- **`malloy-tests`** — an aggregate job that `needs:` every dialect job and does nothing but `echo Success`. It's the single rollup meaning "all of CI passed"; the dialect jobs and this rollup are wired as required status checks on `main`.

`db-motherduck.yaml` exists but is **commented out** of `run-tests.yaml` — motherduck is not currently run in CI. `db-databricks.yaml` is active.

### Safely accepting external PRs (the scary part)

Read this before touching `run-tests.yaml`. How this repo runs CI on outside contributions is a deliberate design (PR #2087, Jan 2025) that does, on purpose, the exact combination GitHub documents as a privilege-escalation vulnerability. A single job is what keeps it safe, and the safety depends on a human step that's easy to perform carelessly.

**Why it's built this way.** Database tests need real credentials (BigQuery, Snowflake, Databricks, …). A normal `pull_request` workflow from a fork gets **no** secrets, so DB tests could never run on external contributions. To allow them, #2087 switched to **`pull_request_target`**, which runs in the *base* repo's context and therefore *has* the secrets — even for fork PRs, with no automatic "approve to run" prompt.

**Why that's dangerous.** The workflow also checks out the PR's head code (`ref: ${{ github.event.pull_request.head.sha || github.sha }}`) and runs `npm ci` + build + test on it. That is **arbitrary code from the PR author executing on a runner that holds production credentials.** `pull_request_target` + checkout-the-PR-head + secrets is *the* canonical Actions footgun: unguarded, a stranger's PR could print or exfiltrate every secret.

**What makes it safe — and the flow.** The **`check-permission`** job (`malloydata/check-ci-permissions`) fails the run unless **`github.triggering_actor`** has write access. It checks the *triggering actor*, **not** the PR author. So:

- A stranger opens a PR → they are the triggering actor → `check-permission` fails → no credentialed job runs.
- A **maintainer reviews the diff and re-runs CI** → the maintainer becomes the triggering actor → the gate passes → DB tests run with secrets.

A write-access person vouching for the code is the thing that unlocks secret access. That's the intended human-in-the-loop.

**Pitfalls:**

- **Adding a secret to a job without `needs: check-permission`** exposes that secret to arbitrary external-PR code. The secret-bearing jobs that MUST gate today: `main`, `db-trino`, `db-presto`, `db-bigquery`, `db-snowflake`, `db-databricks`. Secret-free jobs (`db-duckdb`, `db-postgres`, `db-mysql`, `db-publisher`, `db-duckdb-wasm`) deliberately don't gate — they run untrusted code but hold no credentials, so the blast radius is just ephemeral compute. There's a comment to this effect in `run-tests.yaml`; honor it.
- **Re-running an external PR's CI is an authorization act.** Because the gate trusts the triggering actor, clicking "re-run" on a fork PR makes *you* the authorizer and runs that PR's code with full secrets. Review the diff — especially any change to a workflow or a build script — before you re-run. Never re-run a PR you haven't read.
- **Don't "simplify" the trigger back to `pull_request`.** That silently strips secret access, and DB tests stop exercising anything real on external PRs.

The contributor-facing half — DCO sign-off, licensing, the committers list, the review requirement — lives in [CONTRIBUTING.md](../../CONTRIBUTING.md). DCO is enforced as a required status check, which is why bot/release commits use `git commit -s`.

### CI integrity guards

`main.yaml` runs two guard scripts before the core tests:

- **`scripts/ci-test-sanity-check.sh`** — diffs every `*.spec.ts(x)` in the tree against `npx jest --listTests`. If you add a test file but don't wire it into a `jest.config.ts` project, CI fails here. The point is that **no test can be silently absent from CI.**
- **`scripts/ci-env-sanity-check.sh`** — fails if `.node-version` is missing or empty.

### Conventions across the test workflows

- Every workflow starts with `permissions: {}` — least privilege by default. Grant narrowly only where needed (e.g. `release.yaml` adds `contents: write` + `id-token: write`).
- Each checks out `ref: ${{ github.event.pull_request.head.sha || github.sha }}` — the PR head, falling back to the pushed SHA.
- Node is pinned to 20.x via `setup-node`. (Note: the runner's bundled npm is old; `release.yaml` upgrades it in-job — see below.)
- Jobs using duckdb-backed test data run `npm run build-duckdb-db` first; postgres loads its fixture from `test/data/postgres/*.sql.gz`; trino/presto/mysql start and stop a docker service via `test/<db>/<db>_start.sh` / `_stop.sh`.

### Adding a new dialect

Copy an existing `db-<dialect>.yaml` (pick one whose service setup matches — plain, a postgres-style service container, or a docker start/stop script), point it at `npm run ci-<dialect>`, then wire it into `run-tests.yaml`: add the job, add it to the `malloy-tests` `needs:` list, and **add `needs: check-permission` if it uses any secret.**

## How packages are published to npm

### Publishing is OIDC trusted publishing, not a token

Releases authenticate to npm with **GitHub Actions OIDC trusted publishing**, not a stored `NPM_TOKEN`. At publish time GitHub mints a short-lived OIDC token, npm verifies it against a per-package registration, and hands back a publish credential. There is no npm secret in this repo, and one should not be reintroduced — if you find yourself adding `NPM_TOKEN` back, something is wrong.

Each published `@malloydata/*` package has a **trusted publisher** registered on npmjs.com, bound to repo `malloydata/malloy` + workflow `release.yaml`. Registration is done from a maintainer's machine, not from CI:

```bash
npm trust github @malloydata/<pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes
```

This needs npm ≥ 11.10 locally (`npm trust` + bulk support) and a logged-in account that owns the package. The repo's pinned node (`.node-version`) ships an older npm; `npm install -g npm@latest` upgrades it for that node version only. CI does its own `npm install -g npm@latest` inside the job for the same reason.

### Rules that bite (none of these are guessable)

- **One trusted publisher per package.** You cannot trust both `release.yaml` and `prerelease.yaml` for the same package — a second registration is rejected with a 409. Pick one. We chose `release.yaml`.
- **Matching is on the top-level caller workflow filename.** If a workflow uses a *reusable* workflow (`workflow_call`) to run `npm publish`, npm checks the **calling** workflow's filename, not the reusable one. Register the file that GitHub triggers.
- **OIDC silently turns on provenance, and provenance hard-requires `repository.url`.** Every published package.json must declare a `repository` field whose URL matches this repo:
  ```json
  "repository": { "type": "git", "url": "https://github.com/malloydata/malloy" }
  ```
  A package missing this fails publish with a `422 ... Error verifying sigstore provenance bundle`. This is the most likely failure when adding a new package, because the rest of the build won't warn you.

### Adding a new published package — checklist

1. Add the `repository` field above to its `package.json`.
2. Register its trusted publisher: `npm trust github @malloydata/<pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes`.

Miss step 1 and the release fails partway (provenance 422). Miss step 2 and it fails on auth.

### The release workflow (`release.yaml`)

`workflow_dispatch` only. Two jobs:

- **`precheck`** — runs `npm run precheck` (dialect-agnostic tests + duckdb). This is the gate; the publish job depends on it, so the privileged publish job only starts once tests are green.
- **`npm-release`** — builds, publishes each workspace package via OIDC, creates the GitHub Release, then bumps the version (`lerna version patch`) and pushes the `Version x-dev` commit to `main`.

The release gate is deliberately **not** the full dialect matrix that gates a merge. Dialect-specific suites are required checks to *merge to main*, so a regression can't reach main unnoticed; the release just doesn't re-verify them. (See the publish-workflow rework issue for the longer-term plan around this and a merge queue.)

### Recovering from a partial release

The publish loop is idempotent by version: it runs `npm view "$PKG@$VERSION"` and **skips** anything already published. npm versions are immutable, so this is the recovery mechanism — **do not bump the version to recover**.

If a release dies mid-publish (e.g. one package's provenance fails):

1. Fix the cause (usually a missing `repository` field), merge it.
2. Re-run `release.yaml` at the **same** version. Already-published packages are skipped; the missing ones publish; then the version bump runs.

The version bump is the *last* step, so a failed release leaves the repo at the version it was publishing — which is exactly the precondition for finishing it. A repo stuck at a half-published version is normal and recoverable, not broken.

### prerelease.yaml

Currently **inert** — `workflow_dispatch` only and not wired for OIDC (all packages' single trusted publisher points at `release.yaml`). At one point it published a prerelease on every merge to `main`. Restoring that collides with the one-publisher-per-package rule, so it's part of the planned publish-workflow rework, not a flip-the-trigger change.

### Other repos

The CLI (`malloydata/malloy-cli`, `@malloydata/cli`) and explorer (`malloydata/malloy-explorer`, `@malloydata/malloy-explorer`) publish from their own repos and have their own trusted-publisher registrations against their own workflow files. They are not published from here.
