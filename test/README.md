## Tests
Which tests run where, how to run them, and where a new test goes are in the Testing section of the [root CONTEXT.md](../CONTEXT.md#testing). In short: `npm run precheck` is the broad local check, `npx jest <file>` runs one file (set `MALLOY_DATABASE` for a `db-` file), and `npm run dbtest <database>` runs exactly what that database's CI job runs.

_(Setting `MALLOY_DATABASE=duckdb` before launching VS Code makes the Jest runner extension run `db-` files on that database.)_

# Building test database for DuckDB

1. At top-level, run `sh test/duckdb/load_test_data.sh`
2. A file called `duckdb_test.db` should be created in the test/data/duckdb folder - tests will automatically look there.

# Starting other database servers
Many other dialects have scripts  
* `test/DIALECT/DIALECTstart.sh`*  
* `test/DIALECT/DIALECTstop.sh`*  
  
Which will spin up or down an instance of a server for that dialect loaded with the correct test database. With the correct hidden knowledge, you can use these to test any supported dialect locally. Not all people have access to all the hidden knowledge. This is an area of active concern.

# Using the test matchers

The test infrastructure is exported from `@malloydata/malloy/test`. Import matchers to register them with Jest:

```typescript
import '@malloydata/malloy/test/matchers';
import {mkTestModel, TV} from '@malloydata/malloy/test';
```

## Creating test data with mkTestModel

Use `mkTestModel` to create in-memory test tables with type-safe data:

```typescript
const tm = mkTestModel(testDatabase, {
  users: [
    {id: 1, name: 'alice', active: true},
    {id: 2, name: 'bob', active: false},
  ],
});

await expect('run: users -> { select: * }').toMatchResult(tm, {name: 'alice'});
```

### Type hints with TV namespace

Most types are inferred, but some need explicit hints:

```typescript
const tm = mkTestModel(testDatabase, {
  data: [
    {
      count: 42,              // inferred as integer
      price: TV.float(19.99), // explicit float
      created: TV.date('2024-01-15'),
      updated: TV.timestamp('2024-01-15T10:30:00Z'),
      nothing: TV.int(null),  // typed null
    },
  ],
});
```

## Result matchers

### toMatchResult - partial matching

Checks that expected fields match. Actual rows can have extra fields. Extra rows are allowed.

```typescript
// Single row - just checks first row has matching fields
await expect('run: users -> { select: * }').toMatchResult(tm, {name: 'alice'});

// Multiple rows - variadic arguments
await expect('run: users -> { select: * }').toMatchResult(tm,
  {name: 'alice'},
  {name: 'bob'}
);

// Empty match {} checks at least one row exists
await expect('run: users -> { select: * }').toMatchResult(tm, {});
```

### toMatchRows - partial fields, exact row count

Like `toMatchResult` but requires exactly the specified number of rows:

```typescript
// Must have exactly 2 rows
await expect('run: users -> { select: * }').toMatchRows(tm, [
  {name: 'alice'},
  {name: 'bob'},
]);
```

### toEqualResult - exact matching

Requires exact field match (no extra fields) and exact row count:

```typescript
await expect('run: users -> { select: name }').toEqualResult(tm, [
  {name: 'alice'},
  {name: 'bob'},
]);
```

## Schema-aware matching

The matchers use schema information for intelligent comparisons:

```typescript
// Dates - plain strings work for date fields
await expect(query).toMatchResult(tm, {
  birth_date: '2024-01-15',  // matches date field automatically
});

// Timestamps - ISO strings or Date objects
await expect(query).toMatchResult(tm, {
  created_at: '2024-01-15T10:30:00.000Z',
});
```

## Nested data with toMatchPaths

For queries with `nest:`, use `toMatchPaths` to navigate nested arrays: This is useful when a query returns a long nested array of records and you only care about the value of the first record.

```typescript
await expect(`
  run: src -> { nest: by_state is {...} }
`).toMatchPaths(tm, {
  'by_state.state': 'TX',
  'by_state.count': 1845,
});
```

## Reading failure output

### Data differences

When tests fail, you see a `DATA DIFFERENCES` section showing actual vs expected:

```
DATA DIFFERENCES
  Expected 3 rows, got 2
  0: { id: 1, name: 'alice' }        <- green (matched)
  1! { id: 2, name: 'bob' }          <- red (field mismatch)
    Expected age: 99
  2! (missing)                        <- red
    Expected: { name: 'charlie' }
```

- Matched rows use `:` and are shown in green
- Mismatched rows use `!` and are shown in red with expected values indented below
- Extra rows use `!` and are shown in red
- Missing rows use `!` and show what was expected

The `!` marker makes it easy to identify problems even in non-colored output.

### Bad Malloy Code

Syntax errors show the query with a `!!!!!` marker at the error:

```
Error in query compilation
    |
    |         rug: db.sql("""
!!!!!         ^ no viable alternative at input 'rug'
    |           SELECT 42 as num
    |         """)
    |
```

## Debugging with # test.debug

Add `# test.debug` to force a test to fail and print the result data:

```typescript
await expect(`
  # test.debug
  run: users -> { select: * }
`).toMatchResult(tm, {name: 'alice'});
```

Output:
```
Test forced failure (# test.debug)
Result: [ { id: 1, name: 'alice' }, { id: 2, name: 'bob' } ]
```

This is useful when developing tests to see what data is actually returned.

## Logging SQL with MALLOY_LOG_SQL

Set the `MALLOY_LOG_SQL` environment variable to log the generated SQL to the console before each query run by the test matchers (`toMatchResult`, `toMatchRows`, `toEqualResult`, `toMatchPaths`):

```sh
MALLOY_LOG_SQL=1 MALLOY_DATABASE=duckdb npx jest test/src/expressions/expressions.db-all.spec.ts
```

This is useful for debugging SQL generation issues without modifying test code.
