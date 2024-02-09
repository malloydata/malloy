/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
const validateValue = (value: string) => (!value ? '0' : value);

export const convertToNumber = (value: string) =>
  parseInt(validateValue(value), 10);
