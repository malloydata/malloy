# Consumer-contract canary

A guard against a specific blind spot: **malloy's own CI tests how *we* run the
code, not how our *consumers* run it.** malloy tests under babel-jest and plain
Node; its downstream apps (the VS Code extension, malloy-cli, and external users)
**bundle with esbuild** and **test with ts-jest**, as CommonJS. When those
environments diverge, malloy's CI can be green while the published artifact is
broken for everyone downstream — caught only at release time, or by users.

This canary closes that gap by consuming the built `@malloydata/*` packages the
way a downstream app does, in malloy's own PR CI.

## What it is

- **`consumer.ts`** — a tiny "app" that imports the published packages through
  their entry points (not source). The side-effect import of
  `@malloydata/malloy-connections` is the point: it registers every dialect and
  drags in the full connector surface (db-postgres → pg → pg-native,
  db-databricks → native kernel, db-duckdb/native, …), even though the smoke query
  only touches DuckDB. It then runs one real query end-to-end.

- **`bundle-check.mjs`** (`npm run canary:bundle`) — esbuild-bundles the consumer
  for node, with the same connector-native externals a real consumer uses
  (`@duckdb/*`, `lz4`, `pg-native`). Catches a **new un-bundleable native or a bare
  `require` of an optional native** — the class that broke malloy-cli on
  `pg-native` and the VS Code extension on the databricks kernel.

- **`consume.spec.ts`** + **`jest.config.ts`** (`npm run canary:jest`) — loads the
  consumer under a **plain ts-jest config with no babel transform**. Catches an
  **ESM-only published runtime dep** — the class that broke the VS Code extension
  on `uuid` v14 / `@noble/hashes` v2.

These two harnesses are deliberately different from the repo's own jest
(`jest.config.ts`, which uses babel-jest + `transformIgnoreModules`). That
transform is exactly why malloy stays green while consumers break, so the canary
must NOT have it.

## When it goes red

A red canary is not a flake — it means the published packages are about to break
downstream:

- **bundle-check fails** → a runtime dep is not bundle-safe (a new native, or a
  bare native require). Externalizing it in the consumer is only a band-aid; the
  fix is upstream — see `DEPENDENCY-MANAGEMENT.md`.
- **canary:jest fails** with "Unexpected token 'export'" / "Cannot use import
  statement outside a module" → a runtime dep went ESM-only. **Do not** add a
  transform here to silence it — pin the dep to its last CJS-consumable major, the
  way `uuid` and `@noble/hashes` are pinned (`DEPENDENCY-MANAGEMENT.md`).

## Wiring

Run it locally with **`npm run test-canary`** — it builds first (the canary
consumes the built `dist/`, unlike the source-based test suites), then runs both
checks. `npm run canary` runs the two checks against an already-built workspace
(`canary:bundle` / `canary:jest` run them individually).

In CI it's the `consumer-canary` job in `.github/workflows/run-tests.yaml`
(reusable workflow `consumer-canary.yaml`), which runs `npm run canary` against the
same built-workspace artifact as the dialect jobs — no secrets, no database.
