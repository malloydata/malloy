# Malloy Snowflake connector — CONTEXT.md

Non-obvious things; the code and `package.json` say the rest.

## `snowflake-sdk` is pinned exactly at `2.3.1` — deliberate, do not float it

`package.json` pins `"snowflake-sdk": "2.3.1"` with **no caret**. This is
intentional, not a stale lockfile: the SDK pulls platform-specific native bits and
a large transitive tree, and floating it thrashes that native connector chain.
Bumps are made deliberately and verified against the live Snowflake CI env
(`db-snowflake.yaml`), never by a Dependabot range.

**What the pin costs** — visible on Security → Dependabot alerts, never as a
mergeable PR: the held SDK keeps open transitive advisories in `fast-xml-parser`
(including critical/high), `axios`, and `bn.js`. Some of those leaves are *also*
pulled by other connectors (e.g. `fast-xml-parser` via BigQuery's
`@google-cloud/storage`), so bumping Snowflake alone won't zero them — they clear
only when every owner moves.

**Revisit** when doing a deliberate `snowflake-sdk` upgrade: move the exact pin,
run the live Snowflake suite, confirm the native chain still builds on every
platform. The cross-cutting pin ledger is [`.github/dependabot-pins.md`](../../.github/dependabot-pins.md);
the Dependabot flow is in [`.github/CONTEXT.md`](../../.github/CONTEXT.md).
