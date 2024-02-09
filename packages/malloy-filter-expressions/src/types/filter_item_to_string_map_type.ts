/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterItemToStringFunction} from './filter_item_to_string_function';

export interface FilterItemToStringMapType {
  [name: string]: FilterItemToStringFunction;
}
