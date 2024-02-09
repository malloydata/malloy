/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNullUndefinedOrEmpty = (value: any) =>
  value === null || value === undefined || value === '';
