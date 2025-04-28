/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

function greatestOrLeastSQL(name: string) {
  return (
    'CASE WHEN NUM_NULLS(${...values}) > 0 THEN NULL ELSE ' +
    name +
    '(${...values}) END'
  );
}

export const REDSHIFT_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {function: 'OCTET_LENGTH'},
  // There's no ENDS_WITH function in Redshift, so we do a hacky check that the last
  // N characters, where N is the length of the suffix, are equal to the suffix.
  ends_with: {
    sql: 'COALESCE(RIGHT(${value}, LENGTH(${suffix})) = ${suffix}, false)',
  },
  greatest: {sql: greatestOrLeastSQL('GREATEST')},
  least: {sql: greatestOrLeastSQL('LEAST')},
  // Redshift doesn't have an IFNULL function, so we use COALESCE, which is equivalent.
  ifnull: {sql: 'COALESCE(${value}, ${default})'},
  is_inf: {
    sql: "COALESCE(${value} = DOUBLE PRECISION 'Infinity' OR ${value} = DOUBLE PRECISION '-Infinity', false)",
  },
  is_nan: {sql: "COALESCE(${value} = NUMERIC 'NaN', false)"},
  // Parameter order is backwards in Redshift.
  log: {sql: 'LOG(${base}, ${value})'},
  rand: {function: 'RANDOM'},
  regexp_extract: {function: 'SUBSTRING'},
  replace: {
    // In Redshift we specifically need to say that the replacement should be global.
    regular_expression: {
      sql: 'REGEXP_REPLACE(${value}, ${pattern}, ${replacement})',
    },
  },
  // note: this only works with FLOAT8, I've tried NUMERIC and DECIMAL
  round: {
    to_integer: {sql: 'ROUND((${value})::FLOAT8)'},
    to_precision: {sql: 'ROUND((${value})::FLOAT8, ${precision})'},
  },
  floor: {sql: 'FLOOR(${value}::FLOAT8)'},
  ceil: {sql: 'CEIL(${value}::FLOAT8)'},
  // TODO this is a bit of a hack in order to make the arrayAggUnnest work for Redshift,
  // as we don't currently have a good way of doing this while preserving types
  stddev: {sql: 'STDDEV(${value}::DOUBLE PRECISION)'},
  substr: {
    position_only: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LENGTH(${value}) + ${position} + 1 ELSE ${position} END)',
    },
    with_length: {
      sql: 'SUBSTRING(${value}, CASE WHEN ${position} < 0 THEN LENGTH(${value}) + ${position} + 1 ELSE ${position} END, ${length})',
    },
  },
  // Redshift doesn't let you TRUNC a FLOAT with a precision, so we cast to NUMERIC first
  // Also, TRUNC(NULL) doesn't compile because PG doesn't know the type of NULL, so we cast to
  // NUMERIC there too...
  // TODO Maybe there's a way we don't have to cast to NUMERIC.
  trunc: {
    to_integer: {
      sql: 'TRUNC(${value}::FLOAT8)',
    },
    to_precision: {
      sql: 'TRUNC((${value}::FLOAT8), ${precision})',
    },
  },
  abs: {sql: 'ABS(${value}::FLOAT8)'},
  sign: {sql: 'SIGN(${value}::FLOAT8)'},
  div: {sql: '${dividend} / ${divisor}'},
  starts_with: {
    sql: 'COALESCE(SUBSTR(${value}, 1, LENGTH(${prefix})) = ${prefix}, false)',
  },
  // Aparently the ASCII function also works for unicode code points...
  unicode: {function: 'ASCII'},
  concat: {
    // special case added in expandFunctionCall() in malloy_query.ts
    // to process "...values" scenarios for redshift concat
    variadic: {sql: '${...values}'},
  },
};
