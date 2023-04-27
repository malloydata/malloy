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

    describe(`time operations - ${databaseName}`, () => {
      describe(`time difference - ${databaseName}`, () => {
        test('forwards is positive', async () => {
          const eq = sqlEq('day(@2000-01-01 to @2000-01-02)', '1');
          expect(await eq).isSqlEq();
        });
        test('reverse is negative', async () => {
          const eq = sqlEq('day(@2000-01-02 to @2000-01-01)', '-1');
          expect(await eq).isSqlEq();
        });
        test('DATE to TIMESTAMP', async () => {
          const eq = sqlEq('day((@1999)::date to @2000-01-01 00:00:00)', '365');
          expect(await eq).isSqlEq();
        });
        test('TIMESTAMP to DATE', async () => {
          const eq = sqlEq('month(@2000-01-01 to (@1999)::date)', '-12');
          expect(await eq).isSqlEq();
        });
        test('seconds', async () => {
          const eq = sqlEq(
            'seconds(@2001-01-01 00:00:00 to @2001-01-01 00:00:42)',
            '42'
          );
          expect(await eq).isSqlEq();
        });
        test('many seconds', async () => {
          const eq = sqlEq(
            'seconds(@2001-01-01 00:00:00 to @2001-01-02 00:00:42)',
            '86442'
          );
          expect(await eq).isSqlEq();
        });
        test('minutes', async () => {
          const eq = sqlEq(
            'minutes(@2001-01-01 00:00:00 to @2001-01-01 00:42:00)',
            '42'
          );
          expect(await eq).isSqlEq();
        });
        test('many minutes', async () => {
          const eq = sqlEq(
            'minutes(@2001-01-01 00:00:00 to @2001-01-02 00:42:00)',
            '1482'
          );
          expect(await eq).isSqlEq();
        });

        test('hours', async () => {
          const eq = sqlEq(
            'hours(@2001-01-01 00:00:00 to @2001-01-02 18:00:00)',
            '42'
          );
          expect(await eq).isSqlEq();
        });
        test('days', async () => {
          const eq = sqlEq('days(@2001-01-01 to @2001-02-12)', '42');
          expect(await eq).isSqlEq();
        });
        test('weeks', async () => {
          const eq = sqlEq('weeks(@2001-01-01 to @2001-10-27)', '42');
          expect(await eq).isSqlEq();
        });
        test('quarters', async () => {
          const eq = sqlEq('quarters(@2001-01-01 to @2011-09-30)', '42');
          expect(await eq).isSqlEq();
        });
        test('months', async () => {
          const eq = sqlEq('months(@2000-01-01 to @2003-07-01)', '42');
          expect(await eq).isSqlEq();
        });
        test('years', async () => {
          const eq = sqlEq('year(@2000 to @2042)', '42');
          expect(await eq).isSqlEq();
        });
      });

      describe(`timestamp truncation - ${databaseName}`, () => {
        // 2021-02-24 03:05:06
        test(`trunc second - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.second', '@2021-02-24 03:05:06');
          expect(await eq).isSqlEq();
        });

        test(`trunc minute - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.minute', '@2021-02-24 03:05:00');
          expect(await eq).isSqlEq();
        });

        test(`trunc hour - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.hour', '@2021-02-24 03:00:00');
          expect(await eq).isSqlEq();
        });

        test(`trunc day - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.day', '@2021-02-24 00:00:00');
          expect(await eq).isSqlEq();
        });

        test(`trunc week - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.week', '@2021-02-21 00:00:00');
          expect(await eq).isSqlEq();
        });

        test(`trunc month - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.month', '@2021-02-01 00:00:00');
          expect(await eq).isSqlEq();
        });

        test(`trunc quarter - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.quarter', '@2021-01-01 00:00:00');
          expect(await eq).isSqlEq();
        });

        test(`trunc year - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp.year', '@2021-01-01 00:00:00');
          expect(await eq).isSqlEq();
        });
      });
      describe(`now - ${databaseName}`, () => {
        test(`generate the current timestamp - ${databaseName}`, async () => {
          const eq = sqlEq('now + 30 days - 30 days', 'now');
          expect(await eq).isSqlEq();
        });
      });
      describe(`timestamp extraction - ${databaseName}`, () => {
        // 2021-02-24 03:05:06
        test(`extract second - ${databaseName}`, async () => {
          const eq = sqlEq('second(t_timestamp)', '6');
          expect(await eq).isSqlEq();
        });
        test(`extract minute - ${databaseName}`, async () => {
          const eq = sqlEq('minute(t_timestamp)', '5');
          expect(await eq).isSqlEq();
        });
        test(`extract hour - ${databaseName}`, async () => {
          const eq = sqlEq('hour(t_timestamp)', '3');
          expect(await eq).isSqlEq();
        });
        test(`extract day - ${databaseName}`, async () => {
          const eq = sqlEq('day(t_timestamp)', '24');
          expect(await eq).isSqlEq();
        });
        test(`extract day_of_week - ${databaseName}`, async () => {
          const eq = sqlEq('day_of_week(t_timestamp)', '4');
          expect(await eq).isSqlEq();
        });
        test(`first week day is one  - ${databaseName}`, async () => {
          const eq = sqlEq('day_of_week(t_timestamp.week)', '1');
          expect(await eq).isSqlEq();
        });
        test(`extract day_of_year - ${databaseName}`, async () => {
          const eq = sqlEq('day_of_year(t_timestamp)', '55');
          expect(await eq).isSqlEq();
        });
        test(`extract week - ${databaseName}`, async () => {
          const eq = sqlEq('week(t_timestamp)', '8');
          expect(await eq).isSqlEq();
        });
        test(`extract month - ${databaseName}`, async () => {
          const eq = sqlEq('month(t_timestamp)', '2');
          expect(await eq).isSqlEq();
        });
        test(`extract quarter - ${databaseName}`, async () => {
          const eq = sqlEq('quarter(t_timestamp)', '1');
          expect(await eq).isSqlEq();
        });
        test(`extract year - ${databaseName}`, async () => {
          const eq = sqlEq('year(t_timestamp)', '2021');
          expect(await eq).isSqlEq();
        });
      });

      describe(`date truncation - ${databaseName}`, () => {
        test(`date trunc day - ${databaseName}`, async () => {
          const eq = sqlEq('t_date.day', '@2021-02-24');
          expect(await eq).isSqlEq();
        });

        test(`date trunc week - ${databaseName}`, async () => {
          const eq = sqlEq('t_date.week', '@2021-02-21');
          expect(await eq).isSqlEq();
        });

        test(`date trunc month - ${databaseName}`, async () => {
          const eq = sqlEq('t_date.month', '@2021-02-01');
          expect(await eq).isSqlEq();
        });

        test(`date trunc quarter - ${databaseName}`, async () => {
          const eq = sqlEq('t_date.quarter', '@2021-01-01');
          expect(await eq).isSqlEq();
        });

        test(`date trunc year - ${databaseName}`, async () => {
          const eq = sqlEq('t_date.year', '@2021');
          expect(await eq).isSqlEq();
        });
      });

      describe(`date extraction - ${databaseName}`, () => {
        test(`date extract day - ${databaseName}`, async () => {
          const eq = sqlEq('day(t_date)', '24');
          expect(await eq).isSqlEq();
        });
        test(`date extract day_of_week - ${databaseName}`, async () => {
          const eq = sqlEq('day_of_week(t_date)', '4');
          expect(await eq).isSqlEq();
        });
        test(`date extract day_of_year - ${databaseName}`, async () => {
          const eq = sqlEq('day_of_year(t_date)', '55');
          expect(await eq).isSqlEq();
        });
        test(`date extract week - ${databaseName}`, async () => {
          const eq = sqlEq('week(t_date)', '8');
          expect(await eq).isSqlEq();
        });
        test(`date extract month - ${databaseName}`, async () => {
          const eq = sqlEq('month(t_date)', '2');
          expect(await eq).isSqlEq();
        });
        test(`date extract quarter - ${databaseName}`, async () => {
          const eq = sqlEq('quarter(t_date)', '1');
          expect(await eq).isSqlEq();
        });
        test(`date extract year - ${databaseName}`, async () => {
          const eq = sqlEq('year(t_date)', '2021');
          expect(await eq).isSqlEq();
        });
      });
      describe(`delta - ${databaseName}`, () => {
        test(`timestamp delta second - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp + 10 seconds', '@2021-02-24 03:05:16');
          expect(await eq).isSqlEq();
        });
        test(`timestamp delta negative second - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp - 6 seconds', '@2021-02-24 03:05:00');
          expect(await eq).isSqlEq();
        });
        test(`timestamp delta minute - ${databaseName}`, async () => {
          const eq = sqlEq('t_timestamp + 10 minutes', '@2021-02-24 03:15:06');
          expect(await eq).isSqlEq();
        });
        test(`timestamp delta hours - ${databaseName}`, async () => {
          const eq = await sqlEq(
            't_timestamp + 10 hours',
            '@2021-02-24 13:05:06'
          );
          expect(eq).isSqlEq();
        });
        test(`timestamp delta week - ${databaseName}`, async () => {
          const eq = sqlEq('(t_timestamp - 2 weeks)::date', '@2021-02-10');
          expect(await eq).isSqlEq();
        });
        test(`timestamp delta month - ${databaseName}`, async () => {
          const eq = sqlEq('(t_timestamp + 9 months)::date', '@2021-11-24');
          expect(await eq).isSqlEq();
        });
        test(`timestamp delta quarter - ${databaseName}`, async () => {
          const eq = sqlEq('(t_timestamp + 2 quarters)::date', '@2021-08-24');
          expect(await eq).isSqlEq();
        });
        test(`timestamp delta year - ${databaseName}`, async () => {
          const eq = sqlEq('(t_timestamp + 10 years)::date', '@2031-02-24');
          expect(await eq).isSqlEq();
        });
        test(`date delta second - ${databaseName}`, async () => {
          const eq = sqlEq('t_date + 10 seconds', '@2021-02-24 00:00:10');
          expect(await eq).isSqlEq();
        });
        test(`date delta minute - ${databaseName}`, async () => {
          const eq = sqlEq('t_date + 10 minutes', '@2021-02-24 00:10:00');
          expect(await eq).isSqlEq();
        });
        test(`date delta hours - ${databaseName}`, async () => {
          const eq = sqlEq('t_date + 10 hours', '@2021-02-24 10:00:00');
          expect(await eq).isSqlEq();
        });
        test(`date delta week - ${databaseName}`, async () => {
          const eq = sqlEq('t_date - 2 weeks', '@2021-02-10');
          expect(await eq).isSqlEq();
        });
        test(`date delta month - ${databaseName}`, async () => {
          const eq = sqlEq('t_date + 9 months', '@2021-11-24');
          expect(await eq).isSqlEq();
        });
        test(`date delta quarter - ${databaseName}`, async () => {
          const eq = sqlEq('t_date + 2 quarters', '@2021-08-24');
          expect(await eq).isSqlEq();
        });
        test(`date delta year - ${databaseName}`, async () => {
          const eq = sqlEq('t_date + 10 years', '@2031-02-24');
          expect(await eq).isSqlEq();
        });
      });
      describe(`to range edge tests - ${databaseName}`, () => {
        describe(`${databaseName} date`, () => {
          test(`before to is outside - ${databaseName}`, async () => {
            const eq = sqlEq('t_date ? @2021-02-25 to @2021-03-01', false);
            expect(await eq).isSqlEq();
          });
          test(`first to is inside - ${databaseName}`, async () => {
            const eq = sqlEq('t_date ? @2021-02-24 to @2021-03-01', true);
            expect(await eq).isSqlEq();
          });
          test(`last to is outside - ${databaseName}`, async () => {
            const eq = sqlEq('t_date ? @2021-02-01 to @2021-02-24', false);
            expect(await eq).isSqlEq();
          });
        });
        describe(`${databaseName} timestamp`, () => {
          test(`before to is outside - ${databaseName}`, async () => {
            const eq = sqlEq(
              't_timestamp ? @2021-02-25 00:00:00 to @2021-02-26 00:00:00',
              false
            );
            expect(await eq).isSqlEq();
          });
          test(`first to is inside - ${databaseName}`, async () => {
            const eq = sqlEq(
              't_timestamp ? @2021-02-24 03:04:05 to @2021-02-26 00:00:00',
              true
            );
            expect(await eq).isSqlEq();
          });
          test(`last to is outside - ${databaseName}`, async () => {
            const eq = sqlEq(
              't_timestamp ? @2021-02-24 00:00:00 to @2021-02-24 03:05:06',
              false
            );
            expect(await eq).isSqlEq();
          });
        });
      });

      describe(`for range edge tests - ${databaseName}`, () => {
        describe(`${databaseName} date`, () => {
          test(`before for-range is outside - ${databaseName}`, async () => {
            const eq = sqlEq('t_date ? @2021-02-25 for 1 day', false);
            expect(await eq).isSqlEq();
          });
          test(`first for-range is inside - ${databaseName}`, async () => {
            const eq = sqlEq('t_date ? @2021-02-24 for 1 day', true);
            expect(await eq).isSqlEq();
          });
          test(`last for-range is outside - ${databaseName}`, async () => {
            const eq = sqlEq('t_date ? @2021-02-23 for 1 day', false);
            expect(await eq).isSqlEq();
          });
        });
        describe(`${databaseName} timestamp`, () => {
          test(`before for-range is outside - ${databaseName}`, async () => {
            const eq = sqlEq(
              't_timestamp ? @2021-02-25 00:00:00 for 1 day',
              false
            );
            expect(await eq).isSqlEq();
          });
          test(`first for-range is inside - ${databaseName}`, async () => {
            const eq = sqlEq(
              't_timestamp ? @2021-02-24 03:04:05 for 1 day',
              true
            );
            expect(await eq).isSqlEq();
          });
          test(`last for-range is outside - ${databaseName}`, async () => {
            const eq = sqlEq(
              't_timestamp ? @2021-02-23 03:05:06 for 1 day',
              false
            );
            expect(await eq).isSqlEq();
          });
        });
      });

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
                test.todo(
                  `granular ${checkType} ? ${beginType} for ${unitType}`
                );
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
