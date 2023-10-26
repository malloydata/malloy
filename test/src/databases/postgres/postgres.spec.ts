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
import {AtomicField, Runtime} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '../../util';
import '../../util/db-jest-matchers';
import {DateTime} from 'luxon';

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

  it('run an sql query', async () => {
    await expect(
      'run: postgres.sql("SELECT 1 as n") -> { select: n }'
    ).malloyResultMatches(runtime, {n: 1});
  });

  it('mixed case col names are properly quoted so they retain case in results', async () => {
    await expect(`
      run: postgres.sql('SELECT 1 as "upperLower"') -> { select: upperLower }
    `).malloyResultMatches(runtime, {upperLower: 1});
  });

  it('fields which are sql keywords are quoted', async () => {
    await expect(`
    run: postgres.sql('SELECT 1 as "select"') -> {
      select:
        select
        create is select + 1
    }
  `).malloyResultMatches(runtime, {select: 1, create: 2});
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
      `).malloyResultMatches(runtime, {one: 1});
    }
  });

  it('quote to properly access mixes case schema name', async () => {
    if (await oneExists(runtime, '"UpperSchema"."UpperSchemaUpperTable"')) {
      await expect(`
        run: postgres.table('UpperSchema.UpperSchemaUpperTable') -> { select: one }
      `).malloyResultMatches(runtime, {one: 1});
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
    ).malloyResultMatches(runtime, {abc: 'a', abc3: 'a3'});
  });

  describe('time', () => {
    const zone = 'America/Mexico_City'; // -06:00 no DST
    const zone_2020 = DateTime.fromObject({
      year: 2020,
      month: 2,
      day: 20,
      hour: 0,
      minute: 0,
      second: 0,
      zone,
    });
    test('can cast TIMESTAMPTZ to timestamp', async () => {
      await expect(
        `run: postgres.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`
      ).malloyResultMatches(runtime, {mex_220: zone_2020.toJSDate()});
    });
  });

  describe('numbers', () => {
    it.each([
      'SMALLINT',
      'INTEGER',
      'BIGINT',
      'DECIMAL',
      'NUMERIC',
      'REAL',
      'DOUBLE PRECISION',
    ])('supports %s', async sqlType => {
      const result = await runtime
        .loadQuery(`run: postgres.sql("SELECT 10::${sqlType} as d")`)
        .run();
      const field = result.data.field.allFields[0];
      expect(field.isAtomicField()).toBe(true);
      expect((field as AtomicField).isNumber()).toBe(true);
      expect(result.data.value[0]['d']).toEqual(10);
    });
  });
});
