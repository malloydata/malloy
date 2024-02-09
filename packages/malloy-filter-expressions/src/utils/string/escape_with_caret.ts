/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Escapes special characters `%`, `^` and `_` withthe `^` (CARET)
 * character, as mentioned in the official documentation:
 * https://cloud.google.com/looker/docs/reference/filter-expressions
 *
 * Most likely usage: escaping these characters in a LIKE expression,
 * such as `%FOO`, `FOO%` or `%FOO%` where `%` is the LIKE operator.
 *
 * @param value the filter value where special characters will be escaped
 */
export const escapeWithCaret = (value: string) =>
  value.replace(/[%^_,]/g, c => `^${c}`);
