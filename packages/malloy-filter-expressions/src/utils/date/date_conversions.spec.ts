/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import {
  addDays,
  dateToFilterDateTimeModel,
  filterDateTimeModelToDate,
  clearTimeFilterDateTimeModel,
  hasTimeFilterDateTimeModel,
} from './date_conversions';

describe('dateToFilterDateTimeModel', () => {
  it('correctly converts native dates to the filter model', () => {
    expect(
      dateToFilterDateTimeModel(new Date(1803, 3, 30, 12, 23, 34))
    ).toEqual({
      year: 1803,
      month: 4,
      day: 30,
      hour: 12,
      minute: 23,
      second: 34,
    });
  });
});

describe('filterDateTimeModelToDate', () => {
  it('correctly converts a filter model to native date', () => {
    const date = new Date(1861, 3, 12, 15, 16, 17);
    expect(
      filterDateTimeModelToDate({
        year: 1861,
        month: 4,
        day: 12,
        hour: 15,
        minute: 16,
        second: 17,
      })
    ).toEqual(date);
  });
});

describe('addDays', () => {
  it('correctly adds the appropriate number of days to the parameter', () => {
    const date = new Date(1914, 6, 28);
    expect(addDays(date, 9166)).toEqual(new Date(1939, 8, 1));
  });

  it('correctly subtracts the appropriate number of days from the parameter', () => {
    const date = new Date(1941, 11, 7);
    expect(addDays(date, -828)).toEqual(new Date(1939, 8, 1));
  });
});

describe('clearTimeFilterDateTimeModel', () => {
  it('correctly removes time part from filter datetime model', () => {
    const date = clearTimeFilterDateTimeModel({
      year: 1,
      month: 2,
      day: 3,
      hour: 4,
      minute: 5,
      second: 6,
    });
    expect(date).toEqual({year: 1, month: 2, day: 3});
  });
});

describe('hasTimeFilterDateTimeModel', () => {
  it('returns true for model with time part', () => {
    expect(
      hasTimeFilterDateTimeModel({
        year: 1,
        month: 2,
        day: 3,
        hour: 4,
        minute: 5,
        second: 6,
      })
    ).toBe(true);
  });

  it('returns false for model without time part', () => {
    expect(
      hasTimeFilterDateTimeModel({
        year: 1,
        month: 2,
        day: 3,
      })
    ).toBe(false);
  });
});
