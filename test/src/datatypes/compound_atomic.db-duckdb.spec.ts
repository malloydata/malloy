/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

/*
 * DuckDB unnests an array with a CROSS JOIN LATERAL over a select-list
 * UNNEST, which it runs as a plain unnest, rather than with a LEFT JOIN
 * LATERAL, which it runs as a much slower delim join. These check that the
 * rows are those the LEFT JOIN gave: an empty or null array keeps its row,
 * elements keep their order, and an array inside an array, two arrays, and
 * an array beside or beneath a join each unnest as they did.
 */

afterAll(() => testDatabase.shutdown());

const people = `db.sql("""
  SELECT * FROM (VALUES
    (1, [30, 10, 20], [{'name': 'a', 'tags': ['x', 'y']}, {'name': 'b', 'tags': []}]),
    (2, [], [{'name': 'c', 'tags': ['z']}]),
    (3, NULL, NULL)
  ) AS t(id, nums, recs)
""")`;
const teams = `db.sql("""
  SELECT * FROM (VALUES (1, 'red', [5, 6]), (2, 'blue', []), (3, 'green', [7])) AS t(tid, team, scores)
""")`;

describe('unnest in from', () => {
  const tm = wrapTestModel(
    testDatabase,
    `
    source: teams is ${teams}
    source: people is ${people} extend {
      join_one: teams on id = teams.tid
    }
    `
  );

  test('elements keep their order, and empty or null arrays keep their row', async () => {
    await expect(`
      run: people -> { select: id, n is nums.each; order_by: id }
    `).toEqualResult(tm, [
      {id: 1, n: 30},
      {id: 1, n: 10},
      {id: 1, n: 20},
      {id: 2, n: null},
      {id: 3, n: null},
    ]);
  });

  test('counts elements, and does not fan out the source', async () => {
    await expect(`
      run: people -> {
        aggregate:
          rows is count()
          elements is nums.count()
          total is nums.each.sum()
          ids is id.sum()
      }
    `).toEqualResult(tm, [{rows: 3, elements: 3, total: 60, ids: 6}]);
  });

  test('an array inside an array', async () => {
    await expect(`
      run: people -> {
        group_by: id, name is recs.name, tag is recs.tags.each
        order_by: id, name, tag
      }
    `).toEqualResult(tm, [
      {id: 1, name: 'a', tag: 'x'},
      {id: 1, name: 'a', tag: 'y'},
      {id: 1, name: 'b', tag: null},
      {id: 2, name: 'c', tag: 'z'},
      {id: 3, name: null, tag: null},
    ]);
  });

  test('two arrays unnest as every pair of their elements', async () => {
    await expect(`
      run: people -> {
        group_by: id, n is nums.each, name is recs.name
        aggregate: c is count()
        order_by: id, n, name
      }
    `).toEqualResult(tm, [
      {id: 1, n: 10, name: 'a', c: 1},
      {id: 1, n: 10, name: 'b', c: 1},
      {id: 1, n: 20, name: 'a', c: 1},
      {id: 1, n: 20, name: 'b', c: 1},
      {id: 1, n: 30, name: 'a', c: 1},
      {id: 1, n: 30, name: 'b', c: 1},
      {id: 2, n: null, name: 'c', c: 1},
      {id: 3, n: null, name: null, c: 1},
    ]);
  });

  test('an array beside a join', async () => {
    await expect(`
      run: people -> {
        group_by: teams.team
        aggregate: total is nums.each.sum(), elements is nums.count()
        order_by: team
      }
    `).toEqualResult(tm, [
      {team: 'blue', total: 0, elements: 0},
      {team: 'green', total: 0, elements: 0},
      {team: 'red', total: 60, elements: 3},
    ]);
  });

  test('an array beneath a join', async () => {
    await expect(`
      run: people -> {
        group_by: id
        aggregate: total is teams.scores.each.sum(), scores is teams.scores.count()
        order_by: id
      }
    `).toEqualResult(tm, [
      {id: 1, total: 11, scores: 2},
      {id: 2, total: 0, scores: 0},
      {id: 3, total: 7, scores: 1},
    ]);
  });

  test('an array is not unnested with a LEFT JOIN LATERAL', async () => {
    const sql = await tm.model
      .loadQuery('run: people -> { select: id, n is nums.each }')
      .getSQL();
    expect(sql).not.toContain('LEFT JOIN LATERAL');
  });
});
