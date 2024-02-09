/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

import {describeIsItem} from './describe_is_item';

export const describeIsAnyValue = () => {
  return describeIsItem(true, 'any value');
};
