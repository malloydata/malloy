/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';

export const sanitizeNumber = (item: FilterModel) => {
  const {
    id = '0',
    is = true,
    type,
    value = [],
    bounds = '[]',
    high,
    low,
  } = item;
  const [firstValue] = value;
  switch (type) {
    case '=':
      return {id, is, type, value};
    case '>':
    case '<':
    case '>=':
    case '<=':
      return {
        id,
        is,
        type,
        value: firstValue !== undefined ? [firstValue] : [],
      };
    case 'between':
      return {
        id,
        is,
        type,
        bounds,
        low: low ?? firstValue,
        high: high ?? firstValue,
      };
    case 'null':
      return {id, is, type};
    default:
      return {...item, type};
  }
};
