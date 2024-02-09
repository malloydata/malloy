/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
export const joinOr = (values: string[]) => {
  return values.reduce((acc: string, value: string) => {
    if (acc === '') return value;
    return `${acc} or ${value}`;
  }, '');
};
