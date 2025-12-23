/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
  def,
} from '../functions/util';

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: 'only_default',
    impl: {sql: "ARRAY_JOIN(ARRAY_SORT(COLLECT_LIST(${value})), ',')"}, //${order_by:}
  },
  with_separator: {
    takes: {
      'value': {dimension: 'string'},
      'separator': {literal: 'string'},
    },
    returns: {measure: 'string'},
    supportsOrderBy: 'only_default',
    //impl: {sql: 'STRING_AGG(${value}, ${separator}${order_by:})'},
    impl: {sql: 'ARRAY_JOIN(ARRAY_SORT(COLLECT_LIST(${value})), ${separator})'},
    // impl: {
    //   sql: "ARRAY_JOIN(TRANSFORM(ARRAY_SORT(ARRAY_AGG((${value}, ${order_by:})), (left, right) -> CASE WHEN left.${order_by:} < right.${order_by:} THEN -1 WHEN left.${order_by:} > right.${order_by:} THEN 1 ELSE CASE WHEN left.${value} < right.${value} THEN -1 WHEN left.${value} > right.${value} THEN 1 ELSE 0 END END), base -> base.${value}), ',')",
    // },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: "ARRAY_JOIN(ARRAY_SORT(COLLECT_SET(${value})), ',')",
      defaultOrderByArgIndex: 0,
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: 'ARRAY_JOIN(ARRAY_SORT(COLLECT_SET(${value})), ${separator})',
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
