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
import {FilterDateTimeModel, FilterModel} from '../../types';
import {
  clearTimeFilterDateTimeModel,
  dateToFilterDateTimeModel,
} from './date_conversions';

export const sanitizeDate = (item: FilterModel) => {
  const dateItem: FilterDateTimeModel = dateToFilterDateTimeModel(
    new Date(Date.now())
  );
  const {
    id = '0',
    is = true,
    type,
    unit,
    value,
    range = 'relative',
    date = {...dateItem},
    year = dateItem.year,
    month = dateItem.month,
    start = dateItem,
    end = dateItem,
    startInterval,
    endInterval,
    intervalType,
  } = item;
  const interval = {unit: 'month', value: 3};

  switch (type) {
    case 'past':
      return {id, is, type, unit: unit || 'month', value: value || 1};
    case 'this':
    case 'next':
    case 'last':
      return {id, is, type, unit: unit || 'month'};
    case 'anytime':
      return {id, is, type};
    case 'year':
      return {id, is, type, year};
    case 'month':
      return {id, is, type, year, month};
    case 'before':
    case 'after':
      return {
        id,
        is,
        type,
        range,
        unit: unit || 'month',
        value: value || 1,
        date,
      };
    case 'range':
      return {
        id,
        is,
        type,
        start,
        end,
      };
    case 'thisRange':
      return {
        id,
        is,
        type,
        startInterval,
        endInterval,
      };
    case 'on':
      return {id, is, type, date: clearTimeFilterDateTimeModel(date)};
    case 'relative':
      return {
        id,
        is,
        type,
        startInterval: startInterval || interval,
        endInterval: endInterval || interval,
        intervalType: intervalType || 'ago',
      };
    case 'null':
    case 'notnull':
      return {id, is, type};
    default:
      return {...item, type};
  }
};
