/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The headless single-value formatters. This project runs in plain Node with
// no DOM setup, so these passing is also the proof that ./format needs none.

import {parseAnnotation} from '@malloydata/malloy-tag';
import {
  NULL_SYMBOL,
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
  // any host west of UTC when ssf read the Date's local fields. This suite is
  // also run under TZ=America/Los_Angeles and TZ=Asia/Tokyo.
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
