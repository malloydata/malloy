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

/*
 * We are experimenting with the best way to make this file easy for someone
 * to step in and modify, AND to make it easy to create a new dialect.
 *
 * So in this file we are experimenting with various ways to define things.
 * The most general and powerful is to write a DefinitionBlueprint or
 * OverloadedDefinitionBlueprint, naming it with the name of the function
 * you want to add, and then to add that name to the dialcect function list.
 *
 * Experimentally, there is also a function def which creates a
 * DefinitionBlueprint for you. For simple blueprints, you can use the wrapper
 * definition generator def(), and there are examples in this file
 * of how to do that, and def() has some hover-documentation.
 *
 * It is an experiment so please let us know if you like def(),
 * or if you prefer editing the Blueprint data structures.
 */

// Cute shortcut So you can write things like: {array: T} and {dimension: T}
const T: TypeDescBlueprint = {generic: 'T'};

// Aggregate functions:

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

// Scalar functions

const date_parse: DefinitionBlueprint = {
  takes: {'ts_string': 'string', 'format': 'string'},
  returns: 'timestamp',
  impl: {
    sql: 'DATE_PARSE(${ts_string}, ${format})',
  },
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

const percent_rank: DefinitionBlueprint = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'PERCENT_RANK', needsWindowOrderBy: true},
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
    returns: {array: 'number'},
    impl: {function: 'SEQUENCE'},
  },
  num_to_num_step: {
    takes: {'start': 'number', 'stop': 'number', 'step': 'number'},
    returns: {array: 'number'},
    impl: {function: 'SEQUENCE'},
  },
  date_to_date: {
    takes: {'start': 'date', 'stop': 'date'},
    returns: {array: 'date'},
    impl: {function: 'SEQUENCE'},
  },
};

const string_reverse: DefinitionBlueprint = {
  takes: {'str': 'string'},
  returns: 'string',
  impl: {sql: 'REVERSE(CAST(${str} AS VARCHAR))'},
};

/**
 * This map is for functions which exist in both Presto and Trino.
 * If you are adding functions which only exist in Presto, put them in
 * to PRESTO_DIALECT_FUNCTIONS.
 *
 * If you have a function which works differently in each, add them to
 * both.
 */
export const TRINO_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  // string functions
  reverse: string_reverse,

  // aggregate functions
  // TODO: Approx percentile can be called with a third argument; we probably
  // want to implement that at some point
  // In Presto, this is an "error" parameter between 0 and 1
  // In Trino, this is a "weight" parameter between 1 and 99
  ...def(
    'approx_percentile',
    {'value': 'number', 'percentage': 'number'},
    {measure: 'number'}
  ),
  ...def(
    'arbitrary',
    {'value': {dimension: T}},
    {measure: T},
    {
      generic: {
        'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
      },
    }
  ),
  ...def(
    'bitwise_and_agg',
    {'value': {dimension: 'number'}},
    {measure: 'number'},
    {isSymmetric: true}
  ),
  ...def(
    'bitwise_or_agg',
    {'value': {dimension: 'number'}},
    {measure: 'number'},
    {isSymmetric: true}
  ),
  ...def(
    'bitwise_xor_agg',
    {'value': {dimension: 'number'}},
    {measure: 'number'},
    {isSymmetric: true}
  ),
  ...def('bool_and', {'value': {dimension: 'boolean'}}, {measure: 'boolean'}),
  ...def('bool_or', {'value': {dimension: 'boolean'}}, {measure: 'boolean'}),
  ...def(
    'corr',
    {'y': {dimension: 'number'}, 'x': {dimension: 'number'}},
    {measure: 'number'}
  ),
  ...def(
    'count_approx',
    {'value': {dimension: 'any'}},
    {measure: 'number'},
    {
      impl: {function: 'APPROX_DISTINCT'},
      isSymmetric: true,
    }
  ),
  hll_accumulate: {
    default: {
      takes: {'value': {dimension: T}},
      returns: {measure: {sql_native: 'hyperloglog'}},
      generic: {
        'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
      },
      isSymmetric: true,
      impl: {function: 'APPROX_SET'},
    },
    with_percent: {
      takes: {'value': {dimension: T}, 'accuracy': 'number'},
      returns: {measure: {sql_native: 'hyperloglog'}},
      generic: {
        'T': ['string', 'number', 'date', 'timestamp', 'boolean', 'json'],
      },
      isSymmetric: true,
      impl: {function: 'APPROX_SET'},
    },
  },
  hll_combine: {
    takes: {'value': {sql_native: 'hyperloglog'}},
    returns: {measure: {sql_native: 'hyperloglog'}},
    impl: {function: 'MERGE'},
    isSymmetric: true,
  },
  hll_estimate: {
    takes: {'value': {sql_native: 'hyperloglog'}},
    returns: {dimension: 'number'},
    impl: {function: 'CARDINALITY'},
  },
  hll_export: {
    takes: {'value': {sql_native: 'hyperloglog'}},
    returns: {dimension: {sql_native: 'varbinary'}},
    impl: {sql: 'CAST(${value} AS VARBINARY)'},
  },
  hll_import: {
    takes: {'value': {sql_native: 'varbinary'}},
    returns: {dimension: {sql_native: 'hyperloglog'}},
    impl: {sql: 'CAST(${value} AS HyperLogLog)'},
  },
  max_by,
  min_by,
  string_agg,
  string_agg_distinct,
  ...def('variance', {'n': 'number'}, {measure: 'number'}),

  // scalar functions
  ...def('bitwise_and', {'val1': 'number', 'val2': 'number'}, 'number'),
  ...def('bitwise_or', {'val1': 'number', 'val2': 'number'}, 'number'),
  ...def('date_format', {'ts_val': 'timestamp', 'format': 'string'}, 'string'),
  date_parse,
  ...def('from_unixtime', {'unixtime': 'number'}, 'timestamp'),
  json_extract_scalar,
  regexp_like,
  regexp_replace,
  ...def('to_unixtime', {'ts_val': 'timestamp'}, 'number'),
  ...def('url_extract_fragment', {'url': 'string'}, 'string'),
  ...def('url_extract_host', {'url': 'string'}, 'string'),
  ...def(
    'url_extract_parameter',
    {'url': 'string', 'parameter': 'string'},
    'string'
  ),
  ...def('url_extract_path', {'url': 'string'}, 'string'),
  ...def('url_extract_port', {'url': 'string'}, 'number'),
  ...def('url_extract_protocol', {'url': 'string'}, 'string'),
  ...def('url_extract_query', {'url': 'string'}, 'string'),

  // window functions
  percent_rank,

  // array function
  array_join,
  sequence,
  ...def('array_distinct', {'x': {array: T}}, {array: T}),
  ...def('array_except', {'x': {array: T}, 'y': {array: T}}, {array: T}),
  ...def('array_intersect', {'x': {array: T}, 'y': {array: T}}, {array: T}),
  ...def('array_max', {'x': {array: T}}, T),
  ...def('array_min', {'x': {array: T}}, T),
  ...def('array_normalize', {'x': {array: T}, 'p': 'number'}, {array: T}),
  ...def('array_remove', {'x': {array: T}, 'element': T}, {array: T}),
  ...def('array_sort', {'x': {array: T}}, {array: T}),
  ...def('arrays_overlap', {'x': {array: T}, 'y': {array: T}}, 'boolean'),
  ...def('array_union', {'x': {array: T}, 'y': {array: T}}, {array: T}),
  ...def('cardinality', {'x': {array: T}}, 'number'),
  ...def('shuffle', {'x': {array: T}}, {array: T}),
  ...def('combinations', {'x': {array: T}, 'n': 'number'}, {array: {array: T}}),
  ...def('contains', {'x': {array: T}, 'element': T}, 'boolean'),
  ...def('element_at', {'x': {array: T}, 'oridnal': 'number'}, T),
  ...def('flatten', {'x': {array: {array: T}}}, {array: T}),
  ...def('ngrams', {'x': {array: T}, 'n': 'number'}, {array: {array: T}}),
  ...def('repeat', {'x': T, 'n': 'number'}, {array: T}),
  ...def(
    'slice',
    {'x': {array: T}, 'start': 'number', 'len': 'number'},
    {array: T}
  ),
  ...def('split', {to_split: 'string', seperator: 'string'}, {array: 'string'}),
  ...def('trim_array', {'x': {array: T}, 'n': 'number'}, {array: T}),
  ...def(
    'array_split_into_chunks',
    {'x': {array: T}, 'n': 'number'},
    {array: {array: T}}
  ),
};

/******** Presto Only *********/

export const PRESTO_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  ...TRINO_DIALECT_FUNCTIONS,
  array_intersect: {
    ...def('array_intersect', {'x': {array: T}, 'y': {array: T}}, {array: T}),
    nested_array: {
      takes: {'x': {array: {array: T}}},
      generic: {'T': ['any']},
      returns: {array: T},
      impl: {function: 'ARRAY_INTERSECT'},
    },
  },
  array_least_frequent: {
    ...def('array_least_frequent', {'x': {array: T}}, {array: T}),
    bottom_n: {
      takes: {'array_v': {array: T}, 'n': 'number'},
      returns: {array: T},
      generic: {'T': ['any']},
      impl: {function: 'ARRAY_LEAST_FREQUENT'},
    },
  },
  array_position: {
    ...def('array_position', {'x': {array: T}, 'el': T}, 'number'),
    nth_instance: {
      takes: {'x': {array: T}, 'el': T, 'instance': 'number'},
      generic: {'T': ['any']},
      returns: 'number',
      impl: {function: 'ARRAY_POSITION'},
    },
  },
  reverse: {
    string_reverse,
    ...def('reverse', {'x': {array: T}}, {array: T}),
  },
  ...def('array_average', {'x': {array: T}}, 'number'),
  ...def('array_has_duplicates', {'x': {array: T}}, 'boolean'),
  ...def('array_cum_sum', {numeric_array: {array: T}}, {array: 'number'}),
  ...def('array_duplicates', {'x': {array: T}}, {array: T}),
  ...def('array_sum', {'x': {array: T}}, 'number'),
  ...def('array_sort_desc', {'x': {array: T}}, {array: T}),
  ...def('remove_nulls', {'x': {array: T}}, {array: T}),
  ...def('array_top_n', {'x': {array: T}, 'n': 'number'}, {array: T}),
};
