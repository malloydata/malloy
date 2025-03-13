/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
  TypeDescBlueprint,
} from '../functions/util';
import {def} from '../functions/util';

// Cute shortcut So you can write things like: {array: T} and {dimension: T}
const T: TypeDescBlueprint = {generic: 'T'};

const date_from_unix_date: DefinitionBlueprint = {
  takes: {'unix_date': 'number'},
  returns: 'date',
  impl: {function: 'DATE_FROM_UNIX_DATE'},
};

const string_agg: OverloadedDefinitionBlueprint = {
  'default_separator': {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    supportsLimit: true,
    impl: {
      sql: 'STRING_AGG(${value}${order_by:}${limit:})',
      defaultOrderByArgIndex: 0,
    },
  },
  'with_separator': {
    takes: {
      'value': {dimension: 'string'},
      'separator': {literal: 'string'},
    },
    returns: {measure: 'string'},
    supportsOrderBy: true,
    supportsLimit: true,
    impl: {
      sql: 'STRING_AGG(${value}, ${separator}${order_by:}${limit:})',
      defaultOrderByArgIndex: 0,
    },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  'default_separator': {
    ...string_agg['default_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: 'STRING_AGG(DISTINCT ${value}${order_by:}${limit:})',
      defaultOrderByArgIndex: 0,
    },
  },
  'with_separator': {
    ...string_agg['with_separator'],
    isSymmetric: true,
    supportsOrderBy: 'only_default',
    impl: {
      sql: 'STRING_AGG(DISTINCT ${value}, ${separator}${order_by:}${limit:})',
      defaultOrderByArgIndex: 0,
    },
  },
};

export const STANDARDSQL_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  date_from_unix_date,
  string_agg,
  string_agg_distinct,
  hll_accumulate: {
    default: {
      takes: {'value': {dimension: T}},
      returns: {measure: {sql_native: 'bytes'}},
      generic: {
        'T': ['string', 'number'],
      },
      isSymmetric: true,
      impl: {function: 'HLL_COUNT.INIT'},
    },
  },
  hll_combine: {
    takes: {'value': {sql_native: 'bytes'}},
    returns: {measure: {sql_native: 'bytes'}},
    impl: {function: 'HLL_COUNT.MERGE_PARTIAL'},
    isSymmetric: true,
  },
  hll_estimate: {
    takes: {'value': {sql_native: 'bytes'}},
    returns: {dimension: 'number'},
    impl: {function: 'HLL_COUNT.EXTRACT'},
  },
  hll_export: {
    takes: {'value': {sql_native: 'bytes'}},
    returns: {dimension: {sql_native: 'bytes'}},
    impl: {sql: 'CAST(${value} AS BYTES)'},
  },
  hll_import: {
    takes: {'value': {sql_native: 'bytes'}},
    returns: {dimension: {sql_native: 'bytes'}},
    impl: {sql: 'CAST(${value} AS BYTES)'},
  },
  ...def('repeat', {'str': 'string', 'n': 'number'}, 'string'),
  ...def('reverse', {'str': 'string'}, 'string'),
};
