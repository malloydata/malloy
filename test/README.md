## Tests

By default, tests run against BigQuery, Postgres, and DuckDB.

Tests can also be run against a specific database, using the MALLOY_DATABASE or MALLOY_DATABASES environment variable, such as: `MALLOY_DATABASES=bigquery,postgres npm run test`

Setting up postgres:

# Setup for Postgres Test Data

Assumes that postgres has been installed via nix (installs but doesn't configure).

ADD to environment: `export PGHOST=localhost`

**postgres_init.sh** - builds a database as the current user in .tmp/data/malloytestdb. Starts server running on localhost:5432
copies the test data in `malloytest-postgres.sql.gz` into the database.

**postgres_start.sh** - starts the postgres server, once it has been installed (use after a reboot, for example)

**postgres_stop.sh** - stops the postgres server

**state_fact.sql** - example file on how to insert data from json

Setting up DuckDB:

# Building test database for duckdb

1. At top-level, run `npx ts-node scripts/build_duckdb_test_database.ts`
2. A file called `duckdb_test.db` should be created in the test/data/duckdb folder - tests will automatically look there.

# Using the custom matcher for running queries

There is now a custom matcher, `malloyResultMatches` for running queries.  The customer matcher makes it easy to write readable tests which need to look at query results, and produces useful output when the test fails to make it easier to develop tests or respond to the output of failing tests.

## Check for results in the first row of output

The simplest case is to check for result in the first row of output. You need either a `Runtime` or a `Model` that was obtained from `runtime.loadModel`

```TypeScript
// If the spec file doesn't have the matcher, use this statement. You will have
// to adjust the path to find REPO/test/util/db-jest-matchers
import './util/db-jest-matchers';

  const sampleSource = `duckdb.sql("""
            SELECT 42 as num, 'whynot' as reason
            UNION ALL SELECT 49, 'because'""")`;

  test('simple', async () => {
    await expect(`
      run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, {num: 42, reason: 'whynot'});
  });
```

This will check the following things.

* There is at least one row of data in the output. So `.malloyQueryMatches(rt, {})` will fail if the query returns no rows
* There are entries in that row for each key. `{}` matches any row
* The entries are equal, but it will error if the expected data as a number and the returned data is a string.

## Accessing nested results

You can specify a nested key in a match using a dotted path to the value. Note this
example also shows passing a model instead of a runtime to the matcher.

```TypeScript
  const model = runtime.loadModel(`source: sampleSource is ${sampleSource}`);
  test('nested', async () => {
    await expect(`
        run: sampleSource -> {
            nest: the_nest is {
                select: nestNum is num, nestWhy is reasons
            }
        }
    `).malloyResultMatches(model, {
      'the_nest.nestNum': 42,
      'theNest.nestWhy': 'whynot',
    });
  });
```

  > [!WARNING]
  > There is currently a ... feature ... where if the source code of a test
  > contains the characters `nest:` and the runtime connection does not support nesting,
  > the test passes without actually doing anything. There will better handling of
  > this problem in the future, but if your test is mysteriously passing, this is why.

## Queries returning more than one row of data

An array of match rows may can also be used, if the test needs to verify more than the first row of results.

```TypeScript
  test('multiple rows', async () => {
    await expect(`
        run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, [
      {num: 42, reason: 'whynot'},
      {num: 49, reason: 'because'},
    ]);
  });
```

This will pass if ..

* There are exactly two rows of output. If there are not exactly two the matcher will fail. If the query makes more than two rows, you will need to add a `limit: 2` to allow the matcher to pass.
* Each row is matches the matching criteria, again `{}` means "pass if there is a row"

## Reading failure output

### Mis-matched data

When the data return is incorrect, the matcher will always show you the generated SQL before showing you the failed match. This is useful when you are debugging a dialect want to know exactly what SQL ran to produce the non matching result.

```TypeScript
  test('wrong data', async () => {
    await expect(`
      run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, {num: 24, reason: 'i said so'});
  });
```

```
  ● malloyResultMatches › wrong data

    SQL Generated:
      SELECT
         base."num" as "num",
         base."reason" as "reason"
      FROM (
                SELECT 42 as num, 'whynot' as reason
                UNION ALL SELECT 49, 'because') as base

    Expected {num: 24} Got: 42
    Expected {reason: "i said so"} Got: "whynot"

      120 |     await expect(`
      121 |       run: ${sampleSource}
    > 122 |     `).malloyResultMatches(runtimeOrModel, {num: 24, reason: 'i said so'});
          |        ^
      123 |   });
      124 | });
      125 | afterAll(async () => await runtime.connection.close());

      at Object.<anonymous> (test/src/jestMatcher.spec.ts:122:8)
```

### Bad Malloy Code

If the Malloy code in your test is in error, the matcher tries to make a
it clear where the error is. Because many tests construct the query at runtime,
the matcher will print the entire text of the query in the failure message. Look for the line
starting with `!!!!!` to find your code error.

```TypeScript
  test('malloyResultMatches with an error', async () => {
    await expect(`
        rug: ${sampleSource}
    `).malloyResultMatches(runtime, [
      {num: 42, reason: 'whynot'},
      {num: 49, reason: 'because'},
    ]);
  });
```

```
  ● jestMatcher › malloyResultMatches with an error

    Error in query compilation
        |
        |         rug: duckdb.sql("""
    !!!!!         ^ no viable alternative at input 'rug'
        |           SELECT 42 as num, 'whynot' as reason
        |           UNION ALL SELECT 49, 'because'
        |         """)
        |

      77 |           UNION ALL SELECT 49, 'because'
      78 |         """)
    > 79 |     `).malloyResultMatches(runtime, [
         |        ^
      80 |       {num: 42, reason: 'whynot'},
      81 |       {num: 49, reason: 'because'},
      82 |     ]);

      at Object.<anonymous> (test/src/jestMatcher.spec.ts:79:8)
```

### Wrong Data Size

If an array is passed to `malloyResultMatches` each row will be matched, and an additional test will be added to make sure the that rows in the match set equals the rows in the result.

If you specify match data, that will also be tested for rows which exist in both the match set and the result set.

```TypeScript
  test('failing exactly one row', async () => {
    await expect(`
      run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, [{}]);
  });
```

```
  ● malloyResultMatches › failing exactly one row

    SQL Generated:
      SELECT
         base."num" as "num",
         base."reason" as "reason"
      FROM (
                SELECT 42 as num, 'whynot' as reason
                UNION ALL SELECT 49, 'because') as base

    Expected result.rows=1  Got: 2

      126 |     await expect(`
      127 |       run: ${sampleSource}
    > 128 |     `).malloyResultMatches(runtimeOrModel, [{}]);
          |        ^
      129 |   });
      130 | });
      131 | afterAll(async () => await runtime.connection.close());

      at Object.<anonymous> (test/src/api.spec.ts:128:8)``
```

### What it doesn't do

The old template for a test looked something like

```TypeScript
    const result = await runtime.loadQuery(`QUERYTEXT`);
    expect(result ....).toBeCorrectSomehow();
    expect(result ....).toBeCorrectADifferentWay();
    expect(result ....).toBeCorrectThisWayToo();
```

The actual matcher for a result is limited to an equality test, in the old pattern you would have written something using an existing matcher for a data value
```TypeScript
    expect(result.data.patch(0, 'numThings').value).toBeGreaterThan(7);
```
and if this is desirable, more work on the custom matcher would be needed to allow expressions like this to be written.