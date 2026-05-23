# GitHub Actions Workflows — AI Guide

CI and release machinery. Read the YAML for mechanics; this covers what's *not* visible there — the structure, the security model, and the publishing rules that bite.

## CI

CI is split across **two workflows** by the security boundary: whether the job needs repo secrets. Both fan out to the same per-dialect reusable workflows (`main.yaml`, `db-<dialect>.yaml`), but the entry points differ.

| Workflow | Trigger | Build pattern | Jobs | Secrets |
|---|---|---|---|---|
| `pr-tests.yaml` | `pull_request` | Shared `pull_and_build` artifact | duckdb, postgres, publisher, mysql, duckdb-wasm | none |
| `run-tests.yaml` | `pull_request_target` | Each job rebuilds | main (core), bigquery, snowflake, trino, presto, databricks | yes |

Each workflow has its own rollup job (`malloy-pr-tests`, `malloy-tests`). Branch protection should require both. `db-motherduck.yaml` is commented out of both.

### The split, and why it exists

The deep reason is **`pull_request` vs `pull_request_target`**, and the cache-poisoning footgun that comes with mixing secrets and PR-head code in one workflow.

- **`pull_request`** uses the workflow file from the **PR head**, checks out PR head, and for fork PRs runs with a **read-only token and no repo secrets**. Even malicious fork code can do nothing dangerous — there's nothing to steal and no write access. Safe to build PR-head code, share artifacts between jobs, etc.
- **`pull_request_target`** uses the workflow file from the **target branch (main)** and grants the workflow **full secrets**. By default it checks out main (also safe). The danger appears when you explicitly check out PR head AND run any of its code (`npm ci`, build, tests) — those scripts execute with secrets in env. This is the classic privilege-escalation footgun that's hit Microsoft, Tinder, others.

This repo needs secrets (BigQuery, Snowflake, etc.) for the cloud-DB tests, so it can't avoid `pull_request_target` entirely. The mitigation is the **`check-permission`** job (`malloydata/check-ci-permissions`), which fails unless `github.triggering_actor` has write access. Every secret-bearing job `needs: check-permission`, so fork-PR code never executes alongside secrets without a maintainer's explicit re-run.

CodeQL (`actions/cache-poisoning/poisonable-step`, `actions/untrusted-checkout/critical`) flags `pull_request_target` + checkout-of-head + execute-code + share-output as a static pattern — it can't see runtime gates. The repo has a history of dismissing these alerts because the runtime gate is real. The split removes the *structural* anti-pattern for the build-and-share story by moving it to `pull_request`, where no secrets exist and CodeQL's rule simply doesn't apply.

### Rules that bite

- **Every secret-bearing job MUST `needs: check-permission`** (today: `main`, `db-trino`, `db-presto`, `db-bigquery`, `db-snowflake`, `db-databricks`). Adding a secret to a job in `run-tests.yaml` without that gate leaks it to fork-PR code.
- **Never add a secret to anything in `pr-tests.yaml`.** That workflow's safety property is "no secrets exist." If you need secrets, the job belongs in `run-tests.yaml`.
- **Never share artifacts between the two workflows.** Workflow runs are independent and artifacts are run-scoped anyway, so this isn't easy to do by accident — but if you reach for `actions/cache` to bridge them, you reintroduce the cache-poisoning hole.
- **Branch protection must require both rollups** (`malloy-pr-tests` AND `malloy-tests`), otherwise a fork PR can merge having only run half of CI.
- **The `check-permission` gate trusts the *triggering actor*, not the PR author** — re-running a fork PR's CI authorizes its code to run with full secrets. Review workflow/build-script diffs before re-running.

### Why pr-tests.yaml uses an artifact and run-tests.yaml doesn't

The shared `pull_and_build` artifact saves redundant builds in the secret-free half (5 dialects + 1 build → 5 builds avoided per run). It doesn't help wall-clock — those builds were parallel anyway, sharing the critical path. The point is compute stewardship.

The secret-bearing jobs deliberately stay self-sufficient. They could in principle share a separate `pull_and_build` artifact within `run-tests.yaml`, but that's the exact pattern CodeQL flags and the threat we're avoiding. Each rebuilds; redundant work is the price of the structural guarantee.

### Why we can iterate on pr-tests.yaml via PRs but not run-tests.yaml

`pull_request` uses the workflow file from the PR head, so changes to `pr-tests.yaml` take effect immediately in that PR's CI. `pull_request_target` uses the workflow from main, so changes to `run-tests.yaml` only take effect after merge — `workflow_dispatch` on the branch is the way to test those changes pre-merge.

`scripts/ci-test-sanity-check.sh` (run by `main.yaml`) fails if any `*.spec.ts(x)` isn't wired into a `jest.config.ts` project — so no test can be silently absent from CI.

Contributor-facing side (DCO sign-off, licensing, review) is in [CONTRIBUTING.md](../../CONTRIBUTING.md). Adding a dialect: [adding-a-new-database.md](../../packages/malloy/src/doc/adding-a-new-database.md).

## Publishing (`release.yaml`)

Publishing uses **GitHub Actions OIDC trusted publishing**, not a stored `NPM_TOKEN` — there is no npm secret in this repo and one should not be added back. Each `@malloydata/*` package has a trusted publisher registered on npmjs.com bound to `malloydata/malloy` + `release.yaml`, set from a maintainer's machine (`npm trust github <pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes`, needs npm ≥ 11.10).

`release.yaml` is `workflow_dispatch`-only and runs three sequential jobs: `pull_and_build` checks out the repo, runs `npm ci` + `npm run build` + `npm run build-duckdb-db`, then uploads the entire built workspace (excluding `.git`) as a zstd-compressed tar artifact. `precheck` and `npm-release` both download that artifact instead of rebuilding — `precheck` runs `npm run precheck`, then `npm-release` publishes every workspace package, cuts the GitHub Release, and bumps the version. The gate is intentionally just precheck, not the full dialect matrix — those are required checks to *merge*, so they aren't re-verified at release.

The artifact pattern (build once, fan out) lives entirely inside `release.yaml` rather than a separate top-level workflow because OIDC trusted publishing binds to the top-level caller filename — moving build to a different workflow file would break npm publish.

**Rules that bite (not guessable):**

- **One trusted publisher per package** — can't trust both `release.yaml` and `prerelease.yaml`; a second registration 409s.
- **Matching is on the top-level caller workflow filename**, not a reusable workflow it calls.
- **OIDC auto-enables provenance, which requires `repository.url`** in each published package.json (`{ "type": "git", "url": "https://github.com/malloydata/malloy" }`). Missing it → publish fails with a `422 ... provenance` error. This is the likely failure when adding a new package.

**Adding a published package:** add the `repository` field, then register the trusted publisher (the two failure modes above).

**Recovering a partial release:** the publish loop skips already-published versions (npm versions are immutable), so fix the cause, merge, and **re-run at the same version** — don't bump. The version bump is the last step, so a failed release correctly leaves the repo at the version it was finishing.

`prerelease.yaml` is currently inert (not OIDC-wired; the single trusted publisher points at `release.yaml`). Restoring prerelease-on-merge collides with the one-publisher rule — part of the planned publish rework.

The CLI (`malloydata/malloy-cli`) and explorer (`malloydata/malloy-explorer`) publish from their own repos with their own registrations.
