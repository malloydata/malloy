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
import {FilterItemToStringMapType, FilterModel} from '../../types';
import {describeIsItem} from '../summary/describe_is_item';
import {describeIsAnyValue} from '../summary/describe_is_any_value';
import {describeNull} from '../summary/describe_null';
import {joinOr} from '../summary/join_or';
import {addQuotes} from './add_quotes';

const describeMultiValue = (value: string[]) => {
  return value && joinOr(value.map(addQuotes));
};
const match = ({is, value}: FilterModel) => {
  return value && value.length
    ? describeIsItem(is, describeMultiValue(value))
    : describeIsAnyValue();
};

const contains = ({is, value}: FilterModel) => {
  const valueText = describeMultiValue(value);
  const containsText = `contains ${valueText}`;
  const doesntContainText = `does not contain ${valueText}`;
  return is ? containsText : doesntContainText;
};

const startsWith = ({is, value}: FilterModel) => {
  const valueText = describeMultiValue(value);
  const startsWithText = `starts with ${valueText}`;
  const doesntStartWithText = `does not start with ${valueText}`;
  return is ? startsWithText : doesntStartWithText;
};

const endsWith = ({is, value}: FilterModel) => {
  const valueText = describeMultiValue(value);
  const endsWithText = `ends with ${valueText}`;
  const doesntEndWithText = `does not end with ${valueText}`;
  return is ? endsWithText : doesntEndWithText;
};

const blank = ({is}: FilterModel) => {
  return describeIsItem(is, 'blank');
};

const filterToStringMap: FilterItemToStringMapType = {
  blank,
  'null': describeNull,
  match,
  contains,
  startsWith,
  endsWith,
  'anyvalue': describeIsAnyValue,
};

/**
 * Maps a FilterItem to a function for converting it to a filter summary
 */
export const describeString = (item: FilterModel): string =>
  defaultTo(filterToStringMap[item.type], () => '')(item);
