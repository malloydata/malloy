# GitHub Actions Workflows — AI Guide

CI and release machinery. Read the YAML for mechanics; this covers what's *not* visible there — the structure, the security model, and the publishing rules that bite.

Dependabot (config, the alerts-vs-PRs distinction, and the deliberate-pin ledger) is documented one level up in [`../CONTEXT.md`](../CONTEXT.md) and [`DEPENDENCY-MANAGEMENT.md`](../../DEPENDENCY-MANAGEMENT.md).

## CI

`run-tests.yaml` is the entry point (runs on PRs and pushes to `main`). It first runs a `pull_and_build` job that does `npm ci` + `npm run build` + `npm run build-duckdb-db` once, tars the workspace (excluding `.git`) with zstd, and uploads it as an artifact. Every downstream test job `needs: pull_and_build`, downloads the artifact, and runs only its dialect-specific setup + `npm run ci-<dialect>` — no per-job rebuild. Fan-out goes to reusable workflows — `main.yaml` (dialect-agnostic `ci-core`, plus `lint` and the `scripts/ci-*-sanity-check.sh` guards) and one `db-<dialect>.yaml` per dialect — then a `malloy-tests` rollup job that `needs:` them all. `db-motherduck.yaml` is commented out of CI.

`scripts/ci-test-sanity-check.sh` (run by `main.yaml`) fails if any `*.spec.ts(x)` isn't wired into a `jest.config.ts` project — so no test can be silently absent from CI.

### Safely accepting external PRs — do not break this

`run-tests.yaml` triggers on **`pull_request_target`**, so it runs with the repo's secrets *and* checks out the PR's head code — arbitrary code from any author running on a runner that holds production credentials. This is a known privilege-escalation footgun; the **`check-permission`** job (`malloydata/check-ci-permissions`) contains it, failing the run unless **`github.triggering_actor`** has write access (design: PR #2087).

- **Every secret-bearing job MUST `needs: check-permission`** (today: `main`, `db-trino`, `db-presto`, `db-bigquery`, `db-snowflake`, `db-databricks`). Secret-free jobs deliberately don't. Adding a secret to an ungated job leaks it to external-PR code.
- The gate trusts the *triggering actor*, not the PR author — so **re-running a fork PR's CI authorizes its code to run with full secrets.** Review the diff (especially workflow/build-script changes) before re-running.

### The security stance on pull_and_build, stated honestly

`pull_and_build` runs `npm ci` on PR-head code and uploads the result as an artifact that every downstream dialect job (including secret-bearing ones) consumes. CodeQL flags this — `actions/cache-poisoning/poisonable-step` and `actions/untrusted-checkout/critical` — and is technically correct: the artifact contains attacker-influenceable output. **The repo's policy is to dismiss those alerts**, on the same reasoning as the prior dismissals already on file for similar shapes in this repo.

The dismissal stands because the threat model is no different from the per-job-rebuild design that existed before `pull_and_build`. Whether `npm ci` runs once centrally or eleven times in each dialect job, the same PR-head code ends up executed alongside secrets when (and only when) `check-permission` lets the secret-bearing jobs run. The runtime gate is the actual mitigation; CodeQL cannot see runtime gates and so over-reports.

`pull_and_build` itself runs with no repo secrets declared and `permissions: {}` denying the GITHUB_TOKEN any write access. That prevents the dumbest exfiltration ("print env in postinstall") but it does not meaningfully shrink the attack surface — a malicious postinstall can modify `node_modules`/`dist`, the modified output gets tarred up, downloaded by every secret-bearing job, and executed during `npm test` with the dialect's credentials available (some are env vars, others are written to disk by auth actions like `google-github-actions/auth`). The protection is the runtime gate. Don't read more into the centralization than that.

**When dismissing an alert on this:** reference this section and the prior dismissals. Edits that change the structural shape of `pull_and_build` (new upload, different checkout target, added trigger) will re-fire the alert — that is the *desired* behavior; it forces a re-read of this stance before the shared-artifact pattern changes shape.

The artifact pattern saves compute (one build instead of ~11 parallel rebuilds, ~30 runner-minutes per PR run) rather than wall-clock time — the parallel rebuilds shared the critical path, so wall-clock is similar. It's a stewardship-of-free-resources choice, not a CI-speed choice.

Contributor-facing side (DCO sign-off, licensing, review) is in [CONTRIBUTING.md](../../CONTRIBUTING.md). Adding a dialect: [adding-a-new-database.md](../../packages/malloy/src/doc/adding-a-new-database.md).

## Publishing (`release.yaml`)

Publishing uses **GitHub Actions OIDC trusted publishing**, not a stored `NPM_TOKEN` — there is no npm secret in this repo and one should not be added back. Each `@malloydata/*` package has a trusted publisher registered on npmjs.com bound to `malloydata/malloy` + `release.yaml`, set from a maintainer's machine (`npm trust github <pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes`, needs npm ≥ 11.10).

`release.yaml` is `workflow_dispatch`-only and runs three sequential jobs: `pull_and_build` checks out the repo, runs `npm ci` + `npm run build` + `npm run build-duckdb-db`, then uploads the entire built workspace (excluding `.git`) as a zstd-compressed tar artifact. `precheck` and `npm-release` both download that artifact instead of rebuilding — `precheck` runs `npm run precheck`, then `npm-release` publishes every workspace package, cuts the GitHub Release, and bumps the version. The gate is intentionally just precheck, not the full dialect matrix — those are required checks to *merge*, so they aren't re-verified at release.

The artifact pattern (build once, fan out) lives entirely inside `release.yaml` rather than a separate top-level workflow because OIDC trusted publishing binds to the top-level caller filename — moving build to a different workflow file would break npm publish.

**Rules that bite (not guessable):**

- **One trusted publisher per package** — can't trust both `release.yaml` and `prerelease.yaml`; a second registration 409s.
- **Matching is on the top-level caller workflow filename**, not a reusable workflow it calls.
- **OIDC auto-enables provenance, which requires `repository.url`** in each published package.json (`{ "type": "git", "url": "https://github.com/malloydata/malloy" }`). Missing it → publish fails with a `422 ... provenance` error. This is the likely failure when adding a new package.
- **Each package's `LICENSE` is injected at publish time, not committed.** The publish loop copies the root `LICENSE` into every package dir right before `npm publish`, so the MIT text ships in each tarball (npm auto-bundles a package-root `LICENSE` even with a `files` allowlist). Per-file headers are only short `SPDX-License-Identifier: MIT` tags, so this copy is what carries the actual license text plus the historical Google/Meta notices to consumers. `packages/*/LICENSE` is gitignored — don't commit one, and don't drop the `cp` as cleanup.

**Adding a published package:** add the `repository` field, then register the trusted publisher (the two failure modes above).

**Recovering a partial release:** the publish loop skips already-published versions (npm versions are immutable), so fix the cause, merge, and **re-run at the same version** — don't bump. The version bump is the last step, so a failed release correctly leaves the repo at the version it was finishing.

`prerelease.yaml` is currently inert (not OIDC-wired; the single trusted publisher points at `release.yaml`). Restoring prerelease-on-merge collides with the one-publisher rule — part of the planned publish rework.

The CLI (`malloydata/malloy-cli`) and explorer (`malloydata/malloy-explorer`) publish from their own repos with their own registrations.
