# .github — CONTEXT.md

CI and release machinery live in `workflows/` — see
[`workflows/CONTEXT.md`](./workflows/CONTEXT.md) for the `pull_request_target`
permission gate and the OIDC publish flow.

This file covers **Dependabot**, and only its `.github`-local mechanics. The full
strategy — how we triage reports, every version we deliberately hold, and why — is in
[`DEPENDENCY-MANAGEMENT.md`](../DEPENDENCY-MANAGEMENT.md).

## Config — `dependabot.yml`

Monthly npm updates, grouped so a bump lands as one reviewable PR: `duckdb`,
`connectors`, `toolchain` majors, `minor-and-patch`, plus a `security` group that
fires on advisory publication and collapses same-run advisories into one PR. The
`ignore:` block is the durable home for every pin — which ones, and why, in
[`DEPENDENCY-MANAGEMENT.md`](../DEPENDENCY-MANAGEMENT.md).

## Alerts vs PRs — two different surfaces

- **Dependabot alerts** (Security → Dependabot alerts): the real backlog and the
  running cost. Config **cannot** hide these. ~80 open, overwhelmingly transitive —
  mostly dev/build tooling (`devDependencies`) that never ships.
- **Pull requests**: the action surface. `open-pull-requests-limit` does **not** cap
  security PRs, so left alone they pile up. We keep the ignore list to things we can
  actually merge.

## Monthly ritual

1. Open the grouped minor/patch PR → "Re-run jobs" to vouch (the gate) → merge.
2. Handle any individual major PRs deliberately.
3. Glance at [`DEPENDENCY-MANAGEMENT.md`](../DEPENDENCY-MANAGEMENT.md): is any
   "Revisit when" now true? has any pin's cost escalated (a new critical behind it)?

Merges to `main` do **not** publish (release is `workflow_dispatch`-only), so cadence
is about review load, not release noise.
