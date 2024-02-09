/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Adds quotes around the "value" when it contains special
 * characters like `'`, `"` and `,` which have a specific meaning
 * in a "contains" expression. The quotes are also added when the
 * "value" starts with a `-` character.
 *
 * Most likely usage: for "match" expressions.
 *
 * @param value the filter value where special characters will be escaped
 */
export const addQuotes = (value: string) =>
  /^-|['",]/.test(value) ? `"${value}"` : value;
