/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

// GREATEST and LEAST arrive in SQL Server 2022; the first row of the arguments
// in order does the same, and NULL when any argument is
// The translator refuses a call whose template is an error node
// SQL Server before 2025 has no regular expression functions
// The length of a string, trailing spaces included
const len = (arg: string) => `(LEN(${arg} + N'x') - 1)`;

export const SQLSERVER_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  ceil: {function: 'CEILING'},
  chr: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE NCHAR(${value}) END"},
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  // Of NULL, false: the standard is COALESCE(ENDS_WITH(...), false)
  ends_with: {
    sql: `CASE WHEN RIGHT(\${value}, ${len('${suffix}')}) = \${suffix} THEN 1 ELSE 0 END`,
  },
  ifnull: {function: 'ISNULL'},
  // A FLOAT holds neither infinity nor NaN
  is_inf: {sql: '0'},
  is_nan: {sql: '0'},
  // LEN drops trailing spaces; a marker character restores them
  length: {sql: len('${value}')},
  ln: {sql: 'LOG(${value})'},
  log: {sql: 'LOG(${value}, ${base})'},
  // POWER answers in the type of its base, so an integer base truncates
  pow: {sql: 'POWER(CAST(${base} AS FLOAT(53)), ${exponent})'},
  round: {
    to_integer: {sql: 'ROUND(${value}, 0)'},
    to_precision: {sql: 'ROUND(${value}, ${precision})'},
  },
  atan2: {function: 'ATN2'},
  trim: {characters: {sql: 'TRIM(${trim_characters} FROM ${value})'}},
  starts_with: {
    sql: `CASE WHEN LEFT(\${value}, ${len('${prefix}')}) = \${prefix} THEN 1 ELSE 0 END`,
  },
  stddev: {function: 'STDEV'},
  string_repeat: {function: 'REPLICATE'},
  strpos: {sql: 'CHARINDEX(${search_string}, ${test_string})'},
  substr: {
    position_only: {
      sql: `SUBSTRING(\${value}, CASE WHEN \${position} < 0 THEN ${len('${value}')} + \${position} + 1 ELSE \${position} END, ${len('${value}')})`,
    },
    with_length: {
      sql: `SUBSTRING(\${value}, CASE WHEN \${position} < 0 THEN ${len('${value}')} + \${position} + 1 ELSE \${position} END, \${length})`,
    },
  },
  trunc: {
    to_integer: {sql: 'ROUND(${value}, 0, 1)'},
    to_precision: {sql: 'ROUND(${value}, ${precision}, 1)'},
  },
};
