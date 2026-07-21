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
platform. The cross-cutting pin ledger is [`docs/dependency-management/CONTEXT.md`](../../docs/dependency-management/CONTEXT.md);
the Dependabot flow is in [`.github/CONTEXT.md`](../../.github/CONTEXT.md).

## `~/.snowflake/connections.toml` is read with the *driver's* schema, not Snowflake's

`getConnectionOptionsFromToml` spreads that file straight into `snowflake-sdk`, so
its effective schema is the driver's camelCase `ConnectionOptions`, not the
snake_case format Snowflake documents. A `connections.toml` written the way
Snowflake's docs describe — `private_key_file` for key-pair auth — **silently
fails**: the driver discards the unrecognized key, without even a log line
(its unknown-parameter warning is behind `validateDefaultParameters`, off by
default), and authenticates with no key.
Write `privateKeyPath` (absolute; `~` is not expanded) or `privateKey` (PEM text).
Both spellings can coexist in one file if you also need `snow` — each tool warns
and ignores the other's key.

`snowflake-sdk` 2.3.5 fixed this upstream (`normalizeConnectionOptions()`), but our
parser bypasses the driver's loader, so the bump alone won't pick it up.

## Test-harness env vars are named after the Snowflake CLI's

`getConnectionOptionsFromEnv` is not user-facing config — only this package's spec
and `test/src/runtimes.ts` call it. `SNOWFLAKE_ACCOUNT` gates it; unset, callers
fall back to the TOML.

The names match `snow`'s, so a name never means two things:
`SNOWFLAKE_PRIVATE_KEY_RAW` → `privateKey` (PEM text), `..._FILE` → `privateKeyPath`,
`..._PASSPHRASE` → `privateKeyPass`. Do **not** add a bare `SNOWFLAKE_PRIVATE_KEY`;
Snowflake has no such variable, and it sits one underscore from `_FILE`, a path.
