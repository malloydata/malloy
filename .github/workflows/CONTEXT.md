# GitHub Actions Workflows — AI Guide

CI and release machinery. Read the YAML for mechanics; this covers what's *not* visible there — the structure, the security model, and the publishing rules that bite.

Dependabot (config, the alerts-vs-PRs distinction, and the deliberate-pin ledger) is documented one level up in [`../CONTEXT.md`](../CONTEXT.md) and [`docs/dependency-management/CONTEXT.md`](../../docs/dependency-management/CONTEXT.md).

## CI

`run-tests.yaml` is the entry point (runs on PRs and pushes to `main`). It first runs a `pull_and_build` job that does `npm ci` + `npm run build` + `npm run build-duckdb-db` once, tars the workspace (excluding `.git`) with zstd, and uploads it as an artifact. Every downstream test job `needs: pull_and_build`, downloads the artifact, and runs only its dialect-specific setup + `npm run ci-<dialect>` — no per-job rebuild. Fan-out goes to reusable workflows — `main.yaml` (two jobs: `main` runs the dialect-agnostic `ci-core`; `lint` runs `lint` and the `scripts/ci-*-sanity-check.sh` guards) and one `db-<dialect>.yaml` per dialect — then a `malloy-tests` rollup job that `needs:` them all. `db-motherduck.yaml` is commented out of CI. The `main` job keeps that name because branch protection requires the check `main / main`.

`scripts/ci-test-sanity-check.sh` (run by the `lint` job) fails if any `*.spec.ts(x)` isn't wired into a `jest.config.ts` project — so no test can be silently absent from CI.

Wall clock is `pull_and_build` plus the slowest dialect job, and the dialect jobs are bound by warehouse round-trip latency (≈1 query per test), not CPU — which is why `ci-bigquery` and `ci-snowflake` run more jest workers than the runner has cores (measured: about 2× faster at 8; databricks got *slower* at 8 because its warehouse queues, and the trino/presto containers are CPU-bound on the runner, so those stay at the default), and why `ci-core` runs in parallel (the duckdb test connection is read-only; the writers use `:memory:`).

### The design: why external-PR CI is shaped this way — do not break this

The whole shape follows from one platform constraint. Malloy's dialect tests need live
warehouse credentials (BigQuery, Snowflake, Databricks, and the BigQuery-backed
Trino/Presto containers). **There is exactly one trigger under which a pull request from a
fork can reach a repository secret, and it is `pull_request_target`.**

| trigger | PR from | workflow file taken from | secrets | `GITHUB_TOKEN` | GitHub's fork-approval gate |
|---|---|---|---|---|---|
| `pull_request` | branch in this repo | PR head | yes | per `permissions:` | no |
| `pull_request` | **fork** | PR head | **none — `${{ secrets.X }}` is empty** | **write downgraded to read** | **yes** |
| `pull_request_target` | branch in this repo | base | yes | per `permissions:` | no |
| `pull_request_target` | **fork** | **base** | **yes** | per `permissions:`, base-repo scoped | **no** |

That bottom row is the entire security problem and the entire reason the rest exists. It is
not a preference: on `pull_request` from a fork, secrets are unavailable as a platform
guarantee, with no setting that turns them on. (The token downgrade in that row is a
weaker promise than the secret one — an org-level "send write tokens to workflows from
pull requests" setting can lift it. The secrets guarantee has no such escape hatch.) So a
maintainer clicking GitHub's built-in
"Approve and run" still produces a run whose database tests fail for want of credentials —
which is what happened, and was reverted, in PR #2078.

`pull_request_target` buys the secrets and costs two things. The workflow comes from the
**base** branch (good: a fork cannot rewrite the CI definition), but it runs **fork code**
on a runner holding production credentials, and it is **exempt from GitHub's fork-approval
gate**. That exemption is why **`check-permission`** exists (`malloydata/check-ci-permissions`,
design: PR #2087) — it is a hand-built replacement for a control the platform declines to
apply to this trigger. Note the repo's fork-approval policy is set to
`all_external_contributors`, the strictest available; it is simply inert here.

**How the gate actually behaves.** `check-permission` does not pause for approval — it
*fails* unless `github.triggering_actor` has write access, and failing skips every job that
`needs:` it. The maintainer action is pressing **"Re-run failed jobs"** in the Actions UI,
which starts a run whose triggering actor is the maintainer. Consequences worth knowing:

- The vouch is "who pressed the button", not "what was reviewed". **Review the diff —
  especially workflow and build-script changes — before re-running.**
- A re-run replays the **original event payload**, so the head SHA is fixed; a re-run cannot
  pick up newer commits. The vouch is pinned to a commit.
- A new push creates a **new, unvouched run** rather than un-vouching the old one. The
  hazard is clicking the newest run in the list, which may be a commit you did not read.
  (A Dependabot rebase does this silently — see the alerts section in [`../CONTEXT.md`](../CONTEXT.md).)
- If `pull_and_build`'s artifact is still alive (`retention-days: 1`), "Re-run failed jobs"
  reuses it rather than rebuilding.

**The invariant to preserve: a job may run before the gate if and only if no secrets are
passed to it.** Stated the old way — every secret-bearing job MUST `needs: check-permission`
(today: `db-trino`, `db-presto`, `db-bigquery`, `db-snowflake`, `db-databricks`) — but the
inverted form is the one that generalizes, and it is checkable by reading one file. What an
external PR can do before the gate is then describable without auditing a single test
script: spend runner compute and network egress. Nothing else.

**Every job holds two credentials, and you only chose one.** The secrets you pass, and the
`GITHUB_TOKEN` GitHub injects whether you asked or not. Under `pull_request_target` that
token is scoped to **this** repo, so fork code could use it to push to `main` if it had any
power. `permissions: {}` on `run-tests.yaml` and on every reusable workflow sets it to
none — a called workflow can lower its caller's ceiling but never raise it. **This
discipline is load-bearing, not decorative: the repo's `default_workflow_permissions` is
`write`, so a workflow that simply omits `permissions:` gets a write token.**

**`main` is deliberately pre-gate.** It carries no secrets, so external contributors get
lint and the ~3000 dialect-agnostic tests immediately, without waiting for a maintainer —
that is the point, and it is most of the value external PR CI provides. It stays that way
only while `ci-core` is pinned: the script sets `MALLOY_DATABASES=duckdb,postgres` so specs
cannot fall back to the default database lists hardcoded in their own source. Unpinned,
`ci-core` is the **only** `ci-*` script that lets such a default select a credentialed
warehouse — which is exactly how `main` came to require `BIGQUERY_KEY` for a single spec
file. Both halves matter and catch different mistakes: the pin neutralizes the
env-driven route, and the absent credential catches a hardcoded one (a literal
`bigquery.table(...)` in a core spec), which fails loudly rather than quietly spending a
key, because the harness treats an unreachable connection as an error and not a skip. That
tripwire assumes the runner carries no ambient cloud credential — true for GitHub-hosted
runners, and something that would silently void on self-hosted runners with an attached
service account.

### The security stance on pull_and_build, stated honestly

`pull_and_build` runs `npm ci` on PR-head code and uploads the result as an artifact that every downstream dialect job (including secret-bearing ones) consumes. CodeQL flags this — `actions/cache-poisoning/poisonable-step` and `actions/untrusted-checkout/critical` — and is technically correct: the artifact contains attacker-influenceable output. **The repo's policy is to dismiss those alerts**, on the same reasoning as the prior dismissals already on file for similar shapes in this repo.

The dismissal stands because the threat model is no different from the per-job-rebuild design that existed before `pull_and_build`. Whether `npm ci` runs once centrally or eleven times in each dialect job, the same PR-head code ends up executed alongside secrets when (and only when) `check-permission` lets the secret-bearing jobs run. The runtime gate is the actual mitigation; CodeQL cannot see runtime gates and so over-reports.

`pull_and_build` itself runs with no repo secrets declared and `permissions: {}` denying the GITHUB_TOKEN any write access. That prevents the dumbest exfiltration ("print env in postinstall") but it does not meaningfully shrink the attack surface — a malicious postinstall can modify `node_modules`/`dist`, the modified output gets tarred up, downloaded by every secret-bearing job, and executed during `npm test` with the dialect's credentials available (some are env vars, others are written to disk by auth actions like `google-github-actions/auth`). The protection is the runtime gate. Don't read more into the centralization than that.

**When dismissing an alert on this:** reference this section and the prior dismissals. Edits that change the structural shape of `pull_and_build` (new upload, different checkout target, added trigger) will re-fire the alert — that is the *desired* behavior; it forces a re-read of this stance before the shared-artifact pattern changes shape.

The artifact pattern saves compute (one build instead of ~11 parallel rebuilds, ~30 runner-minutes per PR run) rather than wall-clock time — the parallel rebuilds shared the critical path, so wall-clock is similar. It's a stewardship-of-free-resources choice, not a CI-speed choice.

### Caches cross runs; the artifact does not

The artifact lives and dies inside one run, so the runtime gate bounds what it can reach. An Actions cache is restored by *later* runs — including runs on `main` with every secret — so a cache written by PR code is a way for that code to outlive the gate. Two rules keep this closed, and any new cache must satisfy one of them:

- **Content the consumer verifies.** `pull_and_build` uses `setup-node`'s `cache: npm`, which holds npm's tarball store; `npm ci` checks every tarball against the lockfile's integrity hash, so a poisoned entry cannot be installed.
- **Written only by `push` to `main`.** `db-presto.yaml` caches the built slim presto image (`docker save`/`load`), because building it pulls the 9 GB official image — measured anywhere from 40 s to 4 minutes, at Docker Hub's mercy. The save steps are conditioned on `github.event_name == 'push'`; PR runs only restore. A PR that changes `Dockerfile.slim` or `presto_start.sh` gets a cache miss (they're in the key) and rebuilds, as before.

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
