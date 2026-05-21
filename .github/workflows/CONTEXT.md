# GitHub Actions Workflows — AI Guide

CI and release machinery. Read the YAML for mechanics; this covers what's *not* visible there — the structure, the security model, and the publishing rules that bite.

## CI

`run-tests.yaml` is the entry point (runs on PRs and pushes to `main`). It fans out to reusable workflows — `main.yaml` (dialect-agnostic `ci-core`, plus `lint` and the `scripts/ci-*-sanity-check.sh` guards) and one `db-<dialect>.yaml` per dialect — then a `malloy-tests` rollup job that `needs:` them all. Each `db-<dialect>.yaml` runs `npm run ci-<dialect>`, the same script you run locally. `db-motherduck.yaml` is commented out of CI.

`scripts/ci-test-sanity-check.sh` (run by `main.yaml`) fails if any `*.spec.ts(x)` isn't wired into a `jest.config.ts` project — so no test can be silently absent from CI.

### Safely accepting external PRs — do not break this

`run-tests.yaml` triggers on **`pull_request_target`**, so it runs with the repo's secrets *and* checks out the PR's head code — arbitrary code from any author running on a runner that holds production credentials. This is a known privilege-escalation footgun; the **`check-permission`** job (`malloydata/check-ci-permissions`) contains it, failing the run unless **`github.triggering_actor`** has write access (design: PR #2087).

- **Every secret-bearing job MUST `needs: check-permission`** (today: `main`, `db-trino`, `db-presto`, `db-bigquery`, `db-snowflake`, `db-databricks`). Secret-free jobs deliberately don't. Adding a secret to an ungated job leaks it to external-PR code.
- The gate trusts the *triggering actor*, not the PR author — so **re-running a fork PR's CI authorizes its code to run with full secrets.** Review the diff (especially workflow/build-script changes) before re-running.

Contributor-facing side (DCO sign-off, licensing, review) is in [CONTRIBUTING.md](../../CONTRIBUTING.md). Adding a dialect: [adding-a-new-database.md](../../packages/malloy/src/doc/adding-a-new-database.md).

## Publishing (`release.yaml`)

Publishing uses **GitHub Actions OIDC trusted publishing**, not a stored `NPM_TOKEN` — there is no npm secret in this repo and one should not be added back. Each `@malloydata/*` package has a trusted publisher registered on npmjs.com bound to `malloydata/malloy` + `release.yaml`, set from a maintainer's machine (`npm trust github <pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes`, needs npm ≥ 11.10).

`release.yaml` is `workflow_dispatch`-only: a `precheck` job (`npm run precheck`) gates the `npm-release` job, which publishes every workspace package, cuts the GitHub Release, then bumps the version. The gate is intentionally just precheck, not the full dialect matrix — those are required checks to *merge*, so they aren't re-verified at release.

**Rules that bite (not guessable):**

- **One trusted publisher per package** — can't trust both `release.yaml` and `prerelease.yaml`; a second registration 409s.
- **Matching is on the top-level caller workflow filename**, not a reusable workflow it calls.
- **OIDC auto-enables provenance, which requires `repository.url`** in each published package.json (`{ "type": "git", "url": "https://github.com/malloydata/malloy" }`). Missing it → publish fails with a `422 ... provenance` error. This is the likely failure when adding a new package.

**Adding a published package:** add the `repository` field, then register the trusted publisher (the two failure modes above).

**Recovering a partial release:** the publish loop skips already-published versions (npm versions are immutable), so fix the cause, merge, and **re-run at the same version** — don't bump. The version bump is the last step, so a failed release correctly leaves the repo at the version it was finishing.

`prerelease.yaml` is currently inert (not OIDC-wired; the single trusted publisher points at `release.yaml`). Restoring prerelease-on-merge collides with the one-publisher rule — part of the planned publish rework.

The CLI (`malloydata/malloy-cli`) and explorer (`malloydata/malloy-explorer`) publish from their own repos with their own registrations.
