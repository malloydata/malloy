/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

// Template strings use ${...values} for Malloy parameter interpolation.
// The ELSE branch uses a JS template literal to inject `name`, so the
// Malloy parameter reference must be escaped as \${...values}.
function greatestOrLeastSQL(name: string) {
  return (
    'CASE' +
    ' WHEN SIZE(FILTER(ARRAY(${...values}), x -> x IS NULL)) > 0' +
    ' THEN NULL' +
    ` ELSE ${name}(\${...values})` +
    ' END'
  );
}

export const DATABRICKS_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  // Databricks REGEXP_EXTRACT defaults to group index 1 (first capture group),
  // but Malloy expects the full match (group 0). Explicitly pass idx=0.
  regexp_extract: {sql: 'REGEXP_EXTRACT(${value}, ${pattern}, 0)'},
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
  log: {sql: 'LOG(${base},${value})'},
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  strpos: {sql: 'LOCATE(${search_string},${test_string})'},
  starts_with: {sql: 'COALESCE(STARTSWITH(${value},${prefix}), false)'},
  ends_with: {sql: 'COALESCE(ENDSWITH(${value},${suffix}), false)'},
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
  chr: {sql: 'CHR(${value})'},
  // Databricks has no IS_INF/IS_NAN functions; compare to special float values
  is_inf: {
    sql: "COALESCE(${value} = DOUBLE('infinity') OR ${value} = DOUBLE('-infinity'), false)",
  },
  is_nan: {sql: "COALESCE(${value} = DOUBLE('NaN'), false)"},
  // Databricks ASCII() returns the Unicode codepoint of the first character
  unicode: {function: 'ASCII'},
  // Databricks GREATEST/LEAST skip nulls; Malloy expects null propagation
  greatest: {sql: greatestOrLeastSQL('GREATEST')},
  least: {sql: greatestOrLeastSQL('LEAST')},
};
