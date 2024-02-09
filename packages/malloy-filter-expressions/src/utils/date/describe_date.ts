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
import defaultTo from 'lodash/defaultTo';
import {
  FilterExpressionType,
  FilterDateTimeModel,
  FilterModel,
} from '../../types';
import {describeNull} from '../summary/describe_null';
import {convertToNumber} from './convert_to_number';
import {hasTimeFilterDateTimeModel} from './date_conversions';
import {DateFilterItemToStringMapType} from './date_filter_to_string';
import {formatAndDisplayTime, meridiemFrom24HourTime} from './format_time';
import {getMonths} from './get_months';
import {getUnitLabel} from './get_unit_label';
import {isDateTime} from './is_date_time';
import {zeroPad2, zeroPad4} from './zero_pad';

const describeDateTime = (
  date?: FilterDateTimeModel,
  showTime?: boolean
): string => {
  if (!date) return 'Invalid Date';
  const {year, month, day, hour = 0, minute = 0} = date;
  let result = String(zeroPad4(year));
  result += month ? `/${zeroPad2(month)}` : '';
  result += day ? `/${zeroPad2(day)}` : '';
  if (showTime) {
    // convertToNumber is used here because the data represented as hour is not
    // always a number. When the content comes from the URL it is a string and
    // can cause some formatting errors where a time has a leading zero ex 03:00 AM
    // hour.toString() is used to make typescript happy since it assumes the value
    // will always be a number
    result += ` ${formatAndDisplayTime({
      hour: convertToNumber(hour.toString()),
      minute,
      meridiem: meridiemFrom24HourTime(hour),
    })}`;
  }
  return result;
};

const describeInterval = ({value, unit, complete}: FilterModel) => {
  return `${value}${complete ? ' complete' : ''} ${getUnitLabel(unit, value)}`;
};

const describeNotNull = () => {
  return 'is not null';
};

const past = (item: FilterModel) => {
  return `is in the last ${describeInterval(item)}`;
};

const describePastAgo = (item: FilterModel) => {
  return `is ${describeInterval(item)} ago`;
};

const describeTypeAndUnit = ({type, unit}: FilterModel) => {
  const thisText = 'this';
  const nextText = 'next';

  return `is ${type === 'this' ? thisText : nextText} ${getUnitLabel(unit)}`;
};

const describeLast = ({unit}: FilterModel) => {
  return `is previous ${getUnitLabel(unit)}`;
};

const describeYear = ({year}: FilterModel) => {
  return `is in the year ${year}`;
};

const describeMonth = ({month, year}: FilterModel) => {
  return `is in ${getMonths()[parseInt(month, 10) - 1]} ${year}`;
};

const beforeAfter = (item: FilterModel, showTime: boolean) => {
  const {type, range, date, fromnow} = item;
  const prefix = type === 'after' ? 'is on or after' : 'is before';
  if (range === 'absolute') {
    return `${prefix} ${describeDateTime(date, showTime)}`;
  }
  const timePassed = fromnow ? 'from now' : 'ago';
  return item['unit'] === 'now'
    ? `${prefix} now`
    : `${prefix} ${describeInterval(item)} ${timePassed}`;
};

const on = ({date}: FilterModel, showTime: boolean) => {
  return `is on ${describeDateTime(
    date,
    showTime && hasTimeFilterDateTimeModel(date)
  )}`;
};

const describeRange = ({start, end}: FilterModel, showTime: boolean) => {
  return `is from ${describeDateTime(start, showTime)} until ${describeDateTime(
    end,
    showTime
  )}`;
};

const describeThisRange = ({startInterval, endInterval}: FilterModel) => {
  return `this ${startInterval} to ${endInterval}`;
};

const relative = ({startInterval, endInterval, intervalType}: FilterModel) => {
  const agoText = 'ago';
  const fromNowText = 'from now';
  return `is ${describeInterval(startInterval)} ${
    intervalType === 'ago' ? agoText : fromNowText
  } for ${describeInterval(endInterval)}`;
};
const anyvalue = () => {
  return 'is any time';
};

const describeDay = ({day}: FilterModel) => {
  return `is ${day}`;
};

const filterToStringMap: DateFilterItemToStringMapType = {
  'null': describeNull,
  'notnull': describeNotNull,
  'pastAgo': describePastAgo,
  past,
  'this': describeTypeAndUnit,
  'next': describeTypeAndUnit,
  'last': describeLast,
  'year': describeYear,
  'month': describeMonth,
  'before': beforeAfter,
  'after': beforeAfter,
  'range': describeRange,
  'thisRange': describeThisRange,
  on,
  relative,
  anyvalue,
  'day': describeDay,
};

/**
 * Maps a FilterItem to a function for converting it to a filter summary
 */
export const describeDate = (
  item: FilterModel,
  expressionType?: FilterExpressionType
): string =>
  defaultTo(filterToStringMap[item.type], () => '')(
    item,
    isDateTime(expressionType)
  );
