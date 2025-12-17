## Tests
The test infrastructure is complicated because some tests are meant to be run once, and some tests are meant to be run once for each dialect, or once for each dialect from a set of dialects. Work is happening to clean this up and clarify how to deal with this.  
  
At one time you could run `npm run test`  and all tests would run against all databases. The number of dialects has grown so that this is no longer feasible. If you have made changes and want general assurance that your changes might be safe, run `npm run test-duckdb` which runs the full test suite, but only against the DuckDB database which is fast and local.  
  
If you have the credentials and the test server set up, there is an `npm run ci-DIALECTNAME` test for each dialect which will run just the portion of the test suite which communicates with the database.  
  
Pushing A PR will require it to pass CI for all dialects.  
  
If you have a multi-dialect test (such as the ones in `test/src/databases/all`) most of the time a developer will set up one database to test against when something is broken (commonly duckdb, but it could be anything where a server is available) and the command to run that one test file is ..  
  
`MALLOY_DATABASE=duckdb npx jest test/src/databases/all/MY_FILE.spec.ts`  
  
_(another common setup is to set the environment variable `MALLOY_DATABASE=duckdb` before launching VS Code, and then running tests inside the IDE with the "JestRunner" extension will pick that up and run the tests against only that dialect)_

# Building test database for DuckDB

1. At top-level, run `npx ts-node scripts/build_duckdb_test_database.ts`
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
const tm = mkTestModel(runtime, {
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
const tm = mkTestModel(runtime, {
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

## Nested data with toHavePath

For queries with `nest:`, use `toHavePath` to navigate nested arrays: This is useful when a query returns a long nested array of records and you only care about the value of the first record.

```typescript
import {runQuery} from '@malloydata/malloy/test';

const result = await runQuery(tm.model, 'run: src -> { nest: by_state is {...} }');
expect(result.data[0]).toHavePath({
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
  1: { id: 2, name: 'bob' }          <- red (field mismatch)
    Expected age: 99
  2: (missing)                        <- red
    Expected: { name: 'charlie' }
```

- Matched rows are shown in green
- Mismatched rows are shown in red with expected values indented below
- Extra rows are shown in red
- Missing rows show what was expected

### Bad Malloy Code

Syntax errors show the query with a `!!!!!` marker at the error:

```
Error in query compilation
    |
    |         rug: duckdb.sql("""
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
