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

// Aggregate functions:

// TODO: Approx percentile can be called with a third argument; we probably
// want to implement that at some point
// In Presto, this is an "error" parameter between 0 and 1
// In Trino, this is a "weight" parameter between 1 and 99
const approx_percentile: DefinitionBlueprint = {
  takes: {'value': 'number', 'percentage': 'number'},
  returns: {measure: 'number'},
  impl: {
    function: 'APPROX_PERCENTILE',
  },
};

const arbitrary: DefinitionBlueprint = {
  generic: {'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json']},
  takes: {'value': {dimension: {generic: 'T'}}},
  returns: {measure: {generic: 'T'}},
  impl: {function: 'ARBITRARY'},
};

const bitwise_and_agg: DefinitionBlueprint = {
  takes: {'value': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {function: 'BITWISE_OR_AGG'},
};

const bitwise_or_agg: DefinitionBlueprint = {
  takes: {'value': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {function: 'BITWISE_AND_AGG'},
};

const bitwise_xor_agg: DefinitionBlueprint = {
  takes: {'value': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {function: 'BITWISE_XOR_AGG'},
};

const bool_and: DefinitionBlueprint = {
  takes: {'value': {dimension: 'boolean'}},
  returns: {measure: 'boolean'},
  impl: {function: 'BOOL_AND'},
};

const bool_or: DefinitionBlueprint = {
  takes: {'value': {dimension: 'boolean'}},
  returns: {measure: 'boolean'},
  impl: {function: 'BOOL_OR'},
};

const corr: DefinitionBlueprint = {
  takes: {'y': {dimension: 'number'}, 'x': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {
    sql: 'CORR(${y}, ${x})',
  },
};

const count_approx: DefinitionBlueprint = {
  takes: {'value': {dimension: 'any'}},
  returns: {measure: 'number'},
  impl: {function: 'APPROX_DISTINCT'},
  isSymmetric: true,
};

const hll_accumulate: OverloadedDefinitionBlueprint = {
  default: {
    generic: [
      'T',
      ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
    ],
    takes: {'value': {dimension: {generic: 'T'}}},
    returns: {measure: 'string'},
    isSymmetric: true,
    impl: {
      function: 'APPROX_SET',
    },
  },
  with_percent: {
    generic: [
      'T',
      ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
    ],
    takes: {'value': {dimension: {generic: 'T'}}, 'accuracy': 'number'},
    returns: {measure: 'string'},
    isSymmetric: true,
    impl: {
      function: 'APPROX_SET',
    },
  },
};

const hll_combine: DefinitionBlueprint = {
  takes: {
    'value': 'string',
  },
  returns: {measure: 'string'},
  impl: {function: 'MERGE'},
  isSymmetric: true,
};

const hll_estimate: DefinitionBlueprint = {
  takes: {
    'value': 'string',
  },
  returns: {dimension: 'number'},
  impl: {function: 'CARDINALITY'},
};

const hll_export: DefinitionBlueprint = {
  takes: {
    'value': 'string',
  },
  returns: {dimension: 'string'},
  impl: {
    sql: 'CAST(${value} AS VARBINARY)',
  },
};

const hll_import: DefinitionBlueprint = {
  takes: {
    'value': 'string',
  },
  returns: {dimension: 'string'},
  impl: {
    sql: 'CAST(${value} AS HyperLogLog)',
  },
};

const max_by: DefinitionBlueprint = {
  generic: {'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json']},
  takes: {
    'value': {dimension: {generic: 'T'}},
    'order_by_val': {dimension: 'any'},
  },
  returns: {measure: {generic: 'T'}},
  impl: {function: 'MAX_BY'},
  isSymmetric: true,
};

const min_by: DefinitionBlueprint = {
  generic: {'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json']},
  takes: {
    'value': {dimension: {generic: 'T'}},
    'order_by_val': {dimension: 'any'},
  },
  returns: {measure: {generic: 'T'}},
  impl: {function: 'MIN_BY'},
  isSymmetric: true,
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

const variance: DefinitionBlueprint = {
  takes: {'value': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {function: 'VARIANCE'},
};

// Scalar functions

const bitwise_and: DefinitionBlueprint = {
  takes: {'val1': 'number', 'val2': 'number'},
  returns: 'number',
  impl: {
    function: 'BITWISE_AND',
  },
};

const bitwise_or: DefinitionBlueprint = {
  takes: {'val1': 'number', 'val2': 'number'},
  returns: 'number',
  impl: {
    function: 'BITWISE_OR',
  },
};

const date_format: DefinitionBlueprint = {
  takes: {'ts_val': 'timestamp', 'format': 'string'},
  returns: 'string',
  impl: {
    function: 'DATE_FORMAT',
  },
};

const date_parse: DefinitionBlueprint = {
  takes: {'ts_string': 'string', 'format': 'string'},
  returns: 'timestamp',
  impl: {
    sql: 'DATE_PARSE(${ts_string}, ${format})',
  },
};

const from_unixtime: DefinitionBlueprint = {
  takes: {'unixtime': 'number'},
  returns: 'timestamp',
  impl: {function: 'FROM_UNIXTIME'},
};

// TODO: support Presto JSON types
// eventually, this should take 'json_val': ['string', 'json']
const json_extract_scalar: DefinitionBlueprint = {
  takes: {'json_val': 'string', 'json_path': 'string'},
  returns: 'string',
  impl: {function: 'JSON_EXTRACT_SCALAR'},
};

const regexp_like: DefinitionBlueprint = {
  takes: {'str': 'string', 'pattern': ['string', 'regular expression']},
  returns: 'boolean',
  impl: {function: 'REGEXP_LIKE'},
};

const regexp_replace: OverloadedDefinitionBlueprint = {
  remove_matches: {
    takes: {
      'input_val': 'string',
      'regexp_pattern': ['string', 'regular expression'],
    },
    returns: 'string',
    impl: {
      function: 'REGEXP_REPLACE',
    },
  },

  replace_matches: {
    takes: {
      'input_val': 'string',
      'regexp_pattern': ['string', 'regular expression'],
      'replacement': 'string',
    },
    returns: 'string',
    impl: {
      function: 'REGEXP_REPLACE',
    },
  },
};

const to_unixtime: DefinitionBlueprint = {
  takes: {'ts_val': 'timestamp'},
  returns: 'number',
  impl: {function: 'TO_UNIXTIME'},
};

const percent_rank: DefinitionBlueprint = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'PERCENT_RANK', needsWindowOrderBy: true},
};

const url_extract_fragment: DefinitionBlueprint = {
  takes: {'url': 'string'},
  returns: 'string',
  impl: {function: 'URL_EXTRACT_FRAGMENT'},
};

const url_extract_host: DefinitionBlueprint = {
  takes: {'url': 'string'},
  returns: 'string',
  impl: {function: 'URL_EXTRACT_HOST'},
};

const url_extract_parameter: DefinitionBlueprint = {
  takes: {'url': 'string', 'parameter': 'string'},
  returns: 'string',
  impl: {function: 'URL_EXTRACT_PARAMETER'},
};

const url_extract_path: DefinitionBlueprint = {
  takes: {'url': 'string'},
  returns: 'string',
  impl: {function: 'URL_EXTRACT_PATH'},
};

const url_extract_port: DefinitionBlueprint = {
  takes: {'url': 'string'},
  returns: 'number',
  impl: {function: 'URL_EXTRACT_PORT'},
};

const url_extract_protocol: DefinitionBlueprint = {
  takes: {'url': 'string'},
  returns: 'string',
  impl: {function: 'URL_EXTRACT_PROTOCOL'},
};

const url_extract_query: DefinitionBlueprint = {
  takes: {'url': 'string'},
  returns: 'string',
  impl: {function: 'URL_EXTRACT_QUERY'},
};

const split: DefinitionBlueprint = {
  takes: {'src': 'string', 'splitChar': 'string'},
  returns: {array: 'string'},
  impl: {function: 'SPLIT'},
};

export const TRINO_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  // aggregate functions
  approx_percentile,
  arbitrary,
  bitwise_and_agg,
  bitwise_or_agg,
  bitwise_xor_agg,
  bool_and,
  bool_or,
  corr,
  count_approx,
  hll_accumulate,
  hll_combine,
  max_by,
  min_by,
  string_agg,
  string_agg_distinct,
  variance,

  // scalar functions
  bitwise_and,
  bitwise_or,
  date_format,
  date_parse,
  from_unixtime,
  hll_estimate,
  hll_export,
  hll_import,
  json_extract_scalar,
  regexp_like,
  regexp_replace,
  to_unixtime,
  url_extract_fragment,
  url_extract_host,
  url_extract_parameter,
  url_extract_path,
  url_extract_port,
  url_extract_protocol,
  url_extract_query,

  // window functions
  percent_rank,

  split,
};
