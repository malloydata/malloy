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
} from './util';

const atan2: DefinitionBlueprint = {
  takes: {'y': 'number', 'x': 'number'},
  returns: 'number',
  impl: {function: 'ATAN2'},
};

const avg_moving: OverloadedDefinitionBlueprint = {
  'preceding': {
    generic: ['T', ['string', 'number', 'timestamp', 'date']],
    takes: {
      'value': {measure: {generic: 'T'}},
      'preceding': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {
      function: 'AVG',
      needsWindowOrderBy: true,
      between: {preceding: 'preceding', following: 0},
    },
  },
  'following': {
    generic: ['T', ['string', 'number', 'timestamp', 'date']],
    takes: {
      'value': {measure: {generic: 'T'}},
      'preceding': {literal: 'number'},
      'following': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {
      function: 'AVG',
      needsWindowOrderBy: true,
      between: {preceding: 'preceding', following: 'following'},
    },
  },
};

const concat: OverloadedDefinitionBlueprint = {
  'zero': {
    takes: {},
    returns: 'string',
    impl: {expr: {node: 'stringLiteral', literal: ''}},
  },
  'variadic': {
    takes: {
      'values': {
        variadic: ['string', 'number', 'date', 'timestamp', 'boolean'],
      },
    },
    returns: 'string',
    impl: {function: 'CONCAT'},
  },
};

const log: DefinitionBlueprint = {
  takes: {
    'value': 'number',
    'base': 'number',
  },
  returns: 'number',
  impl: {function: 'LOG'},
};

export const MALLOY_STANDARD_FUNCTIONS: DefinitionBlueprintMap = {
  atan2,
  avg_moving,
  concat,
  log,
};
