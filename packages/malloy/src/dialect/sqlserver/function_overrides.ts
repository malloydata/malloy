/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Expr} from '../../model/malloy_types';
import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';
import {arg, spread, sql} from '../functions/util';

// GREATEST and LEAST arrive in SQL Server 2022; the first row of the arguments
// in order does the same, and NULL when any argument is
const extreme = (dir: 'DESC' | 'ASC'): Expr =>
  sql`(SELECT TOP 1 v FROM (VALUES ${spread(arg('values'), '(', ')')}) AS t(v) WHERE NOT EXISTS (SELECT 1 FROM (VALUES ${spread(arg('values'), '(', ')')}) AS n(v) WHERE n.v IS NULL) ORDER BY v ${dir})`;

// The translator refuses a call whose template is an error node
const unsupported = (what: string): Expr => ({node: 'error', message: what});
// SQL Server before 2025 has no regular expression functions
const noRegex = unsupported('regular expressions');

export const SQLSERVER_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  // A UTF-8 byte count needs a UTF-8 collation, which arrives in SQL Server 2019
  byte_length: {expr: unsupported('byte_length')},
  ceil: {function: 'CEILING'},
  chr: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE NCHAR(${value}) END"},
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  ends_with: {
    sql: 'CASE WHEN RIGHT(${value}, LEN(${suffix})) = ${suffix} THEN 1 WHEN RIGHT(${value}, LEN(${suffix})) <> ${suffix} THEN 0 END',
  },
  greatest: {expr: extreme('DESC')},
  ifnull: {function: 'ISNULL'},
  // A FLOAT holds neither infinity nor NaN
  is_inf: {sql: '0'},
  is_nan: {sql: '0'},
  least: {expr: extreme('ASC')},
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
  // LTRIM and RTRIM take a character set only from SQL Server 2022
  ltrim: {characters: {expr: unsupported('ltrim with characters')}},
  rtrim: {characters: {expr: unsupported('rtrim with characters')}},
  starts_with: {
    sql: 'CASE WHEN LEFT(${value}, LEN(${prefix})) = ${prefix} THEN 1 WHEN LEFT(${value}, LEN(${prefix})) <> ${prefix} THEN 0 END',
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
