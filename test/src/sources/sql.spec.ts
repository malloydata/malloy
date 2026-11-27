/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';

describe('turducken', () => {
  test('malloy source code is wrapped in parens', async () => {
    const sql = 'SELECT 1 as one';
    const q = testDatabase.runtime.loadQuery(`
      source: hasone is db.sql("${sql}");
      run: db.sql("""SELECT one as num FROM %{hasone->{select:*}}""")
    `);
    const qsql = await q.getSQL();
    expect(qsql).toContain(`FROM (${sql}) as base`);
  });
  test('malloy source code not double-wrapped in parens', async () => {
    const sql = 'SELECT 1 as one';
    const q = testDatabase.runtime.loadQuery(`
      source: hasone is db.sql("${sql}");
      run: db.sql("""SELECT one as num FROM (%{hasone->{select:*}})""")
    `);
    const qsql = await q.getSQL();
    expect(qsql).toContain(`FROM (${sql}) as base`);
  });
});

describe('source interpolation', () => {
  test('sql source in interpolation', async () => {
    const q = testDatabase.runtime.loadQuery(`
      source: sql_src is db.sql("SELECT 1 as one")
      run: db.sql("""SELECT one FROM %{ sql_src }""") -> { select: * }
    `);
    const result = await q.run();
    expect(result.data.value[0]['one']).toBe(1);
  });

  test('query source in interpolation', async () => {
    const q = testDatabase.runtime.loadQuery(`
      source: query_src is db.sql("SELECT 1 as one") -> { select: * }
      run: db.sql("""SELECT one FROM %{ query_src }""") -> { select: * }
    `);
    const result = await q.run();
    expect(result.data.value[0]['one']).toBe(1);
  });
});

afterAll(() => testDatabase.shutdown());
