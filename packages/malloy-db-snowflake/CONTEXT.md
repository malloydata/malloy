# Malloy Snowflake connector — CONTEXT.md

Non-obvious things; the code and `package.json` say the rest.

## `snowflake-sdk` is exact at `3.4.1`, and loaded on first use

`package.json` pins `"snowflake-sdk": "3.4.1"` with **no caret**: Snowflake minors
change runtime behavior that reaches every app embedding Malloy, so each bump is read
and tested on purpose — live Snowflake CI (`db-snowflake.yaml`) plus a Snowflake query
from the bundled VS Code extension and the standalone CLI binary.

`snowflake_executor.ts` loads the SDK with `require()` the first time an executor is
built, not with a top-level import. Loading the SDK starts its telemetry platform
detection, which probes cloud metadata endpoints and calls AWS STS with whatever AWS
credentials the user has; `@malloydata/malloy-connections` imports this package just to
register the type, so a top-level import would run that in every app, Snowflake user or
not. Keep SDK value imports out of every other module here — `import type` is fine.

The apps that bundle Malloy (VS Code extension, malloy-cli) also define
`process.env.SNOWFLAKE_DISABLE_MINICORE` and
`process.env.SNOWFLAKE_DISABLE_PLATFORM_DETECTION` at build time. minicore is a
telemetry-only native binary esbuild can't bundle.

The cross-cutting pin ledger is [`docs/dependency-management/CONTEXT.md`](../../docs/dependency-management/CONTEXT.md);
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
