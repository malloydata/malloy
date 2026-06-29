/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {arg, spread, sql} from '../functions/util';
import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

const UNBOUNDED = -1;
const CURRENT_ROW = 0;
const WHOLE_PARTITION = {preceding: UNBOUNDED, following: UNBOUNDED};
const UP_TO_CURRENT_ROW = {preceding: UNBOUNDED, following: CURRENT_ROW};

export const REDSHIFT_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  // ::DOUBLE PRECISION lets an untyped NULL resolve the overload; lossless for real args.
  abs: {sql: 'ABS(${value}::DOUBLE PRECISION)'},
  byte_length: {function: 'OCTET_LENGTH'},
  ceil: {sql: 'CEIL(${value}::DOUBLE PRECISION)'},
  // CONCAT is binary-only; chain with ||.
  concat: {
    variadic: {
      expr: sql`${spread(arg('values'), undefined, undefined, ' || ')}`,
    },
  },
  div: {
    sql: 'TRUNC(${dividend}::DOUBLE PRECISION / ${divisor}::DOUBLE PRECISION)',
  },
  ends_with: {
    sql: 'COALESCE(RIGHT(${value}, LENGTH(${suffix})) = ${suffix}, false)',
  },
  floor: {sql: 'FLOOR(${value}::DOUBLE PRECISION)'},
  greatest: {function: 'GREATEST'},
  least: {function: 'LEAST'},
  ifnull: {sql: 'COALESCE(${value}, ${default})'},
  is_inf: {
    sql: "COALESCE(${value} = CAST('Infinity' AS FLOAT8) OR ${value} = CAST('-Infinity' AS FLOAT8), false)",
  },
  is_nan: {sql: "COALESCE(${value} = CAST('NaN' AS FLOAT8), false)"},
  log: {sql: 'LOG(${base}, ${value})'},
  rand: {function: 'RANDOM'},
  regexp_extract: {function: 'REGEXP_SUBSTR'},
  replace: {
    regular_expression: {
      sql: "REGEXP_REPLACE(${value}, ${pattern}, ${replacement}, 1, 'p')",
    },
  },
  // The 2-arg call drops the default that Redshift's LAG/LEAD reject; it is
  // re-applied by RedshiftDialect.sqlAnalyticWindowDefault.
  lag: {
    with_default: {sql: 'LAG(${value}, ${offset})', needsWindowOrderBy: true},
  },
  lead: {
    with_default: {sql: 'LEAD(${value}, ${offset})', needsWindowOrderBy: true},
  },
  first_value: {
    function: 'FIRST_VALUE',
    needsWindowOrderBy: true,
    between: WHOLE_PARTITION,
  },
  last_value: {
    function: 'LAST_VALUE',
    needsWindowOrderBy: true,
    between: WHOLE_PARTITION,
  },
  max_cumulative: {
    function: 'MAX',
    needsWindowOrderBy: true,
    between: UP_TO_CURRENT_ROW,
  },
  min_cumulative: {
    function: 'MIN',
    needsWindowOrderBy: true,
    between: UP_TO_CURRENT_ROW,
  },
  sum_cumulative: {
    function: 'SUM',
    needsWindowOrderBy: true,
    between: UP_TO_CURRENT_ROW,
  },
  round: {
    to_integer: {sql: 'ROUND(${value}::DOUBLE PRECISION)'},
    to_precision: {
      sql: 'ROUND(${value}::DOUBLE PRECISION, ${precision}::INTEGER)',
    },
  },
  sign: {sql: 'SIGN(${value}::DOUBLE PRECISION)'},
  stddev: {sql: 'STDDEV(${value}::DOUBLE PRECISION)'},
  substr: {
    position_only: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LENGTH(${value}) + ${position} + 1 ELSE ${position} END)',
    },
    with_length: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LENGTH(${value}) + ${position} + 1 ELSE ${position} END, ${length})',
    },
  },
  starts_with: {
    sql: 'COALESCE(LEFT(${value}::VARCHAR, LENGTH(${prefix}::VARCHAR)) = ${prefix}::VARCHAR, false)',
  },
  trunc: {
    to_integer: {sql: 'TRUNC(${value}::DOUBLE PRECISION)'},
    to_precision: {
      sql: 'TRUNC(${value}::DOUBLE PRECISION, ${precision}::INTEGER)',
    },
  },
  unicode: {function: 'ASCII'},
};
