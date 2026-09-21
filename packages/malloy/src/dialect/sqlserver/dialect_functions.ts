/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AggregateOrderByNode} from '../../model';
import type {
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from '../functions/util';
import {def, arg as a, sql} from '../functions/util';

const order_by: AggregateOrderByNode = {
  node: 'aggregate_order_by',
  prefix: ' WITHIN GROUP (',
  suffix: ')',
};

// STRING_AGG's result is limited to 8000 bytes unless its input is a MAX type.
const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      expr: sql`STRING_AGG(CAST(${a('value')} AS NVARCHAR(MAX)), ',')${order_by}`,
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
      expr: sql`STRING_AGG(CAST(${a('value')} AS NVARCHAR(MAX)), ${a('separator')})${order_by}`,
    },
  },
};

export const SQLSERVER_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  string_agg,
  ...def('reverse', {'str': 'string'}, 'string'),
};
