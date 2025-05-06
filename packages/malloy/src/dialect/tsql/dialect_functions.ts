/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from '../functions/util';
import {def} from '../functions/util';

const string_agg: OverloadedDefinitionBlueprint = {
  // TODO (vitor): Done-ish. remove this comment after tests
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      sql: "STRING_AGG(${value}, ',') WITHIN GROUP (ORDER BY ${order_by})",
    },
  },
  // TODO (vitor): Done-ish. remove this comment after tests
  with_separator: {
    takes: {
      'value': {dimension: 'string'},
      'separator': {literal: 'string'},
    },
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      sql: 'STRING_AGG(${value}, ${separator}) WITHIN GROUP (ORDER BY ${order_by})',
    },
  },
};

// TODO (vitor): Discuss the possibility of having string_agg_distinct here.

export const TSQL_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  string_agg,
  ...def('repeat', {'str': 'string', 'n': 'number'}, 'string'),
  ...def('reverse', {'str': 'string'}, 'string'),
};
