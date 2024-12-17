/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from '../functions/util';

const repeat: DefinitionBlueprint = {
  takes: {'str': 'string', 'n': 'number'},
  returns: 'string',
  impl: {function: 'REPEAT'},
};

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {sql: 'GROUP_CONCAT(${value} ${order_by:})'},
  },
  with_separator: {
    takes: {
      'value': {dimension: 'string'},
      'separator': {literal: 'string'},
    },
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {sql: 'GROUP_CONCAT(${value} ${order_by:} SEPARATOR ${separator})'},
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: 'GROUP_CONCAT(DISTINCT ${value} ${order_by:})',
      defaultOrderByArgIndex: 0,
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: 'GROUP_CONCAT(DISTINCT ${value} ${order_by:} SEPARATOR ${separator})',
      defaultOrderByArgIndex: 0,
    },
  },
};

export const MYSQL_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  string_agg,
  string_agg_distinct,
  repeat,
};
