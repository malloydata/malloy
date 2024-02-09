/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
export type FilterTypeMap<T extends string = string> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [type in T]: any;
};
