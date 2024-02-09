/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import startsWith from 'lodash/startsWith';

export const convertOptionToType = (value: string) =>
  startsWith(value, '!')
    ? {is: false, type: value.substring(1)}
    : {is: true, type: value};
