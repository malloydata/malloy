# Restricted-Mode Malloy

How a host application runs Malloy queries written by an untrusted author against a trusted model. Restricted-mode compilation is a translate-time restriction on the language an untrusted author may use — it is not a sandbox, not a permission system, and not a guarantee of safety in any broader sense.

This is the user-facing guide. For internals (how each rejection is wired, the zone-lock structural guarantee, the API design history), see [`packages/malloy/src/api/CONTEXT.md`](../api/CONTEXT.md) and [`packages/malloy/src/lang/CONTEXT.md`](../lang/CONTEXT.md).

## Who this is for

Two roles:

- **Producer** — the trusted author. Writes the `.malloy` files that define the model, chooses what to expose, owns the connection. Anything the producer writes is by definition fine.
- **Consumer** — the untrusted author of a restricted query. Submits Malloy *text* (bytes received over the wire from an MCP request, a UI field, an LLM, etc.) that should run against an already-loaded trusted model.

Restricted mode defends against the consumer's text:

1. Reaching outside the model — reading tables, schemas, or files the model didn't expose.
2. Injecting raw SQL — getting a string of its choosing into the SQL stream.
3. Toggling compiler behavior — enabling experimental features or changing translation semantics out from under the producer.

It does not defend against an untrusted producer, side channels in the SQL engine, or anything in the model that's already insecure.

## The API

There is one method:

```ts
const r = new Runtime({connection});
const m = await r.loadModel(trustedSource);
const q = m.loadRestrictedQuery(untrustedText);
const result = await q.run({givens: {TENANT: '...'}});
```

`loadRestrictedQuery(text: string): QueryMaterializer` is the only documented user surface for restricted compilation.

- **`text` is a string.** The signature does not accept a URL. Restricted text arrives as bytes the host already has in hand — there is no host-side trust mechanism for fetching it.
- **The method exists only on `ModelMaterializer`.** A trusted model must already be loaded; every restricted compile sits structurally inside the trusted-then-restricted pattern.
- **No options bag.** Restricted-mode behavior is determined solely by the API entry point.

The returned `QueryMaterializer` is the same shape as the one returned by `loadQuery` and `loadFinalQuery`. Givens flow through `.run({givens: {...}})` in the usual way.

## What is forbidden in restricted text

Seven constructs are rejected at translate time:

| Construct | Example |
|---|---|
| `import` | `import "other.malloy"` |
| `given:` declarations | `given: TENANT :: string` |
| `##!` compiler-flag annotations | `##! experimental.givens` |
| `connection.table(...)` | `_db_.table('orders')` |
| `connection.sql(...)` | `_db_.sql("""SELECT 1""")` |
| `name!type(args)` raw-SQL function | `myfn!sql_string('CONCAT(...)')` |
| `sql_number / sql_string / sql_date / sql_timestamp / sql_boolean` | `sql_number("SELECT 1")` |

Anything the trusted model already contains is fine. A restricted query can freely reference a model dimension or measure whose definition uses any of these constructs — the producer vouched for those definitions. The rejection is *syntactic on the restricted text only* and does not walk transitively into model-defined names.

### Givens

A restricted query cannot declare new givens but can *reference* givens the model already declared. Use `$NAME` at the reference site; supply values at `.run({givens: {...}})`.

### Compiler flags

The trusted model author is the policy authority for which compiler flags are in effect during a restricted compile. Whatever flags the model declared via `##!` carry through. The restricted text cannot enable new flags.

## Error shape

Each rejection produces a translate-time error. The errors propagate through `Malloy.compile` as a `MalloyError` whose `problems[]` array carries one entry per violation:

```ts
import {MalloyError} from '@malloydata/malloy';

try {
  await m.loadRestrictedQuery(untrustedText).run();
} catch (e) {
  if (e instanceof MalloyError) {
    for (const p of e.problems) {
      if (p.errorTag === 'restricted-mode') {
        // p.code === 'restricted-construct-forbidden'
        // p.message names the offending construct and explains the rule
        // p.at points at the source position
      }
    }
  }
}
```

Every restricted-mode rejection has:
- `code: 'restricted-construct-forbidden'`
- `errorTag: 'restricted-mode'`
- A `message` that quotes the actual offending text and states the rule
- A source location in `at`

Multiple violations in one compile each produce their own entry — the compile does not stop at the first.

## What a restricted query can do

Everything else the language already allows:

- `source: ...` extensions of model-exposed sources (joins, dimensions, measures, views, refinements)
- `query: ...` and `run: ...` statements against model-exposed sources and queries
- All normal expression syntax: filters, aggregates, calculations, `pick`, nesting, time literals, casts, `+`-refinement
- References to model-declared givens via `$NAME`
- All annotation prefixes other than `##!` — `#`, `##`, `#"`, `#(app)` affect rendering and metadata, not SQL emission

## Resource limits

The existing run-API row limit applies to restricted runs the same way it does to any run; the host controls it. Engine-specific limits (statement timeout, max bytes scanned, etc.) are a host-side connection-setup concern — configure the connection before handing off.
