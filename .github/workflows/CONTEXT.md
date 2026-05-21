# GitHub Actions Workflows — AI Guide

This directory is the repo's CI and release machinery. The two things you most likely came here to understand: **what CI runs on a pull request**, and **how packages get published to npm**. Both have pieces that aren't visible from the YAML at a glance — including one security rule you must not break.

## What CI runs

`run-tests.yaml` ("Malloy Tests") is the entry point. It runs on every pull request and on push to `main`, and fans out to one job per database dialect plus a core job, then a rollup:

- **`main.yaml` ("Core")** — the dialect-agnostic tests (`npm run ci-core`): everything that doesn't touch a database, plus tests that touch duckdb/bigquery/postgres but don't need to run once per dialect. Also runs `npm run lint` and the `scripts/ci-*-sanity-check.sh` guards.
- **`db-<dialect>.yaml`** — one reusable workflow (`on: workflow_call`) per dialect: duckdb, duckdb-wasm, bigquery, postgres, mysql, snowflake, trino, presto, databricks, publisher. Each runs `npm run ci-<dialect>` — the **same script you run locally** (see "Mirroring CI locally" in the root CONTEXT.md). So `db-trino.yaml` ≈ `npm run ci-trino`.
- **`malloy-tests`** — an aggregate job that `needs:` every dialect job and does nothing but `echo Success`. It's the single rollup meaning "all of CI passed"; the dialect jobs and this rollup are wired as required status checks on `main`.

`db-motherduck.yaml` exists but is **commented out** of `run-tests.yaml` — motherduck is not currently run in CI. `db-databricks.yaml` is active.

### The security rule — `pull_request_target` + `check-permission`

This is the landmine. `run-tests.yaml` triggers on **`pull_request_target`**, not `pull_request`. That means CI runs in the context of the *base* repo and **has access to secrets even for pull requests from forks**. Unguarded, a fork PR could exfiltrate `BIGQUERY_KEY`, `SNOWFLAKE_CONNECTION`, the databricks tokens, etc.

The guard is the **`check-permission`** job (`malloydata/check-ci-permissions`), which fails if the PR author lacks write access. **Any job that consumes a secret must declare `needs: check-permission`.** There is an explicit comment to this effect in `run-tests.yaml` — honor it. This is not optional; it's the thing standing between the repo and leaked credentials.

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
