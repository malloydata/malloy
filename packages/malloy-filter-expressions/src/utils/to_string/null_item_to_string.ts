/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';
import isItemToString from './is_item_to_string';

/**
 * Converts a null filter item to a filter expression unit
 */
const nullItemToString = ({is}: FilterModel): string =>
  `${isItemToString(is)}null`;

export default nullItemToString;
