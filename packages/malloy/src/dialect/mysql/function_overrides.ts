/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const MYSQL_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  regexp_extract: {function: 'REGEXP_SUBSTR'},
  replace: {
    // In Postgres we specifically need to say that the replacement should be global.
    regular_expression: {
      sql: 'REGEXP_REPLACE(${value}, ${pattern}, ${replacement}, 1,0)',
    },
  },
  trunc: {
    to_integer: {
      sql: '(FLOOR(${value}) + IF(${value} < 0,1,0))',
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
  starts_with: {sql: "COALESCE(${value} LIKE CONCAT(${prefix}, '%'),0)"},
  ends_with: {sql: "COALESCE(${value} LIKE CONCAT('%',${suffix}),0)"},
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
  byte_length: {sql: '(LENGTH(CAST(${value} AS VARBINARY)))'},
  chr: {
    sql: "CASE WHEN ${value} = 0 THEN '' ELSE CHAR(${value} USING latin1) END",
  },
};
