/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

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
};
