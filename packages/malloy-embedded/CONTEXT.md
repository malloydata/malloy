# malloy-embedded

Builds Malloy into one self-contained script, `dist/malloy-embedded.js`,
for hosts that run JavaScript in an embedded engine rather than in Node or
a browser. The motivating host is a DuckDB extension that runs the bundle
in QuickJS. Apart from the DuckDB connection it carries, nothing here is
specific to DuckDB or QuickJS.

The package is `private`: the bundle is a build output for other projects
to pick up, not an npm package.

## What the bundle is

- A classic script (an IIFE), not a module, so an engine can evaluate it with
  no module loader. Evaluating it sets `globalThis.malloyEmbedded`.
- ES2020, minified, about 2.3 MB, with an external source map.
- `platform: 'neutral'`: it may not reach for Node built-ins or the DOM. An
  import that resolves to one fails the build, which is the guard against
  Malloy growing a dependency an embedded engine cannot satisfy.

## The interface

`malloyEmbedded` has no API of its own. It holds `version` and the public
exports of three packages, as an npm consumer imports them:

| Property | Package |
|---|---|
| `malloy` | `@malloydata/malloy` |
| `interfaces` | `@malloydata/malloy-interfaces` |
| `duckdb` | `@malloydata/db-duckdb/host` (`HostDuckDBConnection`) |

A host is an ordinary Foundation host (see
[`packages/malloy/src/api/CONTEXT.md`](../malloy/src/api/CONTEXT.md)): a
`Runtime` with a `URLReader` and a `Connection`, then `loadModel`,
`loadQuery`, `extendModel` and so on. A host that is a DuckDB database
gives `HostDuckDBConnection` a `query(sql)` that runs SQL in that database;
the only SQL Malloy sends while compiling is `DESCRIBE SELECT * FROM ...`.

Things a host needs to know:

- The Runtime API is asynchronous, but nothing in it waits on a timer or
  real IO. If the host's callbacks answer synchronously, the returned
  promise settles once the engine's job queue is drained (QuickJS:
  `JS_ExecutePendingJob` until the promise is no longer pending).
- Make URLs with the engine's `URL` (the bundle's, if the engine had
  none). `Runtime` tells a URL from Malloy text with `instanceof URL`, so a
  URL object made outside the engine is taken for Malloy text.
- A source's table schema is part of its compiled model. To see a table
  the host changed, pass `refreshSchemaCache` to `loadModel`, not
  `loadQuery`.

## Globals the bundle supplies

An engine with only the ECMAScript built-ins lacks several things Malloy
or its dependencies read. The bundle fills them in, and each is installed
only if the host has not already defined it (define it before evaluating
the bundle to use your own):

| Global | Read by | Fallback in `src/globals.ts` / `src/url.ts` |
|---|---|---|
| `crypto.getRandomValues` | `uuid` (names internal objects) | `Math.random`; uniqueness, not secrecy, is all that is needed |
| `performance.now` | compile timing | `Date.now` |
| `URL`, `URLSearchParams` | import resolution | `whatwg-url` |
| `TextEncoder`, `TextDecoder` | `whatwg-url` | UTF-8 only |
| `Intl` | luxon (time literals, filters) | English and UTC only; see below |

`process` is not a global. The `assert` polyfill that antlr4ts pulls in reads
`process.env` when it loads, so esbuild `inject`s `src/process-shim.ts` in
place of every free `process` reference instead. The spec checks that no
global `process` appears.

`src/globals.ts` must stay the first import in `src/index.ts`, because
`whatwg-url` constructs a `TextEncoder` when it loads.

## `Intl`

luxon, which Malloy uses for time literals (`@2003-01-15 10:00`) and
filter expressions, reads `Intl` for the system locale and time zone. An
engine without `Intl` (QuickJS) gets a fallback from `src/globals.ts`:
English, Latin digits and the UTC zone. That is all Malloy's luxon calls
need, since they only parse and format fixed numeric patterns and step
calendar units; time-zone conversion is left to the database's SQL. The
fallback throws for anything that would need real locale or zone data (a
named zone other than UTC, month names), so luxon reports it invalid
rather than computing a wrong answer.

## Building and testing

- `npm run dev` here bundles; `npm run build` typechecks first. The root
  `npm run build` runs this after the packages it bundles, whose `dist` the
  bundle is made from, so rebuild those (root `npm run dev`) before
  bundling if you changed them.
- `npx jest packages/malloy-embedded` (from the repo root) tests the built
  bundle, not the sources, inside a `vm` context that has only the
  ECMAScript built-ins and no `Intl`. It fails with a pointer to
  `npm run dev` if the bundle is missing or older than `src/`. It runs in
  the `malloy-core` jest project.
