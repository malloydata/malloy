/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase, testFileSpace} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

afterAll(() => testDatabase.shutdown());
const testModel = wrapTestModel(testDatabase, '');

it('cross-model import with sql interpolation in join', async () => {
  // When a sql_select source uses %{ source -> view } interpolation,
  // the Query segment stores the source's structRef as a string name.
  // After import into another model, that name is not in the importing
  // model's namespace, causing "Unexpected reference to an undefined source".
  const baseURL = new URL('test://join-import-base.malloy');
  const userURL = new URL('test://join-import-user.malloy');

  testFileSpace.setFile(
    baseURL,
    `
      source: base_models is db.table('malloytest.aircraft_models') extend {
        view: mfr_list is { select: manufacturer }
      }

      source: sql_mfrs is db.sql("""
        SELECT
          ${testDatabase.dialect.sqlQuoteIdentifier('manufacturer')}
          as ${testDatabase.dialect.sqlQuoteIdentifier('sql_mfr')}
          FROM %{ base_models -> mfr_list } as SpOrKlE
      """)

      source: combined is base_models extend {
        join_one: sql_mfrs on manufacturer = sql_mfrs.sql_mfr
      }

      source: result_src is combined -> {
        select: manufacturer, sql_mfrs.sql_mfr
      }
      `
  );

  testFileSpace.setFile(
    userURL,
    `
      import { result_src } from "test://join-import-base.malloy"

      run: result_src -> { select: * limit: 1 }
      `
  );

  try {
    const sql = await testDatabase.runtime.loadQuery(userURL).getSQL();
    expect(sql).toContain('SELECT');
  } finally {
    testFileSpace.deleteFile(baseURL);
    testFileSpace.deleteFile(userURL);
  }
});

const q = (x: TemplateStringsArray) =>
  testDatabase.dialect.sqlQuoteIdentifier(x.toString());

const sql1234 = `db.sql('SELECT 1 as ${q`a`}, 2 as ${q`b`} UNION ALL SELECT 3, 4')`;

it('sql block', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: one is db.sql("""
        SELECT 2 as ${q`a`}
      """)
      run: one -> {
        select: a
      }`).toMatchResult(testModel, {a: 2});
});

it('run simple sql', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`run: db.sql('select 1 as ${q`one`}')`).toEqualResult(
    testModel,
    [{one: 1}]
  );
});

it('simple sql is exactly as written', async () => {
  const result = await testDatabase.runtime
    .loadQuery(`run: db.sql('select 1 as ${q`one`}')`)
    .run();
  if (testDatabase.name === 'postgres') {
    expect(result.sql).toBe(`WITH __stage0 AS (
  select 1 as ${q`one`})
SELECT row_to_json(finalStage) as row FROM __stage0 AS finalStage`);
  } else {
    expect(result.sql).toBe(`select 1 as ${q`one`}`);
  }
  expect(result.resultExplore).not.toBeUndefined();
});

it('source from query defined as sql query', async () => {
  const result = await testDatabase.runtime
    .loadQuery(
      `
        query: q is db.sql('select 1 as ${q`one`}')
        source: s is q
        run: s -> { select: * }
      `
    )
    .run();
  expect(result.data.path(0, 'one').number.value).toBe(1);
});

// not sure this works on all dialect.
it("stage names don't conflict", async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
        source: airports is db.table('malloytest.state_facts') extend {
        }

        query: st0 is airports -> {
          select: state
        } -> {
          select: *
        }

        query: st1 is airports -> {
          select: state
        } -> {
          select: *
        }

        query: u is db.sql("""SELECT * FROM %{st0 } as x UNION ALL %{st1 }""") -> {
          select: *
        }
        // # test.debug
        run: u -> {
          aggregate: c is count()
        }
    `).toMatchResult(testModel, {c: 102});
});

it('sql as source', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: ${sql1234} -> {
        select: a
        order_by: 1
      }
    `).toMatchResult(testModel, {a: 1});
});

// have to add an order_by: otherwise it isn't deterministic.
it('sql directly', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(
    `run: ${sql1234}->{
        select: *
        order_by: a asc
      }`
  ).toMatchResult(testModel, {a: 1});
});

// weirdly '*' must be the first thing in the select list in MySQL
it('sql with turducken', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  const turduckenQuery = `
      run: db.sql("""
        SELECT
          *
          , 'something' as SOMETHING
        FROM %{
          db.table('malloytest.state_facts') -> {
            group_by: popular_name
            aggregate: state_count is count()
          }
        } AS by_name_query
      """) -> {
          select: *; where: popular_name = 'Emma'
          order_by: state_count DESC
        }`;
  await expect(turduckenQuery).toMatchResult(testModel, {state_count: 6});
});

it('sql expression with turducken', async () => {
  await expect(`
      run: db.sql(
        """SELECT * FROM (%{
          db.table('malloytest.state_facts') -> {
            aggregate: c is count()
          }
        }) AS state_facts """
      ) -> { select: * }
    `).toMatchResult(testModel, {c: 51});
});
it('sql expression in second of two queries in same block, dependent on first query', async () => {
  await expect(`
      query:
        a is db.table('malloytest.state_facts') -> {
          aggregate: c is count()
        }
        b is db.sql(
          """SELECT * FROM (%{ a -> { select: * } }) AS state_facts """
        ) -> { select: * }
      run: b
    `).toMatchResult(testModel, {c: 51});
});
it('sql expression in other sql expression', async () => {
  await expect(`
      run: db.sql("""
        SELECT * from (%{
          db.sql("""SELECT 1 as ${q`one`} """) -> { group_by: one }
        }) as the_table
      """) -> { group_by: one }
    `).toMatchResult(testModel, {one: 1});
});
it('run sql expression as query', async () => {
  await expect(`run: db.sql("""SELECT 1 as ${q`one`} """)`).toMatchResult(
    testModel,
    {one: 1}
  );
});
