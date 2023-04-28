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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/* eslint-disable no-console */

import '../../util/db-jest-matchers';
import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable, mkSqlEqWith} from '../../util';

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const basicTypes: Record<string, string> = {
  bigquery: `
    SELECT * FROM UNNEST([STRUCT(
      CAST('2021-02-24' as DATE) as t_date,
      CAST('2021-02-24 03:05:06' as TIMESTAMP) as t_timestamp
    )])`,
  postgres: `
    SELECT
      DATE('2021-02-24') as t_date,
      '2021-02-24 03:05:06'::timestamp with time zone as t_timestamp
  `,
};

const [describe, databases] = describeIfDatabaseAvailable([
  'bigquery',
  'postgres',
]);

describe('Datetimes', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    const sqlEq = mkSqlEqWith(runtime, {sql: basicTypes[databaseName]});

    test(`date in sql_block no explore- ${databaseName}`, async () => {
      const eq = sqlEq('t_date', '@2021-02-24');
      expect(await eq).isSqlEq();
    });

    test(`timestamp in sql_block no explore- ${databaseName}`, async () => {
      const eq = sqlEq('t_timestamp', '@2021-02-24 03:05:06');
      expect(await eq).isSqlEq();
    });

    test(`valid timestamp without seconds - ${databaseName}`, async () => {
      // discovered this writing tests ...
      const eq = sqlEq('year(@2000-01-01 00:00)', '2000');
      expect(await eq).isSqlEq();
    });

    // mtoy todo catch these in the compiler ... or implement
    // describe(`time operations - ${databaseName}`, () => {
    //   describe(`time difference - ${databaseName}`, () => {
    //     test('DATE to TIMESTAMP', async () => {
    //       const eq = sqlEq('day((@1999)::date to @2000-01-01 00:00:00)', '365');
    //       expect(await eq).isSqlEq();
    //     });
    //     test('TIMESTAMP to DATE', async () => {
    //       const eq = sqlEq('month(@2000-01-01 to (@1999)::date)', '-12');
    //       expect(await eq).isSqlEq();
    //     });
    //   });
    // });

    describe(`granular time range checks - ${databaseName}`, () => {
      test('date = timestamp.ymd', async () => {
        const eq = sqlEq('t_date ? t_timestamp.month', true);
        expect(await eq).isSqlEq();
      });
      test('date = timestamp.hms', async () => {
        const eq = sqlEq('t_date ? t_timestamp.hour', false);
        expect(await eq).isSqlEq();
      });

      test('date = literal.ymd', async () => {
        const eq = sqlEq('t_date ? @2021-02-24.week', true);
        expect(await eq).isSqlEq();
      });

      test('date = literal.hms', async () => {
        const eq = sqlEq('t_date ? @2021-02-24.hour', false);
        expect(await eq).isSqlEq();
      });
      /*
       * Here is the matrix of all possible tests, I don't know that we need
       * this entire list, there may be coverage of all code with fewer tests.
       *
       * I also don't know how to test these. As I was writing the code I
       * had worried and wanted tests to cover my worry, but now I don't
       * even know what I was worried about
       *
       * I think the general worry is that we generate the correct expression
       * given the large matrix of possible type combinations.
       *
       * So the first question is, what combinations require casting that
       * would fail if the casting didn't happen, make sure those
       * tests exist.
       *
       */
      for (const checkType of ['date', 'timestamp', 'literal']) {
        for (const beginType of ['date', 'timestamp', 'literal']) {
          for (const unitType of ['date', 'timestasmp']) {
            if (checkType !== unitType) {
              test.todo(`granular ${checkType} ? ${beginType}.${unitType}`);
              test.todo(`granular ${checkType} ? ${beginType} for ${unitType}`);
            }
          }
          for (const endType of ['date', 'timestasmp', 'literal']) {
            if (checkType !== beginType || beginType !== endType) {
              test.todo(`granular ${checkType} ? ${beginType} to ${endType}`);
            }
          }
        }
      }
    });

    describe(`join object - ${databaseName}`, () => {
      it(`dependant join dialect fragments- ${databaseName}`, async () => {
        const result = await runtime
          .loadQuery(
            `
        sql: one is {select:"""${basicTypes[databaseName]}"""}

        source: main is from_sql(one) {
          join_one: joined is from_sql(one) on t_date = joined.t_date
        }

        query: main -> {
          group_by: t_month is joined.t_timestamp.month
        }
        `
          )
          .run();
        expect(result.data.path(0, 't_month').value).toEqual(
          new Date('2021-02-01')
        );
      });
    });
  });
});
