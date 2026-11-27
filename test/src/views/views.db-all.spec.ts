/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
  view: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;
const testModel = wrapTestModel(testDatabase, modelText);

const q = (x: TemplateStringsArray) =>
  testDatabase.dialect.sqlQuoteIdentifier(x.toString());

// turtle expressions
it('model: turtle', async () => {
  await expect('run: aircraft->by_manufacturer').toMatchResult(testModel, {
    manufacturer: 'CESSNA',
  });
});

// filtered turtle expressions
test.when(testDatabase.dialect.supportsNesting)(
  'model: filtered turtle',
  async () => {
    await expect(`
      run: aircraft->{
        nest: b is by_manufacturer + { where: aircraft_models.manufacturer ?~'B%'}
      }
    `).toMatchPaths(testModel, {'b.manufacturer': 'BEECH'});
  }
);

const lensesTestModel = wrapTestModel(testDatabase, '');
it('named view plus named view', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
      }
      run: x -> d + m
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('named view plus measure', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d is { group_by: n }
        measure: c is count()
      }
      run: x -> d + c
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('dimension plus named view', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> n + m
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('where headed', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> { where: true } + m
    `).toMatchResult(lensesTestModel, {c: 1});
});
it('named view plus named view in source', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
        view: y is d + m
      }
      run: x -> y
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('dimension plus named view in source', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
        view: y is n + m
      }
      run: x -> y
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('named view plus dimension in source', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
        view: y is m + n
      }
      run: x -> y
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('literal view plus named view', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> { group_by: n } + m
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('literal view plus measure', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
      }
      run: x -> { group_by: n } + c
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('measure plus literal view', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
      }
      run: x -> c + { group_by: n }
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('literal view plus named view in source', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
        view: y is { group_by: n } + m
      }
      run: x -> y
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('literal view plus measure in source', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
        view: y is { group_by: n } + c
      }
      run: x -> y
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('named view plus literal view', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d is { group_by: n }
      }
      run: x -> d + { aggregate: c is count() }
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('literal view plus literal view', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}')
      run: x -> { group_by: n } + { aggregate: c is count() }
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('three named views', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d1 is { group_by: n1 is n }
        view: d2 is { group_by: n2 is n }
        view: m is { aggregate: c is count() }
      }
      run: x -> d1 + d2 + m
    `).toMatchResult(lensesTestModel, {n1: 1, n2: 1, c: 1});
});
it('nested no name', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: d + m
      }
    `).toMatchResult(lensesTestModel, {d: [{n: 1, c: 1}]});
});
it('nested with name', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: y is d + m
      }
    `).toMatchResult(lensesTestModel, {y: [{n: 1, c: 1}]});
});
it('nested no name with dimension head', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: n + m
      }
    `).toMatchResult(lensesTestModel, {n: [{n: 1, c: 1}]});
});
it('nest dimension only', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: n
      }
    `).toMatchResult(lensesTestModel, {n: [{n: 1}]});
});
it('joined dimension in middle of refinements', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 2 as ${q`n`}') on true
        view: m is { aggregate: c is count() }
      }
      run: x -> m + y.n + { limit: 1 }
    `).toMatchResult(lensesTestModel, {'n': 2, 'c': 1});
});
it('nest joined dimension refined', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 1 as ${q`n`}') on true
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: y.n + { limit: 1 }
      }
    `).toMatchResult(lensesTestModel, {n: [{n: 1}]});
});
it('joined dimension refined', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 2 as ${q`n`}') on true
        view: m is { aggregate: c is count() }
      }
      run: x -> y.n + { limit: 1 }
    `).toMatchResult(lensesTestModel, {'n': 2});
});
it('nest joined dimension bare', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 2 as ${q`n`}') on true
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: y.n
      }
    `).toMatchResult(lensesTestModel, {n: [{n: 2}]});
});
it('joined dimension bare', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 2 as ${q`n`}') on true
        view: m is { aggregate: c is count() }
      }
      run: x -> y.n
    `).toMatchResult(lensesTestModel, {'n': 2});
});
it('joined dimension nest refinement', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 2 as ${q`n`}') on true
        view: m is { aggregate: c is count() }
      }
      run: x -> { nest: m + y.n }
    `).toMatchResult(lensesTestModel, {m: [{c: 1, n: 2}]});
});
it.skip('nest measure only in second stage', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> m -> {
        nest: c
      }
    `).toMatchResult(lensesTestModel, {m: [{c: 1}]});
});
it('nest dimension only in refinement', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> m + {
        nest: n
      }
    `).toMatchResult(lensesTestModel, {n: [{n: 1}], c: 1});
});
it('view dimension only', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: m is n
      }
      run: x -> m
    `).toMatchResult(lensesTestModel, {n: 1});
});
it('view join dimension only', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        join_one: y is db.sql('SELECT 2 as ${q`n`}') on true
        view: m is y.n
      }
      run: x -> m
    `).toMatchResult(lensesTestModel, {n: 2});
});
it('run dimension only', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}')
      run: x -> n
    `).toMatchResult(lensesTestModel, {n: 1});
});
it.skip('second stage refinement chain', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}')
      run: x -> n -> n + { aggregate: c is count() }
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it.skip('second stage refinement chain in nest', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: v is n -> n + { aggregate: c is count() }
      }
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('copy of view with lens', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        view: metrics is { aggregate: c is count() }
        view: v is { group_by: n } + metrics
        view: v2 is v
      }
      run: x -> v2
    `).toMatchResult(lensesTestModel, {n: 1, c: 1});
});
it('aggregate copy bug with only old refinement', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
      }
      run: x -> c + {
        aggregate: e is c { where: false }
      }
    `).toMatchResult(lensesTestModel, {c: 1, e: 0});
});
it('aggregate copy bug with only old old refinement', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
        view: v is { aggregate: c }
      }
      run: x -> v + {
        aggregate: e is c { where: false }
      }
    `).toMatchResult(lensesTestModel, {c: 1, e: 0});
});
it('but still need to be able to use as output field', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
        view: v is { aggregate: c }
      }
      run: x -> v + {
        calculate: e is lag(c)
      }
    `).toMatchResult(lensesTestModel, {c: 1, e: null});
});
it('aggregate copy bug', async () => {
  await expect(`
      source: x is db.sql('SELECT 1 as ${q`n`}') extend {
        measure: c is count()
      }
      run: x -> n + c + {
        aggregate: e is c { where: false }
      }
    `).toMatchResult(lensesTestModel, {n: 1, c: 1, e: 0});
});

const sql1234 = `db.sql('SELECT 1 as ${q`a`}, 2 as ${q`b`} UNION ALL SELECT 3, 4')`;

// local declarations
it('local declarations external query', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: ${sql1234} -> {
        extend: { dimension: c is a + 1 }
        select: c
        order_by: 1
      }
    `).toMatchResult(testModel, {c: 2});
});

it('local declarations named query', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: ${sql1234} extend {
        view: bar is {
          extend: { dimension: c is a + 1 }
          select: c
          order_by: 1
        }
      } -> bar
    `).toMatchResult(testModel, {c: 2});
});

it('local declarations refined named query', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: ${sql1234} extend {
        view: bar is {
          extend: {dimension: c is a + 1}
          select: c
          order_by: 1
        }
        view: baz is bar +  {
          extend: {dimension: d is c + 1}
          select: d
          order_by: 1
        }
      } -> baz
    `).toMatchResult(testModel, {d: 3});
});
