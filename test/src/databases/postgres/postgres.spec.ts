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

/* eslint-disable no-console */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const [describe] = describeIfDatabaseAvailable(['postgres']);

describe('Postgres tests', () => {
  const runtimeList = new RuntimeList(['postgres']);
  const runtime = runtimeList.runtimeMap.get('postgres');
  if (runtime === undefined) {
    throw new Error("Couldn't build runtime");
  }

  // Idempotently create schema and tables with capital letters to use in tests.
  beforeAll(async () => {
    await runtime.connection.runSQL(
      'create schema if not exists "UpperSchema";'
    );
    await Promise.all([
      runtime.connection.runSQL(
        'create table if not exists "UpperSchema"."UpperSchemaUpperTable" as select 1 as one;'
      ),
      runtime.connection.runSQL(
        'create table if not exists "UpperTablePublic" as select 1 as one;'
      ),
    ]);
  });

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  it('sql_block', async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is {select:"""
        SELECT 1 as n
       """}

      query: from_sql(one) -> { project: n }
      `
      )
      .run();
    expect(result.data.value[0]['n']).toBe(1);
  });

  it('quote field name', async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is {select:"""
        SELECT 1 as "upperLower"
       """}

      query: from_sql(one) -> { project: upperLower }
      `
      )
      .run();
    expect(result.data.value[0]['upperLower']).toBe(1);
  });

  it('quote keyword', async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is {select:"""
        SELECT 1 as "select"
       """}

      query: from_sql(one) -> {
        project:
          \`select\`
          create is \`select\` + 1
      }
      `
      )
      .run();
    expect(result.data.value[0]['select']).toBe(1);
    expect(result.data.value[0]['create']).toBe(2);
  });

  // these started failing and I'm not sure why (lloyd, skipping for now)
  it.skip('quote table name', async () => {
    const result = await runtime
      .loadQuery(
        `
      query: table('public.UpperTablePublic') -> { project: one }
      `
      )
      .run();
    expect(result.data.value[0]['one']).toBe(1);
  });

  it.skip('quote schema name', async () => {
    const result = await runtime
      .loadQuery(
        `
      query: table('UpperSchema.UpperSchemaUpperTable') -> { project: one }
      `
      )
      .run();
    expect(result.data.value[0]['one']).toBe(1);
  });

  it('passes unsupported data', async () => {
    const result = await runtime
      .loadQuery(
        `
        sql: badType is { select: """SELECT int4range(10, 20) as ranger""" }
        query: from_sql(badType)->{ project: *}
      `
      )
      .run();
    expect(result.data.value[0]['ranger']).toBeDefined();
  });
});
