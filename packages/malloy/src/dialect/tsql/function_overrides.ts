/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

function greatestOrLeastSQL(name: string) {
  return (
    'CASE WHEN (SELECT COUNT(*) FROM ( VALUES ${[...values].map((v) => "(" + v + ")" ).join(", ")} ) AS t(v) WHERE v IS NULL) > 0 THEN NULL ELSE ' +
    name +
    '(${...values}) END'
  );
}

export const TSQL_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {function: 'DATALENGTH'},
  ends_with: {
    sql: 'COALESCE(RIGHT(${value}, LEN(${suffix})) = ${suffix}, CAST(0 AS BIT))',
  },
  greatest: {sql: greatestOrLeastSQL('GREATEST')},
  least: {sql: greatestOrLeastSQL('LEAST')},
  ifnull: {sql: 'ISNULL(${value}, ${default})'},
  is_inf: {
    sql: "COALESCE(${value} = CAST('Infinity' AS FLOAT) OR ${value} = CAST('-Infinity' AS FLOAT), CAST(0 AS BIT))",
  },
  is_nan: {
    sql: "COALESCE(CAST(${value} AS FLOAT) = CAST('NaN' AS FLOAT), CAST(0 AS BIT))",
  },
  log: {sql: 'LOG(${value}, ${base})'},
  rand: {function: 'RAND'},
  // TODO (vitor): Find a way to make this work or check if its not needed
  // regexp_extract: {
  //   sql: "-- ",
  // },
  replace: {
    regular_expression: {
      sql: 'REPLACE(${value}, ${pattern}, ${replacement})',
    },
  },
  length: {sql: 'LEN(${value})'},
  round: {
    to_integer: {sql: 'ROUND(${value}, 0)'},
    to_precision: {sql: 'ROUND(${value}, ${precision})'},
  },
  stddev: {function: 'STDEV'},
  substr: {
    position_only: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LEN(${value}) + ${position} + 1 ELSE ${position} END, LEN(${value}))',
    },
    with_length: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LEN(${value}) + ${position} + 1 ELSE ${position} END, ${length})',
    },
  },
  trunc: {
    to_integer: {
      sql: 'FLOOR(${value})',
    },
    to_precision: {
      sql: 'ROUND(${value} - 0.5 * SIGN(${value} - FLOOR(${value})), ${precision})',
    },
  },
  unicode: {function: 'ASCII'},
  // TODO (vitor): Double check all bellow
  string_repeat: {
    sql: 'REPLICATE(${value}, ${count})',
  },
  div: {
    sql: '${dividend} / ${divisor}',
  },
  starts_with: {
    sql: 'LEFT(${value}, LEN(${prefix}) = ${prefix}',
  },
};
