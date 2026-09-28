/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

// The length of a string, trailing spaces included
const len = (arg: string) => `(LEN(${arg} + N'x') - 1)`;

export const SQLSERVER_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  ceil: {function: 'CEILING'},
  chr: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE NCHAR(${value}) END"},
  div: {sql: 'FLOOR(${dividend} / ${divisor})'},
  // A comparison: legal where a condition is expected, and a server error
  // as a value (there are no boolean values). Of NULL, no row, where the
  // standard's COALESCE(ENDS_WITH(...), false) is false.
  ends_with: {
    sql: `RIGHT(\${value}, ${len('${suffix}')}) = \${suffix}`,
  },
  ifnull: {function: 'ISNULL'},
  // A FLOAT holds neither infinity nor NaN, so neither condition is ever true
  is_inf: {sql: '(1=0)'},
  is_nan: {sql: '(1=0)'},
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
    sql: `LEFT(\${value}, ${len('${prefix}')}) = \${prefix}`,
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
