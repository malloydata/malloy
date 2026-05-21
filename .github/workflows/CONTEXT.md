# GitHub Actions Workflows — AI Guide

This directory holds the CI and release workflows. Most of them (`run-tests.yaml`, the `db-*.yaml` reusable workflows) are ordinary test runners. This guide is about the part with no other documentation and a high obscure-knowledge tax: **how packages get published to npm.**

## Publishing is OIDC trusted publishing, not a token

Releases authenticate to npm with **GitHub Actions OIDC trusted publishing**, not a stored `NPM_TOKEN`. At publish time GitHub mints a short-lived OIDC token, npm verifies it against a per-package registration, and hands back a publish credential. There is no npm secret in this repo, and one should not be reintroduced — if you find yourself adding `NPM_TOKEN` back, something is wrong.

Each published `@malloydata/*` package has a **trusted publisher** registered on npmjs.com, bound to repo `malloydata/malloy` + workflow `release.yaml`. Registration is done from a maintainer's machine, not from CI:

```bash
npm trust github @malloydata/<pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes
```

This needs npm ≥ 11.10 locally (`npm trust` + bulk support) and a logged-in account that owns the package. The repo's pinned node (`.node-version`) ships an older npm; `npm install -g npm@latest` upgrades it for that node version only. CI does its own `npm install -g npm@latest` inside the job for the same reason.

## Rules that bite (none of these are guessable)

- **One trusted publisher per package.** You cannot trust both `release.yaml` and `prerelease.yaml` for the same package — a second registration is rejected with a 409. Pick one. We chose `release.yaml`.
- **Matching is on the top-level caller workflow filename.** If a workflow uses a *reusable* workflow (`workflow_call`) to run `npm publish`, npm checks the **calling** workflow's filename, not the reusable one. Register the file that GitHub triggers.
- **OIDC silently turns on provenance, and provenance hard-requires `repository.url`.** Every published package.json must declare a `repository` field whose URL matches this repo:
  ```json
  "repository": { "type": "git", "url": "https://github.com/malloydata/malloy" }
  ```
  A package missing this fails publish with a `422 ... Error verifying sigstore provenance bundle`. This is the most likely failure when adding a new package, because the rest of the build won't warn you.

## Adding a new published package — checklist

1. Add the `repository` field above to its `package.json`.
2. Register its trusted publisher: `npm trust github @malloydata/<pkg> --file release.yaml --repo malloydata/malloy --allow-publish --yes`.

Miss step 1 and the release fails partway (provenance 422). Miss step 2 and it fails on auth.

## The release workflow (`release.yaml`)

`workflow_dispatch` only. Two jobs:

- **`precheck`** — runs `npm run precheck` (dialect-agnostic tests + duckdb). This is the gate; the publish job depends on it, so the privileged publish job only starts once tests are green.
- **`npm-release`** — builds, publishes each workspace package via OIDC, creates the GitHub Release, then bumps the version (`lerna version patch`) and pushes the `Version x-dev` commit to `main`.

The release gate is deliberately **not** the full dialect matrix. Dialect-specific suites (bigquery, snowflake, postgres, trino, mysql, …) are required checks to *merge to main*, so a regression can't reach main unnoticed; the release just doesn't re-verify them. (See the publish-workflow rework issue for the longer-term plan around this and a merge queue.)

## Recovering from a partial release

The publish loop is idempotent by version: it runs `npm view "$PKG@$VERSION"` and **skips** anything already published. npm versions are immutable, so this is the recovery mechanism — **do not bump the version to recover**.

If a release dies mid-publish (e.g. one package's provenance fails):

1. Fix the cause (usually a missing `repository` field), merge it.
2. Re-run `release.yaml` at the **same** version. Already-published packages are skipped; the missing ones publish; then the version bump runs.

The version bump is the *last* step, so a failed release leaves the repo at the version it was publishing — which is exactly the precondition for finishing it. A repo stuck at a half-published version is normal and recoverable, not broken.

## prerelease.yaml

Currently **inert** — `workflow_dispatch` only and not wired for OIDC (all packages' single trusted publisher points at `release.yaml`). At one point it published a prerelease on every merge to `main`. Restoring that collides with the one-publisher-per-package rule, so it's part of the planned publish-workflow rework, not a flip-the-trigger change.

## Other repos

The CLI (`malloydata/malloy-cli`, `@malloydata/cli`) and explorer (`malloydata/malloy-explorer`, `@malloydata/malloy-explorer`) publish from their own repos and have their own trusted-publisher registrations against their own workflow files. They are not published from here.
