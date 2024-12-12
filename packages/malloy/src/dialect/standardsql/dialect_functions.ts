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
};
