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
import isEmpty from 'lodash/isEmpty';
import {
  FilterASTNode,
  FilterItemToStringFunction,
  FilterItemToStringMapType,
  FilterModel,
} from '../../types';
import isItemToString from '../to_string/is_item_to_string';
import {treeToString} from '../tree/tree_to_string';
import {escapeLeadingAndTrailingWhitespaces} from './escape_leading_and_trailing_whitespaces';
import {escapeWithCaret} from './escape_with_caret';
import {quoteFilter} from './quote_filter';

/**
 * stringFilterToString.ts
 * A collection of util functions that convert string grammar FilterItemProps (match, contains, etc)
 * to their filter_expression representation.
 * A FilterItem of:           will convert to:
 * {
 *   "is": true,              "FOO, BAR"
 *   "type": "match",
 *   "value": Array [
 *     FOO, BAR
 *   ],
 * }
 */

/**
 * Will double escape trailing spaces (used for match and endsWith filter types)
 * stringGrammar reverses this by returning a single space " " from "^ ^ "
 */
const escapeWithDoubleLastEscape = (v: string) =>
  escapeLeadingAndTrailingWhitespaces(v);
/**
 * Will not double escape trailing spaces (used for startsWith and contains filter types
 * because a % sign will be the real end of the string)
 */
const escapeWithoutDoubleLastEscape = (v: string) =>
  escapeLeadingAndTrailingWhitespaces(v, false);

const matchToString = ({value, is}: FilterModel) =>
  isItemToString(is, '', '-') +
  value
    .map(quoteFilter)
    .map(escapeWithDoubleLastEscape)
    .join(`,${isItemToString(is, '', '-')}`);

const multiValueToString = (
  values: string[],
  toString: (token: string) => string
) => values.map(toString).join(',');

const startWithToString = ({value, is}: FilterModel) =>
  multiValueToString(
    value.map(escapeWithCaret).map(escapeWithoutDoubleLastEscape),
    (token: string) => `${isItemToString(is, '', '-') + String(token)}%`
  );

const endsWithToString = ({value, is}: FilterModel) =>
  multiValueToString(
    value.map(escapeWithCaret).map(escapeWithDoubleLastEscape),
    (token: string) => `${isItemToString(is, '', '-')}%${String(token)}`
  );

const containsToString = ({value, is}: FilterModel) =>
  multiValueToString(
    value.map(escapeWithCaret).map(escapeWithoutDoubleLastEscape),
    (token: string) => `${isItemToString(is, '', '-')}%${String(token)}%`
  );

const otherToString = ({value, is}: FilterModel) =>
  multiValueToString(
    value,
    (token: string) => `${isItemToString(is, '', '-')}${String(token)}`
  );

const blankToString = ({is}: FilterModel) =>
  `${isItemToString(is, '', '-')}EMPTY`;

const nullToString = ({is}: FilterModel) =>
  `${isItemToString(is, '', '-')}NULL`;

const anyvalueToString = () => '';

const filterToStringMap: FilterItemToStringMapType = {
  'startsWith': startWithToString,
  'endsWith': endsWithToString,
  'contains': containsToString,
  'match': matchToString,
  'blank': blankToString,
  'null': nullToString,
  'anyvalue': anyvalueToString,
  'other': otherToString, // doesn't match to a UI component
};

/**
 * Maps a FilterItem to a function for converting it to an expression
 */
const stringToExpression = (item: FilterModel): string => {
  const toStringFunction: FilterItemToStringFunction =
    filterToStringMap[item.type];
  return toStringFunction?.(item) || '';
};

/**
 * itemIsNotEmpty is to filter out empty nodes when
 * building the string filter expression
 */
const itemIsNotEmpty = ({type, value}: FilterModel) =>
  !(
    ['match', 'contains', 'startsWith', 'endsWith', 'other'].indexOf(type) >
      -1 && isEmpty(value)
  );
/**
 * Converts the AST to an array of FilterItems and then
 * converts each item into its expression representation
 */
export const stringFilterToString = (root: FilterASTNode) =>
  treeToString(root, stringToExpression, itemIsNotEmpty);
