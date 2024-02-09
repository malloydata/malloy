/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Converts the 'is' value to string filter expression
 * 'is' is a prefix for the expression value, blank for true and 'not ' for false
 */
const isItemToString = (is = true, yes = '', no = 'not ') => `${is ? yes : no}`;

export default isItemToString;
