/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Makes variables from parser options available
 */
export const initializer = `
{
  const Object = options.Object;
  const getNumberFromString = options.getNumberFromString;
}
`;
