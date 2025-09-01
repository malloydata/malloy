/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const STANDARDSQL_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  chr: {
    sql: "CASE WHEN IFNULL(${value}, 1) = 0 THEN '' ELSE CHR(${value}) END",
  },
  // There's no built-in PI function, but we can compute it easily.
  pi: {sql: 'ACOS(-1)'},
};
