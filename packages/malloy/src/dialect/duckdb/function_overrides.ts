/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

function greatestOrLeastSQL(name: string) {
  return (
    'CASE' +
    ' WHEN LEN(LIST_FILTER([${...values}], x -> x is null)) > 0' +
    ' THEN NULL' +
    ' ELSE ' +
    name +
    '(${...values})' +
    ' END'
  );
}

export const DUCKDB_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {sql: '(BIT_LENGTH(${value}) / 8)'},
  div: {
    sql: 'CASE WHEN ${dividend} / ${divisor} < 0 THEN CEIL(${dividend} / ${divisor}) ELSE FLOOR(${dividend} / ${divisor}) END',
  },
  ends_with: {sql: 'COALESCE(SUFFIX(${value}, ${suffix}), false)'},
  greatest: {sql: greatestOrLeastSQL('GREATEST')},
  is_inf: {sql: 'COALESCE(ISINF(${value}), false)'},
  is_nan: {sql: 'COALESCE(ISNAN(${value}), false)'},
  // DuckDB doesn't seem to have a log with base function, so we use the change of base
  // forumla to implement it.
  log: {sql: '(LN(${value}) / LN(${base}))'},
  least: {sql: greatestOrLeastSQL('LEAST')},
  rand: {function: 'RANDOM'},
  replace: {
    // In DuckDB we specifically need to say that the replacement should be global.
    regular_expression: {
      sql: "REGEXP_REPLACE(${value}, ${pattern}, ${replacement}, 'g')",
    },
  },
  // Trunc function doesn't exist in DuckDB, so we emulate it.
  // For both overloads, we switch between CEIL and FLOOR based on the sign of the arugment
  // For the overload with precision, we multiply by a power of 10 before rounding, then divide.
  trunc: {
    to_integer: {
      sql: 'CASE WHEN ${value} < 0 THEN CEIL(${value}) ELSE FLOOR(${value}) END',
    },
    to_precision: {
      sql: 'CASE WHEN ${value} < 0 THEN CEIL(${value} * POW(10, ${precision})) / POW(10, ${precision}) ELSE FLOOR(${value} * POW(10, ${precision})) / POW(10, ${precision}) END',
    },
  },
  // In DuckDB, `UNICODE('')` gives -1, rather than 0.
  unicode: {
    sql: "CASE WHEN ${value} = '' THEN 0 ELSE UNICODE(${value}) END",
  },
};
