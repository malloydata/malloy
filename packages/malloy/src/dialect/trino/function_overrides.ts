/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {arg, spread, sql} from '../functions/util';
import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const TRINO_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {sql: '(LENGTH(CAST(${value} AS VARBINARY)))'},
  chr: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE CHR(${value}) END"},
  ascii: {sql: "CODEPOINT(NULLIF(CAST(${value} as VARCHAR(1)),''))"},
  unicode: {sql: "CODEPOINT(NULLIF(CAST(${value} as VARCHAR(1)),''))"},
  concat: {
    variadic: {
      // Using `expr` definition because each spread argument needs to be cast
      expr: sql`CONCAT(${spread(arg('values'), 'CAST(', 'AS VARCHAR)')})`,
    },
  },
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  ifnull: {sql: 'COALESCE(${value}, ${default})'},
  is_inf: {sql: 'COALESCE(IS_INFINITE(${value}), false)'},
  // Trino has it but Presto doesn't
  // TODO only apply this override for Presto, not Trino
  log: {sql: '(LN(${value}) / LN(${base}))'},
  string_repeat: {
    sql: "ARRAY_JOIN(REPEAT(${value}, CASE WHEN ${value} IS NOT NULL THEN ${count} END),'')",
  },
  starts_with: {sql: 'COALESCE(STARTS_WITH(${value}, ${prefix}), false)'},
  ends_with: {
    sql: 'COALESCE(STARTS_WITH(REVERSE(CAST(${value} AS VARCHAR)), REVERSE(CAST(${suffix} AS VARCHAR))), false)',
  },
  // Trunc function doesn't exist in Trino, so we emulate it.
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
};
