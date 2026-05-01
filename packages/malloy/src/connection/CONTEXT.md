# Connection System

The connection subsystem provides database backend abstractions, a centralized registry, a JSON config file format, and an API for creating connections from config. Individual backend implementations live in `packages/malloy-db-*/`.

## Key Files

- `types.ts` — `Connection`, `InfoConnection`, `StreamingConnection`, `PersistSQLResults`, `PooledConnection` interfaces
- `base_connection.ts` — Abstract base class with schema caching; all backends extend this
- `registry.ts` — Module-level `Map<string, ConnectionTypeDef>` with register/lookup functions
- `registry.spec.ts` — Registry tests

## Architecture

### Self-Registration Pattern

Each `@malloydata/db-*` package registers itself as a **side effect** of being imported:

```typescript
// In packages/malloy-db-duckdb/src/index.ts
import {registerConnectionType} from '@malloydata/malloy';
registerConnectionType('duckdb', { displayName: 'DuckDB', factory: async ..., properties: [...] });
```

Registered backends: `duckdb`, `bigquery`, `postgres`, `snowflake`, `trino`, `presto`, `mysql`, `publisher`

The convenience package `@malloydata/malloy-connections` (`packages/malloy-connections/`) imports all 6 database db-\* packages for side-effect registration (not publisher).

### ConnectionTypeDef

Each registered backend provides:
- **displayName**: human-readable label (e.g. `"PostgreSQL"`, `"DuckDB"`)
- **factory**: `async (config: ConnectionConfig) => Promise<Connection>` — creates a connection from config
- **properties**: `ConnectionPropertyDefinition[]` — machine-readable schema for config fields

### Lazy Connection Creation

`createConnectionsFromConfig()` returns a `LookupConnection<Connection>` that calls factories on first lookup, then caches. The first connection listed in the config is the default.

## Config File Format (`malloy-config.json`)

```json
{
  "connections": {
    "mydb": {
      "is": "duckdb",
      "databasePath": "/path/to/data.db"
    },
    "warehouse": {
      "is": "bigquery",
      "projectId": {"env": "GCP_PROJECT_ID"}
    }
  }
}
```

The `is` field identifies the backend. Any non-`json` property value can be a reference-shaped object — a single-key dict whose value is a string or string[], e.g. `{env: "VAR"}` or `{config: "rootDirectory"}` or `{session: ["credentials", "token"]}`. References are resolved by `MalloyConfig` against a **`ConfigOverlays` dict** at **`lookupConnection()` time** (not at construction), so the registry and connection factories still only ever see plain resolved values. Overlays may be sync or async (`(path) => unknown | Promise<unknown>`); deferring resolution to lookup gives async overlays a natural seam. If a reference fails to resolve (unknown overlay source, or overlay returns undefined), the property is silently dropped — the factory sees the field as absent. Unknown-overlay-source warnings land on `config.log` when the affected connection is looked up.

Properties declared as `type: 'json'` are never interpreted as references — the entire value passes through literally. This is the security invariant that keeps structured config (SSL options, headers, session objects) from ever invoking overlay lookups.

See `packages/malloy/src/api/foundation/config_overlays.ts` for the `ConfigOverlays` type and the built-in `env` + `config` overlays.

## API Functions

### Public (exported from `@malloydata/malloy`)

| Function | Purpose |
|----------|---------|
| `registerConnectionType(name, def)` | Register a backend (called by db-* packages on import) |
| `getRegisteredConnectionTypes()` | Returns all registered backend names |
| `getConnectionTypeDisplayName(typeName)` | Returns human-readable display name |
| `getConnectionProperties(typeName)` | Returns `ConnectionPropertyDefinition[]` for a backend |

### Internal (used by `MalloyConfig`, not re-exported)

| Function | Purpose |
|----------|---------|
| `readConnectionsConfig(jsonText)` | Parse JSON config string, validate `is` fields |
| `writeConnectionsConfig(config)` | Serialize config to JSON (2-space indent) |
| `createConnectionsFromConfig(config)` | Returns `LookupConnection<Connection>` with lazy creation + caching. Assumes entries are already fully resolved — used by hosts that have their own resolution path. `MalloyConfig` does **not** use this; it builds its own managed lookup in `api/foundation/config_lookup.ts` that performs per-lookup async reference resolution. |
| `getConnectionTypeDef(typeName)` | Returns the full `ConnectionTypeDef` (factory + properties + displayName). Used by the foundation layer's managed lookup to hand resolved configs to the right factory. |

### Usage Pattern

The standard way to get connections is through `MalloyConfig`. The constructor takes either a JSON config string or a pre-loaded POJO. For local hosts that want to walk up the filesystem looking for `malloy-config.json`, use `discoverConfig()` from `@malloydata/malloy` — it returns a fully-constructed `MalloyConfig` with the `config` overlay already wired:

```typescript
import '@malloydata/malloy-connections';  // registers all backends
import {Runtime, MalloyConfig, discoverConfig} from '@malloydata/malloy';

// Discover and build the config (browser-safe via URLReader).
const config = await discoverConfig(startURL, ceilingURL, urlReader);
if (!config) throw new Error('No malloy-config.json found');

// Or from a JSON string (sync, no discovery, no overlays):
// const config = new MalloyConfig(configJsonText);

const runtime = new Runtime({config, urlReader});
```

`Runtime` pulls `connections` off the config and lazily reads any build manifest from `config.manifestURL` on first persistence query. `MalloyConfig` construction is synchronous and does no overlay IO: it compiles the input into a typed tree, extracts the non-connection sections, and packages the compiled connection subtrees into a managed `LookupConnection`. The overlay references inside those subtrees stay un-resolved until `lookupConnection()` is called, at which point the walker `await`s each overlay, applies property defaults (including reference-shaped ones like DuckDB's `workingDirectory: {default: {config: 'rootDirectory'}}`), and hands the resulting plain POJO to the registered factory. The resolved `Connection` is cached by name. The `connections` getter returns the same `LookupConnection` object across calls. Hosts that want to decorate the lookup (layering settings, session-specific behavior, fallbacks) use `config.wrapConnections(base => wrapped)` which replaces the cached lookup in place.

## Property Type System

Each `ConnectionPropertyDefinition` has a `type` field that determines UI rendering:

| Type | UI Control |
|------|-----------|
| `string` | Text input |
| `number` | Number input |
| `boolean` | Checkbox |
| `password` | Masked input (credentials/passphrases) |
| `secret` | Masked input (tokens/API keys) |
| `file` | File picker with optional `fileFilters` |
| `json` | JSON object (structured config like SSL options, headers) |
| `text` | Multi-line text input |

## Cross-Repo: User-Facing Docs

The user-facing list of connection types and their parameters lives in a
separate repository: [`malloydata/malloydata.github.io`](https://github.com/malloydata/malloydata.github.io)
at `src/documentation/setup/config.malloynb`. When you add, remove, or rename
a registered property — or change its semantics — open a companion PR there
so the docs site stays in sync. Add to the PR checklist:

- [ ] Updated `malloydata.github.io/src/documentation/setup/config.malloynb`
      if any registered connection property changed.

## Per-Backend Properties

**DuckDB** (`displayName: "DuckDB"`):
`databasePath` (file), `workingDirectory` (string), `motherDuckToken` (secret), `additionalExtensions` (string — comma-separated, factory parses to array), `readOnly` (boolean), `setupSQL` (text, advanced). The remaining properties — `securityPolicy`, `allowedDirectories`, `enableExternalAccess`, `lockConfiguration`, `autoloadKnownExtensions`, `autoinstallKnownExtensions`, `allowCommunityExtensions`, `allowUnsignedExtensions`, `tempFileEncryption`, `threads`, `memoryLimit`, `tempDirectory`, `extensionDirectory` — are all `advanced: true` (security policy, extension policy, and resource tuning).

**BigQuery** (`displayName: "BigQuery"`):
`projectId` (string), `serviceAccountKeyPath` (file), `location` (string), `maximumBytesBilled` (string, advanced), `timeoutMs` (string, advanced), `billingProjectId` (string, advanced), `setupSQL` (text, advanced)

**PostgreSQL** (`displayName: "PostgreSQL"`):
`host` (string), `port` (number), `username` (string), `password` (password), `databaseName` (string), `connectionString` (string, advanced), `setupSQL` (text, advanced)

**Snowflake** (`displayName: "Snowflake"`):
`account` (string, required), `username` (string), `password` (password), `role` (string), `warehouse` (string), `database` (string), `schema` (string), `privateKeyPath` (file), `privateKeyPass` (password), `timeoutMs` (number, advanced), `schemaSampleTimeoutMs` (number, advanced), `schemaSampleRowLimit` (number, advanced), `schemaSampleFullScanMaxBytes` (number, advanced), `setupSQL` (text, advanced), `poolMin` (number, advanced), `poolMax` (number, advanced), `poolTestOnBorrow` (boolean, advanced)
Factory extracts `name`, `setupSQL`, `timeoutMs`, and the three pool fields; passes remaining properties as snowflake-sdk `ConnectionOptions`. The pool fields are assembled into a `generic-pool` options object via `buildPoolOptions()` and shallow-merged with `SnowflakeExecutor.defaultPoolOptions_` (`{min: 1, max: 1, testOnBorrow: true, testOnReturn: true}`); omitting all three preserves the defaults.

**Trino** (`displayName: "Trino"`):
`server` (string), `port` (number), `catalog` (string), `schema` (string), `user` (string), `password` (password), `setupSQL` (text, advanced), `source` (string, advanced), `ssl` (json, advanced), `session` (json, advanced), `extraCredential` (json, advanced), `extraHeaders` (json, advanced)
The json-typed properties pass through to `trino-client`'s `ConnectionOptions` via `extraConfig`.

**Presto** (`displayName: "Presto"`):
`server` (string), `port` (number), `catalog` (string), `schema` (string), `user` (string), `password` (password), `setupSQL` (text, advanced)

**MySQL** (`displayName: "MySQL"`):
`host` (string), `port` (number), `database` (string), `user` (string), `password` (password), `setupSQL` (text, advanced)

**Publisher** (`displayName: "Malloy Publisher"`):
`connectionUri` (string, required), `accessToken` (secret)

All backends support `setupSQL` (text) — SQL statements run when the connection is first established.

## Key Types

```typescript
type JsonConfigValue = string | number | boolean | null | JsonConfigValue[] | {[key: string]: JsonConfigValue};

interface ConnectionPropertyDefinition {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'password' | 'secret' | 'file' | 'json' | 'text';
  optional?: true;
  // Advisory hint to editors: this property is not part of typical
  // configuration and may be hidden, folded under an "advanced" toggle, or
  // ignored entirely. Has no effect on the registry or factory.
  advanced?: boolean;
  // Literal default, or a single-key reference-shaped object that the
  // MalloyConfig resolver expands against the config overlays
  // (e.g. {config: 'rootDirectory'}).
  //
  // Defaults apply uniformly: every connection entry that doesn't specify
  // the property gets the default, whether it was user-listed or fabricated
  // by `includeDefaultConnections: true`. A user who writes
  // `{duckdb: {is: 'duckdb'}}` still picks up `workingDirectory` from its
  // default. Reference-shaped defaults that fail to resolve (unknown overlay
  // source, or the overlay returns undefined) are silently dropped — a
  // default is a hint, not a requirement.
  default?:
    | string
    | number
    | boolean
    | {[source: string]: string | string[]};
  description?: string;
  fileFilters?: Record<string, string[]>;
}

interface ConnectionTypeDef {
  displayName: string;
  factory: ConnectionTypeFactory;
  properties: ConnectionPropertyDefinition[];
}
```

## Implementing a Connection Backend

For a complete end-to-end guide to adding a new database (Dialect + Connection + tests + CI), see [adding-a-new-database.md](../doc/adding-a-new-database.md). The sections below document the Connection interface in detail.

### Interface Hierarchy

```
InfoConnection          — Schema reading only (name, dialectName, getDigest, fetchSchema*)
  └─ Connection         — Adds runSQL(), close(), estimateQueryCost(), type guards
       ├─ StreamingConnection  — Adds runSQLStream() (AsyncIterableIterator<QueryRecord>)
       ├─ PersistSQLResults    — Adds manifestTemporaryTable(sql) → temp table name
       └─ PooledConnection     — Adds drain() for releasing pool resources
```

All backends extend `BaseConnection`, which implements `Connection` and provides schema caching. Optional interfaces (`StreamingConnection`, `PersistSQLResults`, `PooledConnection`) are mixed in by backends that support them.

### What You Must Implement

Extend `BaseConnection` and implement these abstract members:

```typescript
abstract name: string;                    // Connection name from config
abstract dialectName: string;             // e.g. 'postgres', 'duckdb'
abstract getDigest(): string;             // Deterministic hash (see Digest section)
abstract runSQL(sql: string, options?: RunSQLOptions): Promise<MalloyQueryData>;
abstract fetchTableSchema(tableName: string, tablePath: string): Promise<TableSourceDef | string>;
abstract fetchSelectSchema(sqlSource: SQLSourceRequest): Promise<SQLSourceDef | string>;
```

BaseConnection provides default no-op implementations for: `close()`, `idle()`, `estimateQueryCost()`, `fetchMetadata()`, `fetchTableMetadata()`. The type guards `isPool()`, `canPersist()`, `canStream()` all default to `false`.

### Connection Lifecycle: `close` vs `idle`

`Connection` exposes two release methods with different post-conditions. Backends can override both, just `close()`, or neither.

| Method | Post-condition | Use case |
|---|---|---|
| `close()` | Connection is destroyed. Subsequent operations may fail. | Real shutdown: process exit, extension deactivate, config-file change. |
| `idle()` | Connection is logically valid; backend resources released. Schema cache and other in-process state survive. Next operation transparently reattaches. | Per-operation pause in long-lived hosts (VS Code, MCP servers) so other writers can claim resources during idle gaps. |

The default `idle()` is a no-op for backends that hold no release-able resources between operations. Override when your backend holds something the host might want to release temporarily — most commonly an OS-level file lock (DuckDB) or a persistent socket pool.

When implementing `idle()`:
- Don't eagerly reattach inside `idle()` itself — that defeats the purpose. Mark internal state for "needs reattach" and let the next `runSQL()` / schema fetch trigger init lazily.
- Make sure `setupSQL` and any other init-time work replays cleanly on reattach. The schema cache in `BaseConnection.schemaCache` survives across an idle/reattach cycle (cache keys are content-addressable: `tablePath`, `sqlKey(connection.name, selectStr)`), so don't redundantly invalidate it.
- Hosts that share a connection across concurrent operations should not call `idle()` while an operation is in flight. The current implementations don't refcount in-flight operations.

### Schema Caching (BaseConnection)

BaseConnection wraps `fetchTableSchema()` and `fetchSelectSchema()` with a per-instance cache (`protected schemaCache`). Your implementations are the uncached inner methods — BaseConnection handles cache lookup, storage, and invalidation.

**Key behaviors:**
- **Successes are cached.** Same table/SQL block won't hit the database again.
- **Errors are NOT cached.** If your method returns a string (error), it passes through to the caller but is not stored. The next request for the same schema will re-fetch.
- **Cache refresh:** A `refreshTimestamp` parameter triggers re-fetch if newer than the cached entry's timestamp. Used when the user explicitly requests schema refresh.
- **Type checking:** Cache validates that the stored schema type matches the request type (table vs sql_select). Mismatches return an error, not stale data.

### Error Convention: Return Strings, Don't Throw

`fetchTableSchema()` and `fetchSelectSchema()` return `StructDef | string`. Return a **string** for expected errors (table not found, invalid SQL, permission denied). BaseConnection wraps it into `{error: string}`. If you throw instead, BaseConnection catches it and uses `.message`, but returning strings is the convention.

### Async Initialization Pattern

You cannot `await` in a constructor. All backends solve this the same way:

```typescript
class MyConnection extends BaseConnection {
  private connecting: Promise<void>;

  constructor(config: ...) {
    super();
    this.connecting = this.init();  // Start async work immediately
  }

  private async init(): Promise<void> {
    // Create client, load extensions, run setupSQL, etc.
  }

  async runSQL(sql: string): Promise<MalloyQueryData> {
    await this.connecting;  // Ensure init is done before first use
    // ... execute query ...
  }
}
```

Store the init promise in the constructor, await it in every public method. Guard against double-init if multiple calls arrive concurrently.

### setupSQL Lifecycle

All backends support `setupSQL` but execute it differently:

| Pattern | Used by | Behavior |
|---------|---------|----------|
| **Run once at init** | DuckDB | Splits on `;\n`, executes each statement during `init()`. All subsequent queries see the effects. |
| **Prepend to every query** | BigQuery | Concatenates setupSQL before each query in the same job. Runs every time. |
| **Run per client** | Postgres (non-pooled) | Runs before every query since each query gets a fresh client. |
| **Run on pool acquire** | Postgres (pooled) | Runs via `pool.on('acquire')` event — each client from the pool gets setup when checked out. |

All backends include setupSQL in `getDigest()` since it can change query behavior.

### Schema Fetching

Schema fetching is always read-only — never create tables or modify state:

| Backend | Table schema | SQL block schema |
|---------|-------------|-----------------|
| DuckDB | `DESCRIBE SELECT * FROM (...)` | Same, wrapping the SQL |
| Postgres | `SELECT ... LIMIT 0` + `pg_type` catalog queries | Same pattern |
| BigQuery | `createQueryJob(..., dryRun: true)` | Same, dry-run mode |

After getting raw database types, map them to Malloy types via `dialect.sqlTypeToMalloyType()`. Handle compound types (arrays, records, nested structures) per your database's conventions.

### Optional Capabilities

**Streaming** (`canStream()` → `StreamingConnection`):
- Implement `runSQLStream()` returning `AsyncIterableIterator<QueryRecord>`
- Must respect `rowLimit` and `abortSignal` from options
- Clean up resources (close streams, release connections) on abort or completion

**Persistence** (`canPersist()` → `PersistSQLResults`):
- Implement `manifestTemporaryTable(sql)` → returns temp table name
- Convention: `CREATE TEMPORARY TABLE IF NOT EXISTS tt${hash} AS (${sql})`
- Hash derived from SQL via `makeDigest()` for deterministic naming
- BigQuery caches temp table names by SQL hash to avoid re-running identical queries

**Pooling** (`isPool()` → `PooledConnection`):
- Implement `drain()` to release all pool resources
- Type guard enables safe `if (conn.isPool()) conn.drain()` narrowing
- Only return `true` from `isPool()` if you actually implement `PooledConnection`

### DuckDB Instance Sharing

DuckDB has a unique pattern: a static `activeDBs` map groups connections by database path. Multiple `DuckDBConnection` instances pointing to the same path share one `DuckDBInstance` but each get their own connection handle. The instance is closed only when the last connection to it calls `close()` (or `idle()`). This is not traditional pooling — `isPool()` returns `false`.

`DuckDBConnection.idle()` participates in this scheme: removing the calling connection from the entry's `connections` list, and only closing the underlying `DuckDBInstance` (releasing the OS file lock) when the count hits zero. The connection then nulls out `this.connection` and clears `this.isSetup`; the next call into `setup()` detects the null and runs a fresh `init()`, which rejoins an existing `activeDBs` entry if another connection has since recreated one or creates a new instance.

The per-connection `autoIdle` config flag (default `true`) lets a user opt out of idling — `DuckDBConnection.idle()` is a no-op when `autoIdle` is `false`, and an `autoIdle: false` connection in the `activeDBs` entry will keep the instance alive even when other sharers idle. Forced to `false` for `:memory:` databases (idling them would silently destroy in-memory state).

## Connection Digest (`getDigest()`)

Every connection implements `getDigest(): string` returning a SHA-256 hash of its "data identity." Used to compute **BuildIDs**: `BuildID = hash(connectionDigest, sql)`. The digest includes only things that could cause the same SQL to produce different results (server identity, database/schema, username, setupSQL) and excludes operational settings (billing, timeouts, credentials).

`makeDigest()` in `packages/malloy/src/model/utils.ts` length-prefixes each part to prevent collisions and represents `undefined` distinctly from empty string.
