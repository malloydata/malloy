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

import {DateTime} from 'luxon';
import {RuntimeList} from '../../runtimes';
import type {Runtime} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['postgres']);

describe('Postgres tests', () => {
  const runtimeList = new RuntimeList(['postgres']);
  const runtime = runtimeList.runtimeMap.get('postgres');
  if (runtime === undefined) {
    throw new Error("Couldn't build runtime");
  }
  const testModel = wrapTestModel(runtime, '');

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

  it('run an sql query', async () => {
    await expect(
      'run: postgres.sql("SELECT 1 as n") -> { select: n }'
    ).toMatchResult(testModel, {n: 1});
  });

  it('mixed case col names are properly quoted so they retain case in results', async () => {
    await expect(`
      run: postgres.sql('SELECT 1 as "upperLower"') -> { select: upperLower }
    `).toMatchResult(testModel, {upperLower: 1});
  });

  it('fields which are sql keywords are quoted', async () => {
    await expect(`
    run: postgres.sql('SELECT 1 as "select"') -> {
      select:
        select
        create is select + 1
    }
  `).toMatchResult(testModel, {select: 1, create: 2});
  });

  async function oneExists(rt: Runtime, tn: string): Promise<boolean> {
    try {
      const lookForOne = await rt
        .loadQuery(`run: postgres.sql('SELECT one FROM ${tn}')`)
        .run();
      const one = lookForOne.data.path(0, 'one').value;
      return one === 1;
    } catch (e) {
      return false;
    }
  }

  it('will quote to properly access mixed case table name', async () => {
    if (await oneExists(runtime, 'public."UpperTablePublic"')) {
      await expect(`
        run: postgres.table('public.UpperTablePublic') -> { select: one }
      `).toMatchResult(testModel, {one: 1});
    }
  });

  it('quote to properly access mixes case schema name', async () => {
    if (await oneExists(runtime, '"UpperSchema"."UpperSchemaUpperTable"')) {
      await expect(`
        run: postgres.table('UpperSchema.UpperSchemaUpperTable') -> { select: one }
      `).toMatchResult(testModel, {one: 1});
    }
  });

  it('passes unsupported data', async () => {
    const result = await runtime
      .loadQuery('run: postgres.sql("SELECT int4range(10, 20) as ranger")')
      .run();
    expect(result.data.value[0]['ranger']).toBeDefined();
  });

  it('supports varchars with parameters', async () => {
    await expect(
      "run: postgres.sql(\"SELECT 'a'::VARCHAR as abc, 'a3'::VARCHAR(3) as abc3\")"
    ).toMatchResult(testModel, {abc: 'a', abc3: 'a3'});
  });

  it('can compute symmetric aggregates on double precisions numbers', async () => {
    await expect(`source: values is postgres.sql("""
        SELECT 1::DOUBLE PRECISION as val, 1 as id
      """) extend { measure: total_value is val.sum() }
    source: thing is postgres.sql(""" SELECT 1 as id """) extend {
      join_one: values on values.id = id
    }
    run: thing -> {
      group_by: id
      aggregate: tenx is 10 * values.total_value
    }
    `).toMatchResult(testModel, {tenx: 10});
  });
  describe('time', () => {
    const zone = 'America/Mexico_City'; // -06:00 no DST
    const zone_2020 = DateTime.fromObject(
      {year: 2020, month: 2, day: 20, hour: 0, minute: 0, second: 0},
      {zone}
    );

    test('can cast TIMESTAMPTZ to timestamp', async () => {
      await expect(
        `run: postgres.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`
      ).toMatchResult(testModel, {mex_220: zone_2020.toJSDate()});
    });
  });
});
