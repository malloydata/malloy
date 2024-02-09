/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import defaultTo from 'lodash/defaultTo';
import keyBy from 'lodash/keyBy';
import {FilterItemToStringMapType, FilterModel} from '../..';
import {FilterExpressionType} from '../../types';
import {addQuotes} from '../string/add_quotes';
import {describeIsItem} from '../summary/describe_is_item';
import {describeIsAnyValue} from '../summary/describe_is_any_value';
import {joinOr} from '../summary/join_or';
import {escapeParameterValue} from './escape_parameter_value';

const describeMultiValue = (values: string[]) => {
  if (values) {
    return joinOr(values.map(addQuotes));
  }
  return '';
};

const match = ({is, value}: FilterModel, _?: string) => {
  return value && value.length
    ? describeIsItem(is, describeMultiValue(value))
    : describeIsAnyValue();
};

const filterToStringMap: FilterItemToStringMapType = {
  match,
  'anyvalue': describeIsAnyValue,
};

/**
 * Maps a FilterItem to a function for converting it to a filter summary
 */
export const describeTier = (
  item: FilterModel,
  filterType?: FilterExpressionType
): string =>
  defaultTo(filterToStringMap[item.type], () => '')(item, filterType);
