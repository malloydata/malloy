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

import {DateObjectUnits, DateTime as LuxonDateTime} from 'luxon';
import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
const runtimes = new RuntimeList(databases);

afterAll(async () => {
  await runtimes.closeAll();
});

function dt(...parts: number[]): LuxonDateTime {
  const units: DateObjectUnits = {};
  ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'].forEach(
    (unit, index) => {
      if (parts[index] !== undefined) {
        units[unit] = parts[index];
      }
    }
  );
  return LuxonDateTime.fromObject(units, {zone: 'UTC'});
}
const js_when = dt(2020, 1, 2, 3, 4, 5, 6);
const txt_when = '2020-01-02 03:04:05.006';

describe('time specific tests for standardsql', () => {
  const bq = runtimes.runtimeMap.get('bigquery')!;

  const times = bq.loadModel(`
    source: times is biogquery.sql("""SELECT
      DATE '${txt_when.slice(0, 10)}' as t_date,
      DATETIME '${txt_when}' as t_datetime,
      TIMESTAMP '${txt_when}' as t_timestamp
    """)
  `);
  test('datetime is a supported type', async () => {
    await expect(
      `run: times -> { select: ok is t_datetime = @${txt_when} }`
    ).malloyResultMatches(times, {ok: true});
  });
  test('timestamp with full resolution', async () => {
    await expect('run: times->{select: t_timestamp}').malloyResultMatches(
      times,
      {t_timestamp: js_when}
    );
  });
  test('datetime with full resolution', async () => {
    await expect('run: times->{select: t_datetime}').malloyResultMatches(
      times,
      {t_datetime: js_when}
    );
  });
  describe.each(['datetime', 'timestamp'])('extraction', (ttyp: string) => {
    function extract(typ: string, unit: string): string {
      return `run: times->{ select: unit_${unit} is ${unit}(t_${typ}) }`;
    }
    test(`year(${ttyp})`, async () =>
      await expect(extract(ttyp, 'year')).malloyResultMatches(times, {
        unit_year: 2020,
      }));
    test(`month(${ttyp})`, async () =>
      await expect(extract(ttyp, 'month')).malloyResultMatches(times, {
        unit_month: 1,
      }));
    test(`day(${ttyp})`, async () =>
      await expect(extract(ttyp, 'day')).malloyResultMatches(times, {
        unit_day: 2,
      }));
    test(`hour(${ttyp})`, async () =>
      await expect(extract(ttyp, 'hour')).malloyResultMatches(times, {
        unit_hour: 3,
      }));
    test(`minute(${ttyp})`, async () =>
      await expect(extract(ttyp, 'minute')).malloyResultMatches(times, {
        unit_minute: 4,
      }));
    test(`second(${ttyp})`, async () =>
      await expect(extract(ttyp, 'second')).malloyResultMatches(times, {
        unit_second: 5,
      }));
    test(`week(${ttyp})`, async () =>
      await expect(extract(ttyp, 'week')).malloyResultMatches(times, {
        unit_week: 0,
      }));
    test(`quarter(${ttyp})`, async () =>
      await expect(extract(ttyp, 'quarter')).malloyResultMatches(times, {
        unit_quarter: 1,
      }));
  });
  describe.each(['datetime', 'timestamp'])('truncation', (ttyp: string) => {
    function trunc(typ: string, unit: string): string {
      return `run: times->{ select: trunc_${unit} is (t_${typ}).${unit} }`;
    }
    test(`year(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'year')).malloyResultMatches(times, {
        trunc_year: dt(2020),
      }));
    test(`month(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'month')).malloyResultMatches(times, {
        trunc_month: dt(2020, 1),
      }));
    test(`day(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'day')).malloyResultMatches(times, {
        trunc_day: dt(2020, 1, 2),
      }));
    test(`hour(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'hour')).malloyResultMatches(times, {
        trunc_hour: dt(2020, 1, 2, 3),
      }));
    test(`minute(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'minute')).malloyResultMatches(times, {
        trunc_minute: dt(2020, 1, 2, 3, 4),
      }));
    test(`second(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'second')).malloyResultMatches(times, {
        trunc_second: dt(2020, 1, 2, 3, 4, 5),
      }));
    test(`week(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'week')).malloyResultMatches(times, {
        trunc_week: dt(2019, 12, 29),
      }));
    test(`quarter(${ttyp})`, async () =>
      await expect(trunc(ttyp, 'quarter')).malloyResultMatches(times, {
        trunc_quarter: dt(2020),
      }));
  });
  describe.each(['datetime', 'timestamp'])('offset', (ttyp: string) => {
    function offset(typ: string, unit: string): string {
      return `run: times->{ select: offset_${unit} is (t_${typ}) + 2 ${unit} }`;
    }
    test(`year(${ttyp})`, async () =>
      await expect(offset(ttyp, 'year')).malloyResultMatches(times, {
        offset_year: dt(2022, 1, 2, 3, 4, 5, 6),
      }));
    test(`month(${ttyp})`, async () =>
      await expect(offset(ttyp, 'month')).malloyResultMatches(times, {
        offset_month: dt(2020, 3, 2, 3, 4, 5, 6),
      }));
    test(`day(${ttyp})`, async () =>
      await expect(offset(ttyp, 'day')).malloyResultMatches(times, {
        offset_day: dt(2020, 1, 4, 3, 4, 5, 6),
      }));
    test(`hour(${ttyp})`, async () =>
      await expect(offset(ttyp, 'hour')).malloyResultMatches(times, {
        offset_hour: dt(2020, 1, 2, 5, 4, 5, 6),
      }));
    test(`minute(${ttyp})`, async () =>
      await expect(offset(ttyp, 'minute')).malloyResultMatches(times, {
        offset_minute: dt(2020, 1, 2, 3, 6, 5, 6),
      }));
    test(`second(${ttyp})`, async () =>
      await expect(offset(ttyp, 'second')).malloyResultMatches(times, {
        offset_second: dt(2020, 1, 2, 3, 4, 7, 6),
      }));
    test(`week(${ttyp})`, async () =>
      await expect(offset(ttyp, 'week')).malloyResultMatches(times, {
        offset_week: dt(2020, 1, 16, 3, 4, 5, 6),
      }));
    test(`quarter(${ttyp})`, async () =>
      await expect(offset(ttyp, 'quarter')).malloyResultMatches(times, {
        offset_quarter: dt(2020, 7, 2, 3, 4, 5, 6),
      }));
  });
  describe.each(['datetime', 'timestamp'])('measure', (ttyp: string) => {
    test(`a to b in ${ttyp}/year`, async () => {
      await expect(
        `run:times->{select: n is years(t_${ttyp} to @2027-01-02 03:04:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/quarter`, async () => {
      await expect(
        `run:times->{select: n is quarters(t_${ttyp} to @2021-09-02 03:04:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/month`, async () => {
      await expect(
        `run:times->{select: n is months(t_${ttyp} to @2020-08-02 03:04:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/week`, async () => {
      await expect(
        `run:times->{select: n is weeks(t_${ttyp} to @2020-02-18 03:04:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/day`, async () => {
      await expect(
        `run:times->{select: n is days(t_${ttyp} to @2020-01-09 03:04:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/hour`, async () => {
      await expect(
        `run:times->{select: n is hours(t_${ttyp} to @2020-01-02 10:04:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/minute`, async () => {
      await expect(
        `run:times->{select: n is minutes(t_${ttyp} to @2020-01-02 03:11:05.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
    test(`a to b in ${ttyp}/second`, async () => {
      await expect(
        `run:times->{select: n is seconds(t_${ttyp} to @2020-01-02 03:04:12.06)}`
      ).malloyResultMatches(times, {n: 7});
    });
  });
});
