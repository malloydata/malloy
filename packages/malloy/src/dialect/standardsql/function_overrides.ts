/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const STANDARDSQL_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  chr: {
    sql: "CASE WHEN IFNULL(${value}, 1) = 0 THEN '' ELSE CHR(${value}) END",
  },
  // There's no built-in PI function, but we can compute it easily.
  pi: {sql: 'ACOS(-1)'},
};
