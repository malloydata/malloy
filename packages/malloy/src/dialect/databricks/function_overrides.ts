/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const DATABRICKS_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  regexp_extract: {function: 'REGEXP_EXTRACT'},
  replace: {
    regular_expression: {
      sql: 'REGEXP_REPLACE(${value}, ${pattern}, ${replacement})',
    },
  },
  trunc: {
    to_integer: {
      sql: 'CAST(${value} AS BIGINT)',
    },
    to_precision: {
      sql: '(ABS(FLOOR(${value} * POW(10,${precision}))/POW(10,${precision}))*IF(${value} < 0, -1, 1))',
    },
  },
  log: {
    sql: 'log(${base},${value})',
  },
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  strpos: {sql: 'LOCATE(${search_string},${test_string})'},
  starts_with: {sql: 'STARTSWITH(${value},${prefix})'},
  ends_with: {sql: 'ENDSWITH(${value},${suffix})'},
  trim: {
    characters: {
      sql: 'TRIM(BOTH ${trim_characters} FROM ${value})',
    },
  },
  ltrim: {
    characters: {
      sql: 'TRIM(LEADING ${trim_characters} FROM ${value})',
    },
  },
  rtrim: {
    characters: {
      sql: 'TRIM(TRAILING ${trim_characters} FROM ${value})',
    },
  },
  byte_length: {sql: 'OCTET_LENGTH(${value})'},
  chr: {
    sql: 'CHR(${value})',
  },
};
