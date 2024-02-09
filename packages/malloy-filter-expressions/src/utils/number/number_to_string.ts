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
import flow from 'lodash/fp/flow';
import isEmpty from 'lodash/isEmpty';
import partition from 'lodash/partition';
import {
  FilterItemToStringFunction,
  FilterItemToStringMapType,
  FilterModel,
  ValueProps,
} from '../../types';
import {NumberTypes} from '../../types/number_types';
import {treeToList} from '../tree/tree_to_list';
import {isNullUndefinedOrEmpty} from './is_null_undefined_or_empty';

/**
 * number_to_string.ts
 * A collection of util functions that convert FilterItemProps (value, between, null)
 * to their filter_expression representation.
 * A FilterItem of:           will convert to:
 * {
 *   "is": true,              "1,2,3"
 *   "type": "=",
 *   "value": Array [
 *     1,2,3
 *   ],
 * }
 */

const nullToString = ({is}: FilterModel): string => `${isToString(is)}null`;

/**
 * Builds the expression of a 'between' range item
 * if both low & high values are null, undefined or empty
 * returns empty string which means 'any value'
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const betweenToString = ({bounds, low, high, is}: any) =>
  bounds && (!isNullUndefinedOrEmpty(low) || !isNullUndefinedOrEmpty(high))
    ? `${isToString(is)}${bounds[0]}${defaultTo(low, '')},${defaultTo(
        high,
        ''
      )}${bounds[1]}`
    : '';

/**
 * Builds the filter expression for an =, <, >, <=, >= item
 * if value[] is empty returns empty string which means 'any value'
 */
const valueToString = ({is, type, value}: ValueProps) =>
  value
    ?.map<string>(v => `${isToString(is)}${type === '=' ? '' : type}${v}`)
    .join(',') || '';

/**
 * Converts the 'is' value to string filter expression
 * 'is' is a prefix for the expresion value, blank for true and 'not ' for false
 */
const isToString = (is = true, yes = '', no = 'not ') => `${is ? yes : no}`;

const filterToStringMap: FilterItemToStringMapType = {
  'null': nullToString,
  'between': betweenToString,
};

/**
 * Maps a FilterItem to a function for converting it to an expression
 */
export const serializeNumberNode = (item: FilterModel): string => {
  const toStringFunction: FilterItemToStringFunction =
    filterToStringMap[item.type] || valueToString;
  return toStringFunction?.(item) || '';
};

/**
 * Converts a list of items into its number expression value
 */
const listToExpression = (items: FilterModel[]) =>
  items.map(serializeNumberNode).filter(String).join(',');

/**
 * itemIsNotEmpty is to filter out empty nodes when
 * building the number filter expression
 */
const removeEmptyItems = (items: FilterModel[]) =>
  items.filter(
    ({type, value}) =>
      !(['=', '>', '<', '>=', '<='].indexOf(type) > -1 && isEmpty(value))
  );

/**
 * Adds fix for an even weirder case of bad sql generation with literal number equality
 * combining with a single NOT condition.
 * need to duplicate the not condition '1, not 2' must become '1, not 2, not 2'
 */
const addDuplicateNotNodeIfNeeded = (list: FilterModel[]): FilterModel[] => {
  // break up into OR and AND clauses
  const [orClauses, andClauses] = partition(list, item => item.is);
  // check for duplicate not condition
  if (
    andClauses.length === 1 &&
    // exlude case when an 'is not equal' clause contains multiple values since those will produce multiple not clauses
    !(
      andClauses[0].type === NumberTypes.EQUAL &&
      andClauses[0]['value']?.length > 1
    ) &&
    orClauses.length >= 1 &&
    orClauses.every(item => item.type === '=')
  ) {
    // duplicate the first not (AND) clause
    return [...orClauses, ...andClauses, andClauses[0]];
  }
  return list;
};

/**
 * Converts the AST to an array of FilterItems and then
 * converts each item into its expression representation
 */
export const numberToString = flow(
  treeToList,
  removeEmptyItems,
  addDuplicateNotNodeIfNeeded,
  listToExpression
);
