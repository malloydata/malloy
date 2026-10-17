/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The headless single-value formatters. This project runs in plain Node with
// no DOM setup, so these passing is also the proof that ./format needs none.

import {parseAnnotation} from '@malloydata/malloy-tag';
import {
  NULL_SYMBOL,
  columnCellFormat,
  formatDateTime,
  formatNumber,
  resolveCellFormat,
} from './index';

const fmt = (annotation: string, opts: {isTime?: boolean} = {}) =>
  resolveCellFormat(parseAnnotation(`${annotation}\n`).tag, opts);

describe('resolveCellFormat', () => {
  test('currency shorthand', () => {
    expect(fmt('# currency=usd0k')).toEqual({
      mode: 'currency',
      currency: {symbol: '$', scale: 'k', decimals: 0, suffixFormat: 'lower'},
    });
  });

  test('percent and duration', () => {
    expect(fmt('# percent')).toEqual({mode: 'percent'});
    expect(fmt('# duration=minutes { terse }')).toEqual({
      mode: 'duration',
      duration: {unit: 'minutes', terse: true},
    });
  });

  test('# number is a date pattern only on a time field', () => {
    expect(fmt('# number="mmm yyyy"', {isTime: true})).toEqual({
      mode: 'dateFormat',
      formatString: 'mmm yyyy',
    });
    expect(fmt('# number="#,##0"')).toEqual({
      mode: 'number',
      number: {formatString: '#,##0'},
    });
  });

  test('no format tag → default; other tags are ignored', () => {
    expect(fmt('# label="Sales" bar_chart')).toEqual({mode: 'default'});
  });

  test('the config is plain data — it survives JSON', () => {
    const config = fmt('# currency { scale=m decimals=1 suffix=word }');
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });
});

describe('formatNumber', () => {
  test('currency', () => {
    expect(formatNumber(521034.77, fmt('# currency=usd0k'))).toBe('$521k');
    expect(formatNumber(521034.77, fmt('# currency=usd'))).toBe('$521,034.77');
    expect(formatNumber(1234.5, fmt('# currency=eur0'))).toBe('€1,235');
  });

  test('percent', () => {
    expect(formatNumber(0.1234, fmt('# percent'))).toBe('12.34%');
  });

  test('number shorthand and ssf patterns', () => {
    expect(formatNumber(1234567, fmt('# number=1m'))).toBe('1.2m');
    expect(formatNumber(1234567.891, fmt('# number="#,##0.0"'))).toBe(
      '1,234,567.9'
    );
    expect(formatNumber(12345, fmt('# number=id'))).toBe('12345');
  });

  test('duration', () => {
    expect(formatNumber(3725, fmt('# duration=seconds'))).toBe(
      '1 hour 2 minutes'
    );
  });

  test('a digit string (bigint) keeps its precision', () => {
    expect(formatNumber('9007199254740993')).toBe('9,007,199,254,740,993');
    expect(formatNumber('9007199254740993', fmt('# currency=usd0'))).toBe(
      '$9,007,199,254,740,993'
    );
  });

  test('no format, and null', () => {
    expect(formatNumber(1234.5)).toBe((1234.5).toLocaleString());
    expect(formatNumber(null, fmt('# currency=usd0k'))).toBe(NULL_SYMBOL);
  });
});

describe('formatDateTime', () => {
  // Midnight UTC on the 1st: the case that printed as the previous month on
  // any host west of UTC when ssf read the Date's local fields. jest.config.ts
  // pins TZ=America/Los_Angeles, which is exactly that host.
  const sep1 = new Date(Date.UTC(2026, 8, 1));
  const monthYear = fmt('# number="mmm yyyy"', {isTime: true});

  test('a date pattern reads the UTC calendar, whatever the host zone', () => {
    expect(formatDateTime(sep1, monthYear)).toBe('Sep 2026');
    expect(formatDateTime(sep1, monthYear, {isDate: true})).toBe('Sep 2026');
  });

  test("a timestamp's date pattern reads in the query's timezone", () => {
    expect(
      formatDateTime(sep1, monthYear, {timezone: 'America/Los_Angeles'})
    ).toBe('Aug 2026');
    const hm = fmt('# number="yyyy-mm-dd hh:mm"', {isTime: true});
    expect(formatDateTime(sep1, hm, {timezone: 'Asia/Tokyo'})).toBe(
      '2026-09-01 09:00'
    );
    expect(formatDateTime(sep1, hm)).toBe('2026-09-01 00:00');
  });

  test('a date ignores the timezone', () => {
    expect(
      formatDateTime(sep1, monthYear, {
        isDate: true,
        timezone: 'America/Los_Angeles',
      })
    ).toBe('Sep 2026');
  });

  test('no pattern: the timeframe sets the grain', () => {
    expect(formatDateTime(sep1, undefined, {timeframe: 'month'})).toBe(
      '2026-09'
    );
    expect(formatDateTime(sep1, undefined, {isDate: true})).toBe('2026-09-01');
  });

  test('null', () => {
    expect(formatDateTime(null)).toBe(NULL_SYMBOL);
  });
});

describe('columnCellFormat: cents by column', () => {
  const inColumn = (annotation: string, column: {min?: number; max?: number}) =>
    columnCellFormat(fmt(annotation), column);
  const show = (annotation: string, min: number, max: number, v: number) =>
    formatNumber(v, inColumn(annotation, {min, max}));

  test('a column of values under 100 keeps cents', () => {
    expect(show('# currency', 0.35, 42.5, 9.99)).toBe('$9.99');
    expect(show('# currency', 0.35, 42.5, 0.35)).toBe('$0.35');
  });

  test('a column with any value of 100 or more drops cents', () => {
    expect(show('# currency', 3, 1250000, 1250000)).toBe('$1,250,000');
    expect(show('# currency', 3, 1250000, 42.5)).toBe('$43');
    expect(show('# currency', 3, 100, 99.5)).toBe('$100');
  });

  test('size, not sign, decides: a large loss drops cents', () => {
    expect(show('# currency', -150, 20, -150)).toBe('-$150');
  });

  test('other currencies follow the same rule', () => {
    expect(show('# currency=eur', 1, 2000, 2000)).toBe('€2,000');
    expect(show('# currency=usd', 1, 50, 12.5)).toBe('$12.50');
  });

  test("an author's own decimals or scale are kept", () => {
    expect(show('# currency=usd2', 3, 1250000, 1250000)).toBe('$1,250,000.00');
    expect(show('# currency { decimals=0 }', 0.1, 5, 4.75)).toBe('$5');
    expect(show('# currency=usd0k', 3, 1250000, 1250000)).toBe('$1,250k');
  });

  test('an unknown range, or a non-currency format, is unchanged', () => {
    const currency = fmt('# currency');
    expect(columnCellFormat(currency, {})).toBe(currency);
    const percent = fmt('# percent');
    expect(columnCellFormat(percent, {min: 0, max: 500})).toBe(percent);
  });
});
