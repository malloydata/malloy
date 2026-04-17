# DuckDB Config Maintenance Notes

This file is the self-contained maintainer handoff for Malloy's native DuckDB
configuration and restricted-execution policy code. A future maintainer should
be able to understand the policy entities, their purpose, and the safe way to
extend them from this file plus the implementation.

Historical design notes may exist elsewhere in the repository, but this file
must not depend on them for essential context.

## Mental Model

Malloy exposes one user-facing policy property for native DuckDB:

- `securityPolicy: "none" | "local" | "sandboxed"`

This field is a Malloy policy control. It is not a raw DuckDB option name
and it is not a general policy language.

The three levels form a strict escalation:

- `"none"` — no security policy applied. Ordinary DuckDB behavior.
- `"local"` — no network access. DuckDB cannot reach the network, but local
  filesystem access is not sandboxed to specific directories.
- `"sandboxed"` — no network access AND filesystem confined to
  `allowedDirectories`. The reviewed strict recipe.

DuckDB's `enable_external_access` is a single toggle that gates both filesystem
reach beyond the working directory and network reach. Setting
`allowed_directories` without disabling `enable_external_access` has no effect.
This is why the policy is a single axis rather than two independent axes — the
underlying DuckDB mechanism does not support independent filesystem and network
control.

The implementation compiles the public policy value into an internal
`NormalizedDuckDBSafetyPolicy`. That internal object records the derived
enforcement requirements, such as locked configuration, no setup SQL,
temp-file encryption, extension restrictions, and secret neutralization. Keep
the public surface small and make new enforcement consequences explicit in the
derived policy object.

Restricted execution is about DuckDB filesystem reach, network reach, mutable
configuration, extension loading, instance sharing, and ambient persistent
secrets. It is not a complete sandbox. It does not provide CPU, memory,
temp-space, query-timeout, or denial-of-service isolation. Hosts that need
resource isolation must configure controls such as `threads`, `memoryLimit`,
process isolation, query cancellation, and host-level quotas separately.

## Code Map

- Native connection schema: `src/native.ts`
  - Registers native DuckDB properties.
  - `securityPolicy` is `requireLiteralString` so invalid reference-shaped or
    non-string values reach registry validation instead of being silently
    dropped by generic config compilation.
- Config compiler literal guard: `../malloy/src/api/foundation/config_compile.ts`
  - Preserves invalid literal-required values as values after warning, allowing
    registry lookup to fail closed before the DuckDB factory runs.
- Normalization and policy derivation: `src/duckdb_config.ts`
  - Parses raw effective config.
  - Derives `NormalizedDuckDBSafetyPolicy`.
  - Applies conflict checks, policy-derived defaults, canonicalization, secret
    directory derivation, and share-key construction.
- Path security helpers: `src/path_security.ts`
  - Canonicalizes paths and performs containment checks.
  - Path handling is part of the security boundary.
- Native lifecycle and baseline setup: `src/duckdb_connection.ts`
  - Normalizes before opening DuckDB.
  - Builds the share key.
  - Opens or reuses a native instance.
  - Applies the final baseline, then optional unrestricted `setupSQL`, then
    `lock_configuration=true` when policy requires it.
- Policy tests:
  - `src/duckdb_config.spec.ts`
  - `src/duckdb_restricted.spec.ts`

## Core Invariants

- Restricted execution must fail closed. Unknown policy values, conflicting
  explicit settings, missing required values, or inability to apply the
  baseline must fail connection creation.
- Policy validation must run early enough that invalid raw values such as
  `true`, `42`, or `{env: "POLICY"}` cannot be silently dropped and interpreted
  as the default `"none"` policy.
- A restricted DuckDB connection must never share a live instance with a less
  restrictive or otherwise semantically different connection.
- The fixed baseline must be established before any Malloy-derived SQL runs.
- Configuration must be locked whenever the derived safety policy requires it.
- Ordinary DuckDB connections must remain ordinary. Do not implicitly turn them
  into locked connections. Mixed Malloy/SQL workflows that rely on later DuckDB
  `SET` statements remain unrestricted workflows.
- `duckdb_wasm` does not receive these native policy guarantees. WASM hardening
  is host-owned unless a separate WASM-specific policy design is implemented.

## User-Facing Policy Behavior

`securityPolicy: "none"` means no security policy is applied. Ordinary DuckDB
behavior.

`securityPolicy: "local"` means Malloy disables network-capable DuckDB
behavior:

- `enableExternalAccess` is forced to `false`.
- `httpfs` must not load.
- DuckDB must not `INSTALL` extensions.
- network-requiring `databasePath` values, including MotherDuck paths, are
  rejected.
- `motherDuckToken` is rejected.
- configuration is locked after baseline setup.
- `setupSQL` is not allowed.
- temp-file encryption is required.
- secrets are neutralized.

`securityPolicy: "sandboxed"` means everything in `"local"`, plus Malloy
derives and enforces a native DuckDB filesystem boundary:

- `allowedDirectories` is required or derived.
- `tempDirectory` is required or derived.
- `workingDirectory`, when present, must be inside `allowedDirectories`.
- `tempDirectory` must be inside `allowedDirectories`.
- Non-POSIX hosts are rejected. Do not approximate Windows path behavior for
  the current policy.

## Registered Config Surface

Native DuckDB supports the existing Malloy-facing properties:

- `databasePath`
- `workingDirectory`
- `motherDuckToken`
- `additionalExtensions`
- `readOnly`
- `setupSQL`

The config extension adds the policy property:

- `securityPolicy`

It also adds curated DuckDB-level properties:

- `allowedDirectories`
- `enableExternalAccess`
- `lockConfiguration`
- `autoloadKnownExtensions`
- `autoinstallKnownExtensions`
- `allowCommunityExtensions`
- `allowUnsignedExtensions`
- `tempFileEncryption`
- `threads`
- `memoryLimit`
- `tempDirectory`
- `extensionDirectory`

`allowedDirectories` is intentionally registered as `json` for now because the
connection property model does not yet have a first-class string-array type.
Even though the registry metadata says `json`, DuckDB normalization must require
the value to be a JSON array of strings. Do not add a registry default for
`allowedDirectories`; its only defaulting behavior belongs to
`securityPolicy: "sandboxed"` normalization.

`workingDirectory` defaults to `{config: "rootDirectory"}` in the native DuckDB
registry. Hosts that know the project root should populate `config.rootDirectory`
so relative DuckDB file paths resolve against the project root rather than the
location of an individual Malloy file or config file. If a sandboxed connection
expected this overlay and it is missing, normalization should fail with an error
that points at `workingDirectory`/`allowedDirectories` and mentions the
`config.rootDirectory` overlay.

`memoryLimit` remains a string because DuckDB accepts values such as `1GB`.

## Normalization Rules

All policy reasoning belongs in `normalizeDuckDBConfig()`.

Policy parsing:

- Missing `securityPolicy` defaults to `"none"`.
- Accepted policy values are exact documented strings only: `"none"`, `"local"`,
  `"sandboxed"`.
- Unknown strings, strings with whitespace or different casing, non-strings,
  and reference-shaped values must fail closed.

Derived safety policy:

- If `securityPolicy` is `"local"` or `"sandboxed"` (i.e., restricted), derive:
  - `requiresLockedConfiguration: true`
  - `requiresNoSetupSQL: true`
  - `requiresTempFileEncryption: true`
  - `requiresSecretNeutralization: true`
  - `forbidAdditionalExtensions: true`
  - `allowHttpfs: false`
  - `enableExternalAccess: false`
  - required baseline extensions `icu` and `json`
  - no extension install or auto-install/autoload expansion
- If `securityPolicy === "sandboxed"`, also derive:
  - POSIX host required
  - sandboxed path validation required
  - derived temp directory name `.tmp`

Conflict checks:

- Reject `setupSQL` whenever a restricted policy requires a locked baseline.
- Reject non-empty `additionalExtensions` whenever a restricted policy forbids
  extension broadening.
- Reject `lockConfiguration: false` under any restricted policy.
- Reject `tempFileEncryption: false` under any restricted policy.
- Under any restricted policy, reject:
  - `enableExternalAccess: true`
  - `autoloadKnownExtensions: true`
  - `autoinstallKnownExtensions: true`
  - `allowCommunityExtensions: true`
  - `allowUnsignedExtensions: true`
  - `motherDuckToken`
  - remote or network-requiring `databasePath`
- Redundant matching values are allowed. For example,
  `securityPolicy: "local"` plus `enableExternalAccess: false` is valid.

Derived defaults:

- Under any restricted policy, force:
  - `enableExternalAccess = false`
  - `lockConfiguration = true`
  - `tempFileEncryption = true`
  - `autoloadKnownExtensions = false`
  - `autoinstallKnownExtensions = false`
  - `allowCommunityExtensions = false`
  - `allowUnsignedExtensions = false`
- Under `securityPolicy: "sandboxed"`:
  - If `allowedDirectories` is omitted, derive it to exactly the canonical
    `workingDirectory`, and nothing broader.
  - If `tempDirectory` is omitted, derive it to `workingDirectory/.tmp`.
  - If Malloy cannot derive the required paths safely, fail closed with a
    field-specific error.
- Outside `securityPolicy: "sandboxed"`, do not invent an
  `allowedDirectories` default.
- With `databasePath: ":memory:"`, normalize `readOnly` to `false`.
  This intentionally preserves existing behavior. A user-facing warning for
  ignored `readOnly: true` is deferred until host warning plumbing has a
  reviewed path for normalized connection options.

Empty text/list handling:

- Empty or whitespace-only `setupSQL` is absent.
- Empty or whitespace-only `motherDuckToken` is absent.
- Empty `additionalExtensions` is absent.

## Path Handling

Canonicalize path-bearing values before validation and before share-key
comparison:

- `databasePath`, except `:memory:` and recognized remote paths
- `workingDirectory`
- `allowedDirectories`
- `tempDirectory`
- `extensionDirectory`

Canonicalization must:

- resolve `.` and `..`
- normalize separators and remove trailing separators
- resolve symlinks when the path or its nearest existing parent exists
- deduplicate and sort list-valued paths before identity comparison

Containment checks must operate only on canonicalized values. Treat path
normalization as security logic, not cosmetic cleanup.

`allowedDirectories` is not read-only. Hosts must assume DuckDB may read and
write inside every allowed directory through features that remain available
inside the boundary, including `COPY TO`, `EXPORT DATABASE`, and attached
writable databases. Do not point `allowedDirectories` at shared writable
locations unless that write surface is acceptable.

## Sharing And Identity

Do not cache native DuckDB instances by `databasePath` alone.

Use the derived share key from `buildDuckDBShareKey()` and include every
effective setting that can affect runtime behavior, safety, or semantics:

- `databasePath`
- `readOnly`
- `securityPolicy`
- `setupSQL`
- canonicalized `allowedDirectories`
- `enableExternalAccess`
- `lockConfiguration`
- `autoloadKnownExtensions`
- `autoinstallKnownExtensions`
- `allowCommunityExtensions`
- `allowUnsignedExtensions`
- `tempFileEncryption`
- `threads`
- `memoryLimit`
- `tempDirectory`
- `workingDirectory`
- normalized `additionalExtensions`
- `extensionDirectory`
- `motherDuckToken`

List-valued inputs must be canonicalized, sorted, and deduplicated so
semantically identical configs share and semantically different configs do not.

Keep the share key separate from `getDigest()`:

- `getDigest()` is about build/result identity.
- the share key is about safe native instance reuse.

This share-key behavior intentionally affects ordinary connections too:
connections with the same `databasePath` but different effective settings
should not share a live instance.

Share keys are sensitive because `motherDuckToken` contributes to them. Use
`makeDigest(...)` and do not log raw share-key inputs.

## Baseline Setup

Prefer open-time DuckDB config through `DuckDBInstance.create(path, options)`
when the option is supported and serializes cleanly. Keep post-connect setup as
small as practical.

The final baseline must happen before Malloy-derived SQL. When locking is
required, `lock_configuration=true` is the final baseline step.

Current baseline mapping:

- `FILE_SEARCH_PATH`
  - set before user SQL when `workingDirectory` exists
  - currently post-connect because open-time behavior is not verified
- `allowed_directories`
  - set before lock when normalized config has `allowedDirectories`
  - currently post-connect because the DuckDB Node API rejects the list-valued
    option during local verification
- `secret_directory`
  - set before lock when restricted secret neutralization derives a directory
  - currently post-connect because open-time behavior is not verified
- `enable_external_access`
  - set at open time when no `allowed_directories` baseline SET is required
  - otherwise set immediately after `allowed_directories`
  - DuckDB rejects changing `allowed_directories` after
    `enable_external_access=false`, so the strict sandboxed recipe has this
    small post-connect ordering constraint until the Node API can apply the
    allowlist at instance creation
- `TimeZone='UTC'`
  - always part of Malloy's fixed correctness baseline
  - not user-configurable
  - must be established before lock
- built-in extension loading
  - preserve ordinary compatibility outside restricted modes
  - under any restricted policy, do not `INSTALL`, do not load `httpfs`,
    and load only the fixed Malloy baseline extensions
- `setupSQL`
  - preserve outside restricted modes
  - reject when a restricted policy requires a locked baseline
  - run only after fixed baseline steps and before optional lock

Do not introduce later Malloy-emitted DuckDB `SET` statements that mutate
configuration after `lock_configuration=true`.

## Extensions

`icu` and `json` are part of the fixed Malloy DuckDB baseline.

`httpfs` is not part of that baseline. It broadens remote/network-capable
behavior and is controlled by `securityPolicy`.

Under any restricted policy (`"local"` or `"sandboxed"`):

- do not load `httpfs`
- do not `INSTALL` extensions
- do not allow `additionalExtensions`
- load only fixed baseline extensions `icu` and `json`
- fail closed if a required baseline extension is unavailable locally

Outside restricted policies, preserve ordinary compatibility unless a
separate product decision changes it.

## Secrets

The full DuckDB secrets product story is deferred. Do not add public
secrets-related config surface as part of restricted-policy maintenance unless
there is a reviewed product design.

Even without a public secrets product, restricted execution must not expose
ambient persistent DuckDB secrets from the host environment or another tenant.

Current interim behavior:

- Any restricted policy derives a private `secretDirectory`.
- If `tempDirectory` exists, derive secrets under
  `tempDirectory/.duckdb-secrets`.
- Otherwise, if `workingDirectory` exists, derive secrets under
  `workingDirectory/.duckdb-secrets`.
- If restricted mode cannot derive a scoped secret directory, fail closed.
- Apply `secret_directory` before lock.

If this behavior changes, update both the safety policy derivation and the
restricted-mode tests.

## WASM Scope

The policy system described here targets native DuckDB.

Do not register the native-only policy field in the `duckdb_wasm` connection
schema in this pass:

- `securityPolicy`
- native-only hardening properties

Do not add native restricted-policy behavior to `DuckDBWASMConnection` as a
side effect of native DuckDB maintenance. WASM runs in a host-provided
JavaScript/WASM environment, where the host controls the virtual filesystem,
browser file APIs, fetch/network reach, OPFS, registered files, remote URL
registration, and credential injection.

If Malloy later wants restricted execution for `duckdb_wasm`, design it
explicitly for WASM instead of copying native policy semantics.

## Adding A New DuckDB Config Property

When adding a new native DuckDB config property, update all relevant layers:

- Register the property in `src/native.ts` with the correct config metadata.
- Parse and validate it in `normalizeDuckDBConfig()`.
- Decide whether it conflicts with `securityPolicy`.
- Decide whether any restricted policy must derive or force a value.
- If it is path-like, canonicalize it before validation and identity
  comparison.
- Include it in `buildDuckDBShareKey()` if it can affect runtime behavior,
  security posture, or semantics.
- Decide whether it belongs in open-time options or final baseline setup.
- Add tests for validation, derived behavior, conflict behavior, and sharing
  identity when relevant.
- Update this file if the property changes the policy model or maintainer
  checklist.

Be conservative: new settings that broaden filesystem, network, extension,
credential, or mutable-configuration behavior should usually be rejected or
forced to a safe value under restricted policies.

## Changing Policy Behavior

When changing `securityPolicy` or `NormalizedDuckDBSafetyPolicy`, review these
together:

- user-facing policy contract
- normalizer parsing and conflict checks
- derived defaults
- path canonicalization and containment rules
- secret neutralization
- open-time options
- final baseline ordering
- extension install/load behavior
- lock timing
- share-key inputs
- native restricted tests
- WASM non-claim boundary
- public documentation

Do not make a policy change only in `DuckDBConnection`. The normalizer should
remain the central place where raw config becomes effective policy and runtime
state.

## Test Expectations

Keep focused tests for:

- `allowedDirectories` accepted as a JSON array of strings
- `allowedDirectories` rejected for non-array or non-string JSON values
- exact policy value parsing
- policy field rejected when provided as non-literal or reference-shaped value
- missing policy-required values failing closed
- conflict checks
- redundant matching explicit values accepted
- sandboxed derived defaults
- `tempDirectory` containment
- network-requiring `databasePath` rejection
- `readOnly: true` with `:memory:` normalizing to `false`
- share keys differing when safety-relevant settings differ
- different `securityPolicy` values producing different share keys
- semantically identical allowlists sharing
- restricted baseline order
- restricted policies not loading `httpfs`
- restricted policies not running `INSTALL`
- required baseline extensions loaded or failing closed
- later config-changing `SET` statements failing after lock
- `closeAllInstances()` clearing all share-keyed native instances
