/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from '../functions/util';

const dayname: DefinitionBlueprint = {
  takes: {'date_value': ['date', 'timestamp']},
  returns: 'string',
  impl: {function: 'DAYNAME'},
};

const to_timestamp: DefinitionBlueprint = {
  takes: {'epoch_seconds': 'number'},
  returns: 'timestamp',
  impl: {function: 'TO_TIMESTAMP'},
};

const count_approx: DefinitionBlueprint = {
  takes: {'value': {dimension: 'any'}},
  returns: {measure: 'number'},
  impl: {function: 'APPROX_COUNT_DISTINCT'},
  isSymmetric: true,
};

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      sql: 'STRING_AGG(${value}${order_by:})',
      defaultOrderByArgIndex: 0,
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
      sql: 'STRING_AGG(${value}, ${separator}${order_by:})',
      defaultOrderByArgIndex: 0,
    },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    impl: {
      sql: 'STRING_AGG(DISTINCT ${value}${order_by:})',
      defaultOrderByArgIndex: 0,
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    impl: {
      sql: 'STRING_AGG(DISTINCT ${value}, ${separator}${order_by:})',
      defaultOrderByArgIndex: 0,
    },
  },
};

export const DUCKDB_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  count_approx,
  dayname,
  to_timestamp,
  string_agg,
  string_agg_distinct,
};
