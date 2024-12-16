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

const arrayOfT: TypeDescBlueprint = {array: {generic: 'T'}};
const arrayOfArrayOfT: TypeDescBlueprint = {array: arrayOfT};

const array_intersect: OverloadedDefinitionBlueprint = {
  two_arrays: {
    takes: {
      'a': arrayOfT,
      'b': arrayOfT,
    },
    generic: {'T': ['any']},
    returns: arrayOfT,
    impl: {function: 'ARRAY_INTERSECT'},
  },
  nested_array: {
    takes: {'a': arrayOfArrayOfT},
    generic: {'T': ['any']},
    returns: arrayOfT,
    impl: {function: 'ARRAY_INTERSECT'},
  },
};

const array_join: OverloadedDefinitionBlueprint = {
  skip_nulls: {
    takes: {
      'theArray': arrayOfT,
      'sep': 'string',
    },
    generic: {'T': ['any']},
    returns: 'string',
    impl: {function: 'ARRAY_JOIN'},
  },
  null_aware: {
    takes: {
      'theArray': arrayOfT,
      'sep': 'string',
      'nullStr': {generic: 'T'},
    },
    generic: {'T': ['any']},
    returns: 'string',
    impl: {function: 'ARRAY_JOIN'},
  },
};

const array_least_frequent: OverloadedDefinitionBlueprint = {
  array_only: {
    takes: {'theArray': arrayOfT},
    generic: {'T': ['any']},
    returns: arrayOfT,
    impl: {function: 'ARRAY_LEAST_FREQUENT'},
  },
  bottom: {
    takes: {
      'theArray': arrayOfT,
      'count': 'number',
    },
    generic: {'T': ['any']},
    returns: arrayOfT,
    impl: {function: 'ARRAY_LEAST_FREQUENT'},
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
  array_intersect,
  array_join,
  array_least_frequent,
  sequence,
};

/**
 * Lazy function to add wrapper blueprint definition for non overloaded functions
 * which have generic array in their parameter list or return value
 * @param name function name
 * @param types list of types, last is return type
 */
function define(
  name: string,
  takes: Record<string, TypeDescBlueprint>,
  returns: TypeDescBlueprint
): void {
  const newDef: DefinitionBlueprint = {
    takes,
    generic: {'T': ['any']},
    returns,
    impl: {function: name.toUpperCase()},
  };
  TRINO_DIALECT_FUNCTIONS[name] = newDef;
}

define('array_average', {any_array: arrayOfT}, 'number');
define('array_cum_sum', {numeric_array: arrayOfT}, {array: 'number'});
define('array_distinct', {any_array: arrayOfT}, arrayOfT);
define('array_duplicates', {any_array: arrayOfT}, arrayOfT);
define('array_except', {src_array: arrayOfT, except_array: arrayOfT}, arrayOfT);
define('array_has_duplicates', {any_array: arrayOfT}, 'boolean');
define('array_max', {any_array: arrayOfT}, {generic: 'T'});
define('array_min', {any_array: arrayOfT}, {generic: 'T'});
define('array_normalize', {numeric_array: arrayOfT, p: 'number'}, arrayOfT);
define(
  'array_position',
  {any_array: arrayOfT, element: {generic: 'T'}},
  'number'
);
define(
  'array_remove',
  {any_array: arrayOfT, element: {generic: 'T'}},
  arrayOfT
);
// mtoy todo document missing lambda sort
define('array_sort', {any_sortable_array: arrayOfT}, arrayOfT);
define('array_sort_desc', {any_sortable_array: arrayOfT}, arrayOfT);
define(
  'array_split_into_chunks',
  {any_array: arrayOfT, chunkSize: 'number'},
  arrayOfArrayOfT
);
define('array_sum', {numeric_array: arrayOfT}, 'number');
define(
  'arrays_overlap',
  {left_array: arrayOfT, right_array: arrayOfT},
  'boolean'
);
define('array_union', {left_array: arrayOfT, right_array: arrayOfT}, arrayOfT);
define('cardinality', {any_array: arrayOfT}, 'number');
define('remove_nulls', {any_array: arrayOfT}, arrayOfT);
define('reverse', {any_array: arrayOfT}, arrayOfT);
define('shuffle', {any_array: arrayOfT}, arrayOfT);
define('array_top_n', {sortable_array: arrayOfT, n: 'number'}, arrayOfT);
define('combinations', {any_array: arrayOfT, n: 'number'}, arrayOfArrayOfT);
define('contains', {any_array: arrayOfT, element: {generic: 'T'}}, 'boolean');
define('element_at', {any_array: arrayOfT, oridnal: 'number'}, {generic: 'T'});
// hard to believe, but this is what flatten does
define('flatten', {nested_array: arrayOfArrayOfT}, arrayOfT);
define('ngrams', {any_array: arrayOfT, n: 'number'}, arrayOfArrayOfT);
define('repeat', {element: {generic: 'T'}, n: 'number'}, arrayOfT);
define(
  'slice',
  {any_array: arrayOfT, start: 'number', len: 'number'},
  arrayOfT
);
define('split', {to_split: 'string', seperator: 'string'}, {array: 'string'});
define('trim_array', {any_array: arrayOfT, n: 'number'}, arrayOfT);
