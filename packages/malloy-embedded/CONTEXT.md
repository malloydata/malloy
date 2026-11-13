# malloy-embedded

Builds the Malloy translator and compiler into one self-contained script,
`dist/malloy-embedded.js`, for hosts that run JavaScript in an embedded engine
rather than in Node or a browser. The motivating host is a DuckDB extension
that accepts Malloy in place of SQL, running the bundle in QuickJS; nothing
here is specific to DuckDB or QuickJS.

The package is `private`: the bundle is a build output for other projects to
pick up, not an npm package.

## What the bundle is

- A classic script (an IIFE), not a module, so an engine can evaluate it with
  no module loader. Evaluating it sets `globalThis.malloyEmbedded`.
- ES2020, minified, about 2.2 MB, with an external source map.
- `platform: 'neutral'`: it may not reach for Node built-ins or the DOM. An
  import that resolves to one fails the build, which is the guard against
  the compiler growing a dependency an embedded engine cannot satisfy.

## The interface

`malloyEmbedded` has `version` and six functions:
`compileModel`, `compileModelContents`, `compileModelCatalog`,
`compileSource`, `compileQuery`, and `duckdbSchema`, described below.
Each takes a request as a JSON string and returns the response as a JSON
string. Requests and responses are the stable
`@malloydata/malloy-interfaces` types used by `API.stateless` (see
[`packages/malloy/src/api/CONTEXT.md`](../malloy/src/api/CONTEXT.md)): three
of the functions wrap that API and add nothing but the string boundary.

`compileModelContents` is `compileModel` with a different answer to "what
is in this model": its `entries` list every source and named query the
model can see, including imported ones, where `compileModel` lists only
what the model exports. That is what an interactive host shows when asked
what can be queried. Named queries come back as `kind: 'query'` with their
output schema (`compileModel` lists them as sources). It works from the
`ModelDef` that the stateless response already carries in `translations`,
through the public `modelDefToModelInfo`.

They never throw. An exception, including a request that is not valid JSON,
comes back as a response whose `logs` holds one error.

`compileModelCatalog` (`src/catalog.ts`) is `compileModel` answering
with a `catalog` for an interactive host to show: every source and named
query the model can see, with its description (the `#"` annotation route,
or `#(docs)`), primary key, source filters and parameters, and every field
reachable from it through joins and nested data. Each field has its dotted
`path`, `kind`, `type`, `description`, `annotations` (every other
annotation, as written: `# number="####"`, `#(agent) ...`), `definition` (the expression, if it
isn't a column), `grain` (the nearest `join_many`, `join_cross` or array on
its path, whose rows it has one value per) and a one-line `usage` saying how
a query uses it. Its rules are Malloy's: grouping by a field with a grain
gives a row per grain row, and aggregating a joined field runs over the rows
of the source it comes from, without double counting. It reads the
`ModelDef` from the response's `translations`, so it relies on the IR's
shape (`fields`, `join`, `code`, `expressionType`, `filterList`,
`primaryKey`); the spec checks the parts hosts depend on.

`duckdbSchema` is for hosts that are DuckDB. It takes
`[[column_name, column_type], ...]` as DuckDB's `DESCRIBE` reports them and
returns the `Malloy.Schema` to answer a table or SQL schema need with,
converting the types exactly as Malloy's DuckDB connection does
(`DuckDBDialect.parseDuckDBType`), `STRUCT` and `LIST` included. A host
should use it rather than map types itself.

### The needs loop

The compiler is synchronous and does no IO. A host drives it:

1. Call `compileQuery` with `model_url` (the model file) and `query_malloy`
   (the query text, run against that model), plus a `compiler_needs` holding
   the connections it knows about: `{name, dialect}`.
2. If the response has `result`, its `sql` is the answer. If `logs` holds an
   error, stop.
3. Otherwise `compiler_needs` lists what is missing: file contents by URL,
   table schemas by connection and name, and so on. Fetch them, add them to
   the `compiler_needs` you send, and call again with the same request.

Imports resolve relative to the importing file's URL, so the host decides
what a URL means (local path, `https://`, anything else). The spec,
`src/bundle.spec.ts`, is a complete small host.

## Globals the bundle supplies

An engine with only the ECMAScript built-ins lacks several things the
compiler or its dependencies read. The bundle fills them in, and each is
installed only if the host has not already defined it (define it before
evaluating the bundle to use your own):

| Global | Read by | Fallback in `src/globals.ts` / `src/url.ts` |
|---|---|---|
| `crypto.getRandomValues` | `uuid` (names internal objects) | `Math.random`; uniqueness, not secrecy, is all that is needed |
| `performance.now` | compile timing | `Date.now` |
| `URL`, `URLSearchParams` | import resolution | `whatwg-url` |
| `TextEncoder`, `TextDecoder` | `whatwg-url` | UTF-8 only |

`process` is not a global. The `assert` polyfill that antlr4ts pulls in reads
`process.env` when it loads, so esbuild `inject`s `src/process-shim.ts` in
place of every free `process` reference instead. The spec checks that no
global `process` appears.

`src/globals.ts` must stay the first import in `src/index.ts`, because
`whatwg-url` constructs a `TextEncoder` when it loads.

## Known gap: `Intl`

Timestamp literals (`@2003-01-15 10:00`), timezones and some filter
expressions go through `luxon`, which needs `Intl` with timezone data.
QuickJS has no `Intl`, so those compiles fail there. The `luxon` call sites
are few (`lang/ast/expressions/time-literal.ts`, `model/filter_compilers.ts`,
`model/given_binding.ts`, `api/row_data_utils.ts`, and Snowflake's dialect),
so the likely fix is to route them through a small date and timezone
interface that the host can supply, rather than to bundle an `Intl` polyfill
with timezone data. Until then the spec avoids time literals.

## Building and testing

- `npm run dev` here bundles; `npm run build` typechecks first. The root
  `npm run build` runs this after `packages/malloy`, whose `dist` the bundle
  is made from, so rebuild `packages/malloy` (root `npm run dev`) before
  bundling if you changed it.
- `npx jest packages/malloy-embedded` (from the repo root) tests the built
  bundle, not the sources, inside a `vm` context that has only the ECMAScript
  built-ins and no `Intl`. It fails with a pointer to `npm run dev` if the
  bundle has not been built. It runs in the `malloy-core` jest project.
