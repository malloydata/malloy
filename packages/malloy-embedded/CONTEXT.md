# malloy-embedded

Builds Malloy into one self-contained script, `dist/malloy-embedded.js`,
for hosts that run JavaScript in an embedded engine rather than in Node or
a browser. The motivating host is a DuckDB extension
([lloydtabb/malloy-duckdb](https://github.com/lloydtabb/malloy-duckdb)) that
runs the bundle in QuickJS.

The package is `private`: the bundle is a build output, not an npm package.
To get it, build it from this repository (see "Building and testing") and
copy `dist/malloy-embedded.js` into your project; record the `commit` it
reports (below), since nothing publishes it.

## What the bundle is

- A classic script (an IIFE), not a module, so an engine can evaluate it with
  no module loader. Evaluating it sets `globalThis.malloyEmbedded`.
- ES2020, minified, about 2.3 MB, with an external source map.
- `platform: 'neutral'`: it may not reach for Node built-ins or the DOM. An
  import that resolves to one fails the build, which is the guard against
  Malloy growing a dependency an embedded engine cannot satisfy.

## The interface

`malloyEmbedded` has no API of its own. It holds the public exports of three
packages, as an npm consumer imports them, and two strings:

| Property     | What                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `malloy`     | `@malloydata/malloy`                                                             |
| `interfaces` | `@malloydata/malloy-interfaces`                                                  |
| `duckdb`     | `@malloydata/db-duckdb/host`: `HostDuckDBConnection`                             |
| `version`    | `@malloydata/malloy`'s version                                                   |
| `commit`     | the commit the bundle was built from, `-dirty` if the checkout had local changes |

`MalloyEmbedded` in `src/index.ts` types it; the package emits no `.d.ts`.

## Writing a host

A host is an ordinary Foundation host (see
[`packages/malloy/src/api/CONTEXT.md`](../malloy/src/api/CONTEXT.md)): a
`Runtime` with a `URLReader` and a `Connection`. The smallest one, for a
host that is a DuckDB database:

```js
// After evaluating dist/malloy-embedded.js in the engine:
const {malloy, duckdb} = globalThis.malloyEmbedded;

const runtime = new malloy.Runtime({
  urlReader: {
    // Return the file's text; throw if there is none.
    readURL: async url => host.readFile(url.toString()),
  },
  connection: new duckdb.HostDuckDBConnection('duckdb', {
    digest: 'my-database',
    // Rows as objects: [{column_name: 'id', column_type: 'INTEGER'}, ...]
    query: sql => host.runSQL(sql),
  }),
});

runtime
  .loadModel(new URL('file:///models/flights.malloy'))
  .loadQuery('run: flights -> { group_by: carrier }')
  .getSQL()
  .then(
    sql => host.done(sql),
    error => host.failed(error.message)
  );
// The engine now has pending jobs: run them until done or failed is called.
```

`host` stands for whatever the embedding exposes to JavaScript.

- **Promises.** The Runtime API is asynchronous, but nothing in it waits on
  a timer or on IO of its own. If the host's callbacks answer
  synchronously, the promise settles once the engine's pending jobs have
  run: in QuickJS, call `JS_ExecutePendingJob` until it returns 0.
- **Files.** `readURL` returns the text, or `{contents, invalidationKey}`
  for a `CacheManager`. Throw when there is no file: the message reaches
  the user with the importing line. Imports resolve against the importing
  file's URL, so the host decides what a URL means. Text passed to
  `extendModel` has no URL of its own; give `importBaseURL` if it imports
  by a relative path. `InMemoryURLReader` serves a fixed map of files.
- **The connection.** `HostDuckDBConnection`'s host runs SQL in its own
  database. To compile, Malloy sends `DESCRIBE SELECT * FROM <table>` and
  `DESCRIBE SELECT * FROM (<sql>)`, and reads `column_name` and
  `column_type`; DESCRIBE output turns into Malloy types exactly as for the
  Node connection. `digest` names the database for persist manifests. A
  thrown string is reported like a thrown `Error`. Other databases have no
  host connection yet: `BaseConnection` is not in the bundle, so a
  non-DuckDB host would implement `Connection` in full.
- **Errors.** A failed compile rejects with a `MalloyError`; its `problems`
  are `LogMessage`s with a `message` and, where known, `at: {url, range}`.
  For text given as a string, `at.url` is an `internal://` URL and lines
  count from that text.
- **Schemas.** The connection caches table schemas. A source's schema is
  fixed when its model compiles, so to see a table the host changed, pass
  `refreshSchemaCache` to `loadModel`; given to `loadQuery`, it refreshes
  only the tables the query text names. A model served from a
  `CacheManager` is returned before `refreshSchemaCache` is looked at, and
  `CacheManager` keys only on files, so a host whose tables change between
  calls caches models itself.
- **The engine.** Malloy's parser recurses deeply: the DuckDB extension
  gives QuickJS 4 MB of stack. Evaluating the bundle and the first compile
  take a few seconds in QuickJS; later compiles reuse the loaded code.

## Globals the bundle supplies

An engine with only the ECMAScript built-ins lacks several things Malloy
or its dependencies read. The bundle fills them in, and each is installed
only if the host has not already defined it (define it before evaluating
the bundle to use your own):

| Global                       | Read by                         | Fallback in `src/globals.ts` / `src/url.ts`                   |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `crypto.getRandomValues`     | `uuid` (names internal objects) | `Math.random`; uniqueness, not secrecy, is all that is needed |
| `performance.now`            | compile timing                  | `Date.now`                                                    |
| `URL`, `URLSearchParams`     | import resolution               | `whatwg-url`                                                  |
| `TextEncoder`, `TextDecoder` | `whatwg-url`                    | UTF-8 only                                                    |
| `Intl`                       | luxon (time literals, filters)  | English and UTC only; see below                               |

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

- `npm run build -w packages/malloy-interfaces -w packages/malloy -w
packages/malloy-db-duckdb -w packages/malloy-embedded` (from the repo
  root) builds the bundle and what it is made from. `npm run dev` here
  rebundles from those packages' existing `dist`.
- `npx jest packages/malloy-embedded` (from the repo root) tests the built
  bundle, not the sources, inside a `vm` context that has only the
  ECMAScript built-ins and no `Intl`. It fails with a pointer to
  `npm run dev` if the bundle is missing, or older than `src/` or than the
  `dist` of a package it bundles. It runs in the `malloy-core` jest
  project, so that project needs the bundle built.
