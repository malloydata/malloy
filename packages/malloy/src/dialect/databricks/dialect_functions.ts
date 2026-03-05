/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
  TypeDescBlueprint,
} from '../functions/util';
import {def} from '../functions/util';

/*
 * Databricks dialect function definitions.
 *
 * For simple functions, use the def() shorthand with the T convention:
 *   ...def('func_name', {'arg': 'type'}, 'return_type')
 *
 * For functions needing SQL templates or multiple overloads,
 * use full DefinitionBlueprint / OverloadedDefinitionBlueprint objects.
 */

// Shortcut so you can write things like: {array: T} and {dimension: T}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const T: TypeDescBlueprint = {generic: 'T'};

// Databricks COLLECT_LIST/COLLECT_SET do not support ORDER BY inside
// the aggregate call. Ordering is not supported for string_agg on
// Databricks. See databricks-string-agg.md for details.
const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    impl: {
      sql: "ARRAY_JOIN(COLLECT_LIST(${value}), ',')",
    },
  },
  with_separator: {
    takes: {
      'value': {dimension: 'string'},
      'separator': {literal: 'string'},
    },
    returns: {measure: 'string'},
    impl: {
      sql: 'ARRAY_JOIN(COLLECT_LIST(${value}), ${separator})',
    },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    impl: {
      sql: "ARRAY_JOIN(COLLECT_SET(${value}), ',')",
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    impl: {
      sql: 'ARRAY_JOIN(COLLECT_SET(${value}), ${separator})',
    },
  },
};

export const DATABRICKS_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  // Aggregate functions
  string_agg,
  string_agg_distinct,

  // Scalar functions
  ...def('repeat', {'str': 'string', 'n': 'number'}, 'string'),
  ...def('reverse', {'str': 'string'}, 'string'),
};
