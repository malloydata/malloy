# malloy.ts - Public API Classes

The file `src/malloy.ts` is the main public API surface for the Malloy package. It exports classes that wrap internal IR types and provide user-facing functionality.

## Core Data Classes

### `Model`
Wraps `ModelDef` (internal IR). Represents a compiled Malloy model.

- `explores: Explore[]` - All sources in the model (wrapped)
- `getPreparedQueryByName(name): PreparedQuery`
- `getPreparedQueryByIndex(index): PreparedQuery`
- `getExploreByName(name): Explore`
- `_modelDef` - Escape hatch to raw IR

### `PreparedQuery`
Wraps `Query` (internal IR) + `ModelDef`. A query that can be compiled to SQL.

- `getPreparedResult(options?): PreparedResult` - Compile to SQL
- `dialect: string`
- `name?: string`
- `_query`, `_modelDef` - Escape hatches

**Issue:** Each `getPreparedResult()` call creates a new `QueryModel`, reprocessing the ModelDef.

### `PreparedResult`
Wraps `CompiledQuery` (internal). The compiled SQL and metadata.

- `sql: string` - The generated SQL
- `connectionName: string` - Which connection to run against
- `resultExplore: Explore` - Schema of the result

### `Result`
Extends `PreparedResult`. Adds actual query result data.

- `data: DataArray` - The result rows
- `totalRows: number`
- `runStats: QueryRunStats`

### `Explore`
Wraps `StructDef` (internal). Represents a source (historical name was "explore").

- `name: string`
- `allFields: Field[]`
- `getFieldByName(name): Field`
- `getQueryByName(name): PreparedQuery` - Get a view as a query

### `ExploreField`
Extends `Explore`. A joined source (appears as a field in parent).

### `Query`
Wraps `TurtleDef`. Represents a view definition. **Different from `PreparedQuery`.**

### `QueryField`
Extends `Query`. A view that appears as a field in an explore.

### `AtomicField` and subclasses
Field wrappers: `StringField`, `NumberField`, `DateField`, `TimestampField`, `BooleanField`, `JSONField`, `UnsupportedField`

## Runtime & Materializer Classes

### `Runtime`
Entry point for loading and running Malloy. Holds URLReader, connections, event stream.

- `loadModel(source): ModelMaterializer`
- `loadQuery(query): QueryMaterializer`
- `getModel(source): Promise<Model>`
- `getQuery(query): Promise<PreparedQuery>`

### `SingleConnectionRuntime`
Extends `Runtime`. For single-connection use cases.

### `ConnectionRuntime`
Extends `Runtime`. Holds array of connections.

### `ModelMaterializer`
Fluent builder for loading models. Returned by `runtime.loadModel()`.

- `getModel(): Promise<Model>`
- `loadQueryByName(name): QueryMaterializer`
- `loadExploreByName(name): ExploreMaterializer`
- `extendModel(source): ModelMaterializer`

### `QueryMaterializer`
Fluent builder for queries. Returned by `modelMaterializer.loadQueryByName()`.

- `getPreparedQuery(): Promise<PreparedQuery>`
- `getPreparedResult(): Promise<PreparedResult>`
- `getSQL(): Promise<string>`
- `run(options?): Promise<Result>`

### `PreparedResultMaterializer`
Fluent builder for prepared results.

### `ExploreMaterializer`
Fluent builder for explores/sources.

## Result Data Classes

### `DataArray`
Iterable array of `DataRecord`. Query result rows.

### `DataRecord`
Single result row. Field values accessed by name.

## Utility Classes

- `Parse` - Parsed (not compiled) Malloy document
- `Malloy` - Static methods: `parse()`, `compile()`, `run()`
- `MalloyError` - Error with structured problems
- `EmptyURLReader`, `InMemoryURLReader` - URLReader implementations
- `FixedConnectionMap` - LookupConnection implementation
- `CacheManager`, `InMemoryModelCache` - Caching
- `JSONWriter`, `CSVWriter` - Result writers
- `DocumentSymbol`, `DocumentPosition`, `DocumentRange`, etc. - IDE support

## Naming Issues

| Current Name | What It Actually Is |
|--------------|---------------------|
| `Explore` | A source (historical name) |
| `PreparedQuery` | Uncompiled query holding IR |
| `PreparedResult` | Compiled query with SQL (not a "result") |
| `Query` | A view/turtle definition |

## Known Architectural Issues

1. **Transient QueryModel**: `PreparedQuery.getPreparedResult()` creates new `QueryModel` each call - expensive.
3. **Name collision**: `Query` class (view wrapper) vs internal `Query` type vs `PreparedQuery`
