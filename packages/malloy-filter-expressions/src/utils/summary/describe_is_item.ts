/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

export const describeIsItem = (is: boolean, value: string) => {
  const no = `is not ${value}`;
  const yes = `is ${value}`;

  return is ? yes : no;
};
