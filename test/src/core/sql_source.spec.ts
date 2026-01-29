/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
