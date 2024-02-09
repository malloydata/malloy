/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';

export const sanitizeString = (item: FilterModel) => {
  const {id = '0', is = true, type, value = []} = item;
  switch (type) {
    case 'match':
      return {
        id,
        is,
        type,
        value: value,
      };
    default:
      return {...item};
  }
};
