/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

function greatestOrLeastSQL(name: string) {
  return (
    'CASE WHEN EXISTS (SELECT 1 FROM (VALUES ${...values}) AS t(val) WHERE val IS NULL) THEN NULL ELSE ' +
    name +
    '(${...values}) END'
  );
}

export const DATABRICKS_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {function: 'OCTET_LENGTH'},
  // There's no ENDS_WITH function in Postgres, so we do a hacky check that the last
  // N characters, where N is the length of the suffix, are equal to the suffix.
  ends_with: {
    sql: 'COALESCE(RIGHT(${value}, LENGTH(${suffix})) = ${suffix}, false)',
  },
  greatest: {sql: greatestOrLeastSQL('GREATEST')},
  least: {sql: greatestOrLeastSQL('LEAST')},
  // Postgres doesn't have an IFNULL function, so we use COALESCE, which is equivalent.
  ifnull: {sql: 'COALESCE(${value}, ${default})'},
  is_inf: {
    sql: "COALESCE(${value} = double('infinity') OR ${value} = double('-infinity'), false)",
  },
  is_nan: {sql: "COALESCE(${value} = double('NaN'), false)"},
  // Parameter order is backwards in Postgres.
  log: {sql: 'LOG(${base}, ${value})'},
  rand: {function: 'RANDOM'},
  regexp_extract: {sql: 'REGEXP_EXTRACT(${value}, ${pattern}, 0)'},
  replace: {
    // In Postgres we specifically need to say that the replacement should be global.
    regular_expression: {
      sql: 'REGEXP_REPLACE(${value}, ${pattern}, ${replacement})',
    },
  },
  stddev: {sql: 'STDDEV(${value}::DOUBLE)'},
  substr: {
    position_only: {
      sql: 'SUBSTR(${value}, CASE WHEN ${position} < 0 THEN LENGTH(${value}) + ${position} + 1 ELSE ${position} END)',
    },
    with_length: {
      sql: 'SUBSTR(${value}, CASE WHEN ${position} < 0 THEN LENGTH(${value}) + ${position} + 1 ELSE ${position} END, ${length})',
    },
  },
  trunc: {
    to_integer: {
      sql: 'IF (${value} < 0, CEIL(${value}), FLOOR(${value}))',
    },
    to_precision: {
      sql: 'CASE WHEN ${value} < 0 THEN CEIL(${value} * POW(10, ${precision})) / POW(10, ${precision}) ELSE FLOOR(${value} * POW(10, ${precision})) / POW(10, ${precision}) END',
    },
  },
  strpos: {
    sql: 'POSITION(${search_string} IN ${test_string})',
  },
  starts_with: {sql: 'COALESCE(startswith(${value}, ${prefix}), false)'},
  trim: {
    characters: {
      sql: 'TRIM(${trim_characters} FROM ${value})',
    },
  },
  ltrim: {
    characters: {
      sql: 'LTRIM(${trim_characters}, ${value})',
    },
  },
  rtrim: {
    characters: {
      sql: 'RTRIM(${trim_characters}, ${value})',
    },
  },
  // Aparently the ASCII function also works for unicode code points...
  unicode: {function: 'ASCII'},
  //like: {function: 'RLIKE'},
};
