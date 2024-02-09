/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from './filter_model';
import {FilterExpressionType} from './filter_type';

export type FilterItemToStringFunction = (
  item: FilterModel,
  filterType?: FilterExpressionType
) => string;
