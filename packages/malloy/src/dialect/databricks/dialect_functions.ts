/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from '../functions/util';
import {def} from '../functions/util';

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      sql: "ARRAY_JOIN(COLLECT_LIST(${value} ${order_by:}), ',')",
    },
  },
  with_separator: {
    takes: {
      'value': {dimension: 'string'},
      'separator': {literal: 'string'},
    },
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      sql: 'ARRAY_JOIN(COLLECT_LIST(${value} ${order_by:}), ${separator})',
    },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: "ARRAY_JOIN(COLLECT_SET(${value} ${order_by:}), ',')",
      defaultOrderByArgIndex: 0,
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: 'ARRAY_JOIN(COLLECT_SET(${value} ${order_by:}), ${separator})',
      defaultOrderByArgIndex: 0,
    },
  },
};

export const DATABRICKS_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  string_agg,
  string_agg_distinct,
  ...def('repeat', {'str': 'string', 'n': 'number'}, 'string'),
  ...def('reverse', {'str': 'string'}, 'string'),
};
