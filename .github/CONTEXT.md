# .github — CONTEXT.md

CI and release machinery live in `workflows/` — see
[`workflows/CONTEXT.md`](./workflows/CONTEXT.md) for the `pull_request_target`
permission gate and the OIDC publish flow. This file covers **Dependabot**.

## Config — `dependabot.yml`

Monthly npm updates. Majors are split out of the grouped minor/patch PR so one
breaking bump can't jam the batch. Three deliberate groups: `duckdb` (a callout —
a duckdb bump has downstream blast radius, so it lands as its own PR), `toolchain`
majors (gts/typescript/eslint/prettier move together or nothing lints), and a
`security` group that collapses same-run advisories into one PR. `@types/node` is
pinned to the runtime Node major (24) with a major-ignore so it stops chasing
Node's odd line.

## Two surfaces — keep them straight

- **Dependabot alerts** (Security → Dependabot alerts): the real backlog and the
  running cost. Config **cannot** hide these. ~80 open, overwhelmingly transitive
  — and the majority are in dev/build tooling (`devDependencies`) that never ships.
- **Pull requests**: the action surface. `open-pull-requests-limit` does **not**
  cap security PRs, so left alone they pile up. We keep this list to things we can
  actually merge.

## Pins — `dependabot-pins.md`

Some advisories stay open because we deliberately hold a dependency back:
Snowflake's exact SDK pin, the renderer's Vega v5, `uuid` at v8. Each decision,
its owner, and what it costs are recorded in
[`dependabot-pins.md`](./dependabot-pins.md), cross-linked from the owning code's
CONTEXT.md (`packages/malloy-db-snowflake`, `packages/malloy-render`). Only `uuid`
also carries an `ignore` here — it was the one emitting an unmergeable PR; the
rest are alert-only and need no suppression.

## Monthly ritual

1. Open the grouped minor/patch PR → "Re-run jobs" to vouch (the gate) → merge.
2. Handle any individual major PRs deliberately.
3. Glance at [`dependabot-pins.md`](./dependabot-pins.md): is any "Revisit when"
   now true? has any pin's cost escalated (a new critical behind it)?

Merges to `main` do **not** publish (release is `workflow_dispatch`-only), so
cadence is about review load, not release noise.
