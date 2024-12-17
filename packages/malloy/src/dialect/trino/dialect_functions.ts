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
  TypeDescBlueprint,
  wrapDef,
} from '../functions/util';

const T: TypeDescBlueprint = {generic: 'T'};

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
  takes: {'value': {dimension: T}},
  returns: {measure: T},
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
    generic: {
      'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
    },
    takes: {'value': {dimension: {generic: 'T'}}},
    returns: {measure: {sql_native: 'hyperloglog'}},
    isSymmetric: true,
    impl: {
      function: 'APPROX_SET',
    },
  },
  with_percent: {
    generic: {
      'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
    },
    takes: {'value': {dimension: {generic: 'T'}}, 'accuracy': 'number'},
    returns: {measure: {sql_native: 'hyperloglog'}},
    isSymmetric: true,
    impl: {
      function: 'APPROX_SET',
    },
  },
};

const hll_combine: DefinitionBlueprint = {
  takes: {
    'value': {sql_native: 'hyperloglog'},
  },
  returns: {measure: {sql_native: 'hyperloglog'}},
  impl: {function: 'MERGE'},
  isSymmetric: true,
};

const hll_estimate: DefinitionBlueprint = {
  takes: {
    'value': {sql_native: 'hyperloglog'},
  },
  returns: {dimension: 'number'},
  impl: {function: 'CARDINALITY'},
};

const hll_export: DefinitionBlueprint = {
  takes: {
    'value': {sql_native: 'hyperloglog'},
  },
  returns: {dimension: {sql_native: 'varbinary'}},
  impl: {
    sql: 'CAST(${value} AS VARBINARY)',
  },
};

const hll_import: DefinitionBlueprint = {
  takes: {
    'value': {sql_native: 'varbinary'},
  },
  returns: {dimension: {sql_native: 'hyperloglog'}},
  impl: {
    sql: 'CAST(${value} AS HyperLogLog)',
  },
};

const max_by: DefinitionBlueprint = {
  generic: {'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json']},
  takes: {
    'value': {dimension: T},
    'order_by_val': {dimension: 'any'},
  },
  returns: {measure: T},
  impl: {function: 'MAX_BY'},
  isSymmetric: true,
};

const min_by: DefinitionBlueprint = {
  generic: {'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json']},
  takes: {
    'value': {dimension: T},
    'order_by_val': {dimension: 'any'},
  },
  returns: {measure: T},
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

const array_join: OverloadedDefinitionBlueprint = {
  skip_nulls: {
    takes: {
      'array_v': {array: T},
      'sep': 'string',
    },
    generic: {T: ['any']},
    returns: 'string',
    impl: {function: 'ARRAY_JOIN'},
  },
  null_aware: {
    takes: {
      'array_v': T,
      'sep': 'string',
      'nullStr': 'string',
    },
    generic: {T: ['any']},
    returns: 'string',
    impl: {function: 'ARRAY_JOIN'},
  },
};

const sequence: OverloadedDefinitionBlueprint = {
  num_to_num: {
    takes: {'start': 'number', 'stop': 'number'},
    generic: {'T': ['any']},
    returns: {array: 'number'},
    impl: {function: 'SEQUENCE'},
  },
  num_to_num_step: {
    takes: {'start': 'number', 'stop': 'number', 'step': 'number'},
    generic: {'T': ['any']},
    returns: {array: 'number'},
    impl: {function: 'SEQUENCE'},
  },
  date_to_date: {
    takes: {'start': 'date', 'stop': 'date'},
    generic: {'T': ['any']},
    returns: {array: 'date'},
    impl: {function: 'SEQUENCE'},
  },
  // mtoy todo document missing sequence
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

  // array functions except those below
  array_join,
  sequence,
  ...wrapDef('array_distinct', {x: {array: T}}, {array: T}),
  ...wrapDef('array_except', {x: {array: T}, y: {array: T}}, {array: T}),
  ...wrapDef('array_intersect', {x: {array: T}, y: {array: T}}, {array: T}),
  ...wrapDef('array_max', {x: {array: T}}, T),
  ...wrapDef('array_min', {x: {array: T}}, T),
  ...wrapDef('array_normalize', {x: {array: T}, p: 'number'}, {array: T}),
  ...wrapDef('array_remove', {x: {array: T}, element: T}, {array: T}),
  // mtoy todo document mising lambda sort
  ...wrapDef('array_sort', {x: {array: T}}, {array: T}),
  ...wrapDef('arrays_overlap', {x: {array: T}, y: {array: T}}, 'boolean'),
  ...wrapDef('array_union', {x: {array: T}, y: {array: T}}, {array: T}),
  ...wrapDef('cardinality', {x: {array: T}}, 'number'),
  ...wrapDef('reverse', {x: {array: T}}, {array: T}),
  ...wrapDef('shuffle', {x: {array: T}}, {array: T}),
  ...wrapDef('combinations', {x: {array: T}, n: 'number'}, {array: {array: T}}),
  ...wrapDef('contains', {x: {array: T}, element: T}, 'boolean'),
  ...wrapDef('element_at', {x: {array: T}, oridnal: 'number'}, T),
  ...wrapDef('flatten', {x: {array: {array: T}}}, {array: T}),
  ...wrapDef('ngrams', {x: {array: T}, n: 'number'}, {array: {array: T}}),
  ...wrapDef('repeat', {x: T, n: 'number'}, {array: T}),
  ...wrapDef(
    'slice',
    {x: {array: T}, start: 'number', len: 'number'},
    {array: T}
  ),
  ...wrapDef(
    'split',
    {to_split: 'string', seperator: 'string'},
    {array: 'string'}
  ),
  ...wrapDef('trim_array', {x: {array: T}, n: 'number'}, {array: T}),
  ...wrapDef(
    'array_split_into_chunks',
    {x: {array: T}, n: 'number'},
    {array: {array: T}}
  ),
};

/******** Presto Only *********/

const array_position: OverloadedDefinitionBlueprint = {
  first_instance: {
    takes: {x: {array: T}, el: T},
    generic: {T: ['any']},
    returns: 'number',
    impl: {function: 'ARRAY_POSITION'},
  },
  nth_instance: {
    takes: {x: {array: T}, el: T, instance: 'number'},
    generic: {T: ['any']},
    returns: 'number',
    impl: {function: 'ARRAY_POSITION'},
  },
};

const array_intersect: OverloadedDefinitionBlueprint = {
  two_arrays: {
    takes: {
      'a': {array: T},
      'b': {array: T},
    },
    generic: {'T': ['any']},
    returns: {array: T},
    impl: {function: 'ARRAY_INTERSECT'},
  },
  nested_array: {
    takes: {'a': {array: {array: T}}},
    generic: {'T': ['any']},
    returns: {array: T},
    impl: {function: 'ARRAY_INTERSECT'},
  },
};

const array_least_frequent: OverloadedDefinitionBlueprint = {
  array_only: {
    takes: {'array_v': {array: T}},
    generic: {'T': ['any']},
    returns: {array: T},
    impl: {function: 'ARRAY_LEAST_FREQUENT'},
  },
  bottom: {
    takes: {
      'array_v': {array: T},
      'count': 'number',
    },
    generic: {'T': ['any']},
    returns: {array: T},
    impl: {function: 'ARRAY_LEAST_FREQUENT'},
  },
};

const reverse: OverloadedDefinitionBlueprint = {
  yarra: {
    takes: {'array_v': {array: T}},
    returns: {array: T},
    generic: {'T': ['any']},
    impl: {function: 'REVERSE'},
  },
  ngirts: {
    takes: {'array_v': 'string'},
    returns: 'string',
    impl: {function: 'REVERSE'},
  },
};

export const PRESTO_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  ...TRINO_DIALECT_FUNCTIONS,
  array_intersect,
  array_least_frequent,
  array_position,
  reverse,
  ...wrapDef('array_average', {x: {array: T}}, 'number'),
  ...wrapDef('array_has_duplicates', {x: {array: T}}, 'boolean'),
  ...wrapDef('array_cum_sum', {numeric_array: {array: T}}, {array: 'number'}),
  ...wrapDef('array_duplicates', {x: {array: T}}, {array: T}),
  ...wrapDef('array_sum', {x: {array: T}}, 'number'),
  ...wrapDef('array_sort_desc', {x: {array: T}}, {array: T}),
  ...wrapDef('remove_nulls', {x: {array: T}}, {array: T}),
  ...wrapDef('array_top_n', {x: {array: T}, n: 'number'}, {array: T}),
};
