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

const count_approx: DefinitionBlueprint = {
  takes: {'value': {dimension: 'any'}},
  returns: {measure: 'number'},
  impl: {function: 'APPROX_DISTINCT'},
};

const date_format: DefinitionBlueprint = {
  takes: {'value': 'timestamp', 'format': 'string'},
  returns: 'string',
  impl: {function: 'DATE_FORMAT'},
  tests: [
    [
      'date_format(@2024-09-05 17:03:55, "%Y-%m-%d %H:%i:%")',
      '2024-09-05 17:03:55',
    ],
  ],
};

const from_unixtime: DefinitionBlueprint = {
  takes: {'unixtime': 'number'},
  returns: 'timestamp',
  impl: {function: 'FROM_UNIXTIME'},
  tests: [['from_unixtime(1725555835) = @2024-09-05 17:03:55', true]],
};

const json_extract_scalar: DefinitionBlueprint = {
  takes: {'value': 'string', 'json_path': 'string'},
  returns: 'string',
  impl: {function: 'JSON_EXTRACT_SCALAR'},
};

const json_parse: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'json',
  impl: {function: 'JSON_PARSE'},
  tests: [['json_extract_scalar(json_parse(\'{"a": "foo"}\'), "$.a")', 'foo']],
};

const regexp_replace: OverloadedDefinitionBlueprint = {
  pattern_only: {
    takes: {'value': 'string', 'pattern': ['string', 'regular expression']},
    returns: 'string',
    impl: {function: 'REGEXP_REPLACE'},
    tests: [["regexp_replace('1a 2b 14m', '\\d+[ab] ')", '14m']],
  },
  with_replacement: {
    takes: {'value': 'string', 'pattern': ['string', 'regular expression']},
    returns: 'string',
    impl: {function: 'REGEXP_REPLACE'},
    tests: [
      ["regexp_replace('1a 2b 14m', '(\\d+)([ab]) ', '3c$2 ')", '3ca 3cb 14m'],
    ],
  },
  // TODO regexp_replace(string, pattern, function) -> varchar()
};

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    returns: {measure: 'string'},
    supportsOrderBy: true,
    impl: {
      sql: "ARRAY_JOIN(ARRAY_AGG(${value} ${order_by:}), ',')",
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
      sql: 'ARRAY_JOIN(ARRAY_AGG(${value} ${order_by:}), ${separator})',
    },
  },
};

const string_agg_distinct: OverloadedDefinitionBlueprint = {
  default_separator: {
    ...string_agg['default_separator'],
    isSymmetric: true,
    impl: {
      sql: "ARRAY_JOIN(ARRAY_AGG(DISTINCT ${value} ${order_by:}), ',')",
    },
  },
  with_separator: {
    ...string_agg['with_separator'],
    isSymmetric: true,
    impl: {
      sql: 'ARRAY_JOIN(ARRAY_AGG(DISTINCT ${value} ${order_by:}), ${separator})',
    },
  },
};

const to_unixtime: DefinitionBlueprint = {
  takes: {'value': 'timestamp'},
  returns: 'number',
  impl: {function: 'TO_UNIXTIME'},
  tests: [['to_unixtime(@2024-09-05 17:03:55)', 1725555835]],
};

export const TRINO_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  count_approx,
  date_format,
  from_unixtime,
  json_extract_scalar,
  json_parse,
  regexp_replace,
  string_agg,
  string_agg_distinct,
  to_unixtime,
};
