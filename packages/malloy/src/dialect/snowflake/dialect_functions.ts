/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {AggregateOrderByNode} from '../../model';
import {
  def,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
  TypeDescBlueprint,
  arg as a,
  sql,
  DefinitionBlueprint,
} from '../functions/util';

// Cute shortcut So you can write things like: {array: T} and {dimension: T}
const T: TypeDescBlueprint = {generic: 'T'};

const order_by: AggregateOrderByNode = {
  node: 'aggregate_order_by',
  prefix: ' WITHIN GROUP(',
  suffix: ')',
};

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      expr: sql`LISTAGG(${a('value')}, ',')${order_by}`,
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
      expr: sql`LISTAGG(${a('value')}, ${a('separator')})${order_by}`,
    },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    impl: {
      expr: sql`LISTAGG(DISTINCT ${a('value')}, ',')${order_by}`,
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    impl: {
      expr: sql`LISTAGG(DISTINCT ${a('value')}, ${a('separator')})${order_by}`,
    },
  },
};

const percent_rank: DefinitionBlueprint = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'PERCENT_RANK', needsWindowOrderBy: true},
};

export const SNOWFLAKE_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  string_agg,
  string_agg_distinct,
  stddev: {
    takes: {'value': 'number'},
    returns: {measure: 'number'},
    impl: {function: 'STDDEV'},
  },
  stddev_pop: {
    takes: {'value': 'number'},
    returns: {measure: 'number'},
    impl: {function: 'STDDEV_POP'},
  },
  var_pop: {
    takes: {'value': 'number'},
    returns: {measure: 'number'},
    impl: {function: 'VARIANCE_POP'},
  },
  var_samp: {
    takes: {'value': 'number'},
    returns: {measure: 'number'},
    impl: {function: 'VARIANCE_SAMP'},
  },
  variance: {
    takes: {'value': 'number'},
    returns: {measure: 'number'},
    impl: {function: 'VARIANCE'},
  },
  ...def(
    'corr',
    {'y': {dimension: T}, 'x': {dimension: T}},
    {measure: 'number'}
  ),
  ...def(
    'covar_pop',
    {'y': {dimension: T}, 'x': {dimension: T}},
    {measure: 'number'}
  ),
  ...def(
    'covar_samp',
    {'y': {dimension: T}, 'x': {dimension: T}},
    {measure: 'number'}
  ),
  hll_accumulate: {
    default: {
      takes: {'value': {dimension: T}},
      returns: {measure: {sql_native: 'hyperloglog'}},
      generic: {
        'T': ['string', 'number'],
      },
      isSymmetric: true,
      impl: {function: 'hll_accumulate'},
    },
  },
  hll_combine: {
    takes: {'value': {sql_native: 'hyperloglog'}},
    returns: {measure: {sql_native: 'hyperloglog'}},
    impl: {function: 'hll_combine'},
    isSymmetric: true,
  },
  hll_estimate: {
    takes: {'value': {sql_native: 'hyperloglog'}},
    returns: {dimension: 'number'},
    impl: {function: 'hll_estimate'},
  },
  hll_export: {
    takes: {'value': {sql_native: 'hyperloglog'}},
    returns: {dimension: {sql_native: 'bytes'}},
    impl: {function: 'hll_export'},
  },
  hll_import: {
    takes: {'value': {sql_native: 'bytes'}},
    returns: {dimension: {sql_native: 'hyperloglog'}},
    impl: {function: 'hll_import'},
  },
  ...def('repeat', {'str': 'string', 'n': 'number'}, 'string'),
  ...def('reverse', {'str': 'string'}, 'string'),
  percent_rank,
};
