/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Expr} from '../../model/malloy_types';
import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

// SQL Server 2022 has no regular expression functions; the translator refuses
// a call whose template is this node.
const noRegex: Expr = {node: 'error', message: 'regular expressions'};

export const SQLSERVER_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {function: 'DATALENGTH'},
  ceil: {function: 'CEILING'},
  chr: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE NCHAR(${value}) END"},
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  ends_with: {
    sql: 'CASE WHEN RIGHT(${value}, LEN(${suffix})) = ${suffix} THEN 1 ELSE 0 END',
  },
  ifnull: {function: 'ISNULL'},
  is_inf: {
    sql: "CASE WHEN ${value} IN (CAST('Infinity' AS FLOAT), CAST('-Infinity' AS FLOAT)) THEN 1 ELSE 0 END",
  },
  is_nan: {sql: 'CASE WHEN ${value} <> ${value} THEN 1 ELSE 0 END'},
  length: {function: 'LEN'},
  ln: {sql: 'LOG(${value})'},
  log: {sql: 'LOG(${value}, ${base})'},
  pow: {function: 'POWER'},
  regexp_extract: {expr: noRegex},
  replace: {regular_expression: {expr: noRegex}},
  round: {
    to_integer: {sql: 'ROUND(${value}, 0)'},
    to_precision: {sql: 'ROUND(${value}, ${precision})'},
  },
  atan2: {function: 'ATN2'},
  trim: {characters: {sql: 'TRIM(${trim_characters} FROM ${value})'}},
  // The two-argument forms need compatibility level 160 (SQL Server 2022)
  ltrim: {characters: {sql: 'LTRIM(${value}, ${trim_characters})'}},
  rtrim: {characters: {sql: 'RTRIM(${value}, ${trim_characters})'}},
  starts_with: {
    sql: 'CASE WHEN LEFT(${value}, LEN(${prefix})) = ${prefix} THEN 1 ELSE 0 END',
  },
  stddev: {function: 'STDEV'},
  string_repeat: {function: 'REPLICATE'},
  strpos: {sql: 'CHARINDEX(${search_string}, ${test_string})'},
  substr: {
    position_only: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LEN(${value}) + ${position} + 1 ELSE ${position} END, LEN(${value}))',
    },
    with_length: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LEN(${value}) + ${position} + 1 ELSE ${position} END, ${length})',
    },
  },
  trunc: {
    to_integer: {sql: 'ROUND(${value}, 0, 1)'},
    to_precision: {sql: 'ROUND(${value}, ${precision}, 1)'},
  },
};
