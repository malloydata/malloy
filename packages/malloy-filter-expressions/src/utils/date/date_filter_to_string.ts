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
  FilterASTNode,
  FilterDateTimeModel,
  FilterExpressionType,
  FilterModel,
} from '../../types';

import nullItemToString from '../to_string/null_item_to_string';
import {treeToString} from '../tree/tree_to_string';
import {isDateTime} from './is_date_time';
import {zeroPad2, zeroPad4} from './zero_pad';
import {hasTimeFilterDateTimeModel} from './date_conversions';

export interface DateFilterItemToStringMapType {
  [name: string]: DateFilterItemToStringFunction;
}

export type DateFilterItemToStringFunction = (
  item: FilterModel,
  showTime: boolean
) => string;

const datetime = (date?: FilterDateTimeModel, showTime?: boolean): string => {
  if (!date) return 'Invalid Date';
  const {year, month, day, hour, minute} = date;
  let result = String(zeroPad4(year));
  result += month ? `/${zeroPad2(month)}` : '';
  result += day ? `/${zeroPad2(day)}` : '';
  if (showTime) {
    result += hour !== undefined ? ` ${zeroPad2(hour)}` : '';
    result += minute !== undefined ? `:${zeroPad2(minute)}` : '';
  }
  return result;
};

const beforeAfter = (item: FilterModel, showTime: boolean) => {
  const {type, range, date, fromnow, unit} = item;
  if (range === 'absolute') {
    return `${type} ${datetime(date, showTime)}`;
  }

  const fromNowAgoText = fromnow ? 'from now' : 'ago';
  return unit === 'now'
    ? `${type} 0 minutes ${fromNowAgoText}`
    : `${type} ${intervalToString(item)} ${fromNowAgoText}`;
};

const dateRange = ({start, end}: FilterModel, showTime: boolean) =>
  `${datetime(start, showTime)} to ${datetime(end, showTime)}`;

const thisRange = ({startInterval, endInterval}: FilterModel) =>
  `this ${startInterval} to ${endInterval}`;

const intervalToString = ({value, unit}: FilterModel) => `${value} ${unit}`;

const typeAndUnitToString = ({type, unit}: FilterModel) => `${type} ${unit}`;

const yearToString = ({year}: FilterModel) => `${zeroPad4(year)}`;

const monthToString = ({year, month}: FilterModel) =>
  `${zeroPad4(year)}-${zeroPad2(month)}`;

const dayToString = ({day}: FilterModel) => `${day}`;

const on = ({date}: FilterModel, showTime: boolean) =>
  `${datetime(date, showTime && hasTimeFilterDateTimeModel(date))}`;

const relative = ({startInterval, intervalType, endInterval}: FilterModel) =>
  `${intervalToString(startInterval)} ${intervalType} for ${intervalToString(
    endInterval
  )}`;

const pastToString = (item: FilterModel) =>
  `${intervalToString(item)}${
    item['complete'] ? ' ago for ' + intervalToString(item) : ''
  }`;

const pastAgoToString = (item: FilterModel) => `${intervalToString(item)} ago`;

const notNullToString = () => 'not null';

const filterToStringMap: DateFilterItemToStringMapType = {
  'null': nullItemToString,
  'notnull': notNullToString,
  'past': pastToString,
  'pastAgo': pastAgoToString,
  'this': typeAndUnitToString,
  'next': typeAndUnitToString,
  'last': typeAndUnitToString,
  'year': yearToString,
  'month': monthToString,
  'day': dayToString,
  'before': beforeAfter,
  'after': beforeAfter,
  'range': dateRange,
  thisRange,
  on,
  relative,
  'anyvalue': () => '',
};

/**
 * Maps a FilterItem to a function for converting it to an expression
 */
const dateToString =
  (showTime: boolean) =>
  (item: FilterModel): string => {
    const toStringFunction: DateFilterItemToStringFunction =
      filterToStringMap[item.type];
    return toStringFunction?.(item, showTime) || '';
  };

/**
 * Converts the AST to an array of FilterItems and then
 * converts each item into its expression representation
 */
export const dateFilterToString = (
  root: FilterASTNode,
  type: FilterExpressionType
) => treeToString(root, dateToString(isDateTime(type)));
