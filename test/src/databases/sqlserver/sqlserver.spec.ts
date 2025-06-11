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
import type {AtomicField, Runtime} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '../../util';
import '../../util/db-jest-matchers';
import {DateTime} from 'luxon';

const [describe] = describeIfDatabaseAvailable(['sqlserver']);

describe('SQL Server tests', () => {
  const runtimeList = new RuntimeList(['sqlserver']);
  const runtime = runtimeList.runtimeMap.get('sqlserver');
  if (runtime === undefined) {
    throw new Error("Couldn't build runtime");
  }

  // Idempotently create schema and tables with capital letters ans spaces.
  // TODO (vitor): (malloy): Discuss collation and spaces allowed in schema/tables/columns
  beforeAll(async () => {
    await runtime.connection.runSQL(
      `
      IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Spaced Schema')
      BEGIN
        EXEC('CREATE SCHEMA [Spaced Schema]')
      END;
      `
    );
    await Promise.all([
      runtime.connection.runSQL(
        `
        IF NOT EXISTS (
          SELECT * FROM sys.tables
          WHERE name = 'Spaced Schema Spaced Table'
            AND schema_id = SCHEMA_ID('Spaced Schema')
        )
        BEGIN
          SELECT 1 AS one
          INTO [Spaced Schema].[Spaced Schema Spaced Table];
        END;
        `
      ),
      runtime.connection.runSQL(
        `
        IF NOT EXISTS (
          SELECT * FROM sys.tables
          WHERE name = 'Dbo Spaced Table'
            AND schema_id = SCHEMA_ID('dbo')
        )
        BEGIN
          SELECT 1 AS one
          INTO [Dbo Spaced Table];
        END;
        `
      ),
    ]);
  });

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  it('runs an sql query', async () => {
    await expect(
      `##! experimental.dialect.tsql
      run: sqlserver.sql("SELECT 1 as n") -> { select: n }`
    ).malloyResultMatches(runtime, {n: 1});
  });

  it('retains spaces in result', async () => {
    await expect(`
      ##! experimental.dialect.tsql
      run: sqlserver.sql('SELECT 1 as [upperLower]') -> { select: upperLower }
    `).malloyResultMatches(runtime, {upperLower: 1});
  });

  it('fields which are sql keywords are bracketed', async () => {
    await expect(`
    ##! experimental.dialect.tsql
    run: sqlserver.sql('SELECT 1 as [select]') -> {
      select:
        select
        create is select + 1
    }
  `).malloyResultMatches(runtime, {select: 1, create: 2});
  });

  async function oneExists(rt: Runtime, tn: string): Promise<boolean> {
    try {
      const lookForOne = await rt
        .loadQuery(
          `
          ##! experimental.dialect.tsql
          run:
          sqlserver.sql('SELECT one FROM ${tn}')
        `
        )
        .run();
      const one = lookForOne.data.path(0, 'one').value;
      return one === 1;
    } catch (e) {
      return false;
    }
  }

  it('will bracket to properly access mixed case table name', async () => {
    if (await oneExists(runtime, 'dbo.[Dbo Spaced Table]')) {
      await expect(`
        ##! experimental.dialect.tsql
        run:
        sqlserver.table('dbo.\`Dbo Spaced Table\`') -> { select: one }
      `).malloyResultMatches(runtime, {one: 1});
    }
  });

  it('quote to properly access mixes case schema name', async () => {
    if (
      await oneExists(runtime, '[Spaced Schema].[Spaced Schema Spaced Table]')
    ) {
      await expect(`
        ##! experimental.dialect.tsql
        run: sqlserver.table('\`Spaced Schema\`.\`Spaced Schema Spaced Table\`') -> { select: one }
      `).malloyResultMatches(runtime, {one: 1});
    }
  });

  it('passes unsupported data', async () => {
    const result = await runtime
      .loadQuery(
        `
        ##! experimental.dialect.tsql
        run: sqlserver.sql("SELECT CAST('10,20' AS VARCHAR) as ranger")
        `
      )
      .run();
    expect(result.data.value[0]['ranger']).toBeDefined();
  });

  it('supports varchars with parameters', async () => {
    await expect(
      `
      ##! experimental.dialect.tsql
      run: sqlserver.sql("SELECT CAST('a' AS VARCHAR) as abc, CAST('a3' AS VARCHAR(3)) as abc3")
      `
    ).malloyResultMatches(runtime, {abc: 'a', abc3: 'a3'});
  });

  describe('time', () => {
    // https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-configure-time-zone?view=sql-server-ver16
    const [zone, msZone] = [
      'America/Mexico_City',
      'Central Standard Time (Mexico)',
    ]; // -06:00 no DST
    const zone_2020 = DateTime.fromObject(
      {
        year: 2020,
        month: 2,
        day: 20,
        hour: 0,
        minute: 0,
        second: 0,
      },
      {
        zone,
      }
    );

    // TODO (vitor): Remove this comment. Remember not to add ; to the end of queries
    test('can cast DATETIMEOFFSET to timestamp', async () => {
      await expect(
        `
        ##! experimental.dialect.tsql
        run: sqlserver.sql("""
              SELECT CAST('2020-02-20 00:00:00' AS DATETIME2) AT TIME ZONE '${msZone}' AS t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`
      ).malloyResultMatches(runtime, {mex_220: zone_2020.toJSDate()});
    });
  });

  // TODO (vitor): Support BIGINT. For this reason there is no support to BIGINT for now: https://github.com/tediousjs/node-mssql/issues/187
  describe('numbers', () => {
    it.each(['SMALLINT', 'INT', 'DECIMAL', 'NUMERIC', 'REAL', 'FLOAT'])(
      'supports %s',
      async sqlType => {
        const result = await runtime
          .loadQuery(
            `
          ##! experimental.dialect.tsql
          run: sqlserver.sql("SELECT CAST(10 AS ${sqlType}) as d")
          `
          )
          .run();
        const field = result.data.field.allFields[0];
        expect(field.isAtomicField()).toBe(true);
        expect((field as AtomicField).isNumber()).toBe(true);
        expect(result.data.value[0]['d']).toEqual(10);
      }
    );
  });
});
