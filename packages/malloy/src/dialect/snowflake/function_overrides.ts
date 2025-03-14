/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const SNOWFLAKE_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  // Need to explicitly have a case for when the arg is 0, to return ''
  chr: {sql: "COALESCE(CHR(${value}), '')"},
  // in Snowflake division is always a float division, so we need this conversion
  div: {
    sql: 'CASE WHEN DIV0(${dividend}, ${divisor}) < 0 THEN CEIL(DIV0(${dividend}, ${divisor})) ELSE FLOOR(DIV0(${dividend}, ${divisor})) END',
  },
  is_inf: {
    sql: "COALESCE(${value} = 'inf'::FLOAT OR ${value} = '-inf'::FLOAT, false)",
  },
  is_nan: {sql: "COALESCE(${value} = 'NAN'::FLOAT, false)"},
  length: {function: 'LENGTH'},
  byte_length: {sql: 'CEIL(BIT_LENGTH(${value}) / 8)'},
  // Snowflake takes base first, then value.
  log: {sql: 'LOG(${base}, ${value})'},
  rand: {sql: 'UNIFORM(0::FLOAT, 1::FLOAT, RANDOM())'},
  regexp_extract: {sql: "REGEXP_SUBSTR(${value}, ${pattern}, 1, 1, 'e')"},
  starts_with: {sql: 'COALESCE(STARTSWITH(${value}, ${prefix}), false)'},
  ends_with: {sql: 'COALESCE(ENDSWITH(${value}, ${suffix}), false)'},
  strpos: {sql: 'POSITION(${search_string}, ${test_string})'},
  trunc: {
    to_integer: {
      sql: 'CASE WHEN ${value} < 0 THEN CEIL(${value}) ELSE FLOOR(${value}) END',
    },
    to_precision: {
      sql: 'CASE WHEN ${value} < 0 THEN CEIL(${value} * POW(10, ${precision})) / POW(10, ${precision}) ELSE FLOOR(${value} * POW(10, ${precision})) / POW(10, ${precision}) END',
    },
  },
};
