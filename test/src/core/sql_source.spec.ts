/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';

const runtime = runtimeFor('duckdb');

describe('turducken', () => {
  test('malloy source code is wrapped in parens', async () => {
    const sql = 'SELECT 1 as one';
    const q = runtime.loadQuery(`
      source: hasone is duckdb.sql("${sql}");
      run: duckdb.sql("""SELECT one as num FROM %{hasone->{select:*}}""")
    `);
    const qsql = await q.getSQL();
    expect(qsql).toContain(`FROM (${sql}) as base`);
  });
  test('malloy source code not double-wrapped in parens', async () => {
    const sql = 'SELECT 1 as one';
    const q = runtime.loadQuery(`
      source: hasone is duckdb.sql("${sql}");
      run: duckdb.sql("""SELECT one as num FROM (%{hasone->{select:*}})""")
    `);
    const qsql = await q.getSQL();
    expect(qsql).toContain(`FROM (${sql}) as base`);
  });
});

describe('source interpolation', () => {
  test('sql source in interpolation', async () => {
    const q = runtime.loadQuery(`
      source: sql_src is duckdb.sql("SELECT 1 as one")
      run: duckdb.sql("""SELECT one FROM %{ sql_src }""") -> { select: * }
    `);
    const result = await q.run();
    expect(result.data.value[0]['one']).toBe(1);
  });

  test('query source in interpolation', async () => {
    const q = runtime.loadQuery(`
      source: query_src is duckdb.sql("SELECT 1 as one") -> { select: * }
      run: duckdb.sql("""SELECT one FROM %{ query_src }""") -> { select: * }
    `);
    const result = await q.run();
    expect(result.data.value[0]['one']).toBe(1);
  });
});

afterAll(async () => {
  await runtime.connection.close();
});
