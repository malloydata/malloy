/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import flow from 'lodash/fp/flow';
import {
  FilterASTNode,
  FilterExpressionType,
  FilterItemToStringFunction,
  FilterItemToStringMapType,
  FilterModel,
} from '../..';
import {quoteFilter} from '../string/quote_filter';
import isItemToString from '../to_string/is_item_to_string';
import {escapeParameterValue} from './escape_parameter_value';
import {treeToList} from '../tree/tree_to_list';

const matchToString = ({value, is}: FilterModel, _?: string) => {
  return (
    isItemToString(is, '', '-') +
    value
      .map((val: string) => quoteFilter(val))
      .join(`,${isItemToString(is, '', '-')}`)
  );
};

const anyvalueToString = () => '';

const filterToStringMap: FilterItemToStringMapType = {
  'anyvalue': anyvalueToString,
  'match': matchToString,
};

const serializeTierItem =
  (type: FilterExpressionType) =>
  (item: FilterModel): string => {
    const toStringFunction: FilterItemToStringFunction =
      filterToStringMap[item.type];
    return toStringFunction?.(item, type) || '';
  };
/**
 * Maps a FilterItem to a function for converting it to an expression
 */

const listToExpression =
  (type: FilterExpressionType) => (items: FilterModel[]) =>
    items.map(serializeTierItem(type)).join(',');

/**
 * Converts the AST to an array of FilterItems and then
 * converts each item into its expression representation
 */
export const tierFilterToString = (
  root: FilterASTNode,
  type: FilterExpressionType
): string => flow(treeToList, listToExpression(type))(root);
