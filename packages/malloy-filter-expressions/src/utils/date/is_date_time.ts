/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterExpressionType} from '../../types';

export const isDateTime = (filterType?: FilterExpressionType) =>
  filterType === 'date_time';
