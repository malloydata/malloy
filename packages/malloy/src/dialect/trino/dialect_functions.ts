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

// Aggregate functions:

const approx_percentile: OverloadedDefinitionBlueprint = {
  default: {
    takes: {'value': 'number', 'percentage': 'number'},
    returns: {measure: 'number'},
    impl: {
      sql: 'APPROX_PERCENTILE(${value}, ${percentage})'
    },
  },

  with_error_threshold: {
    takes: {'value': 'number', 'percentage': 'number', 'error_threshold': 'number'},
    returns: {measure: 'number'},
    impl: {
      sql: 'APPROX_PERCENTILE(${value}, ${percentage}, ${error_threshold})'
    },
  }
}

const arbitrary: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'date', 'timestamp', 'boolean', 'json']],
  takes: {'value': {dimension: { generic: 'T' }}},
  returns: {measure: {generic: 'T'}},
  impl: {function: 'ARBITRARY'},
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
    sql: 'CORR(${y}, ${x})'
  },
};

const count_approx: DefinitionBlueprint = {
  takes: {'value': {dimension: 'any'}},
  returns: {measure: 'number'},
  impl: {function: 'APPROX_DISTINCT'},
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
}

// Scalar functions

const bitwise_and: DefinitionBlueprint = {
  takes: {'val1': 'number', 'val2': 'number'},
  returns: 'number',
  impl: {
    sql: 'BITWISE_AND(${val1}, ${val2})'
  }
}

const bitwise_or: DefinitionBlueprint = {
  takes: {'val1': 'number', 'val2': 'number'},
  returns: 'number',
  impl: {
    sql: 'BITWISE_OR(${val1}, ${val2})'
  }
}

const date_format: DefinitionBlueprint = {
  takes: {'ts_val': 'timestamp', 'format': 'string'},
  returns: 'string',
  impl: {
    sql: 'DATE_FORMAT(${ts_val}, ${format})'
  },
};

const date_parse : DefinitionBlueprint = {
  takes: {'ts_string': 'string', 'format': 'string'},
  returns: 'timestamp',
  impl: {
    sql: 'DATE_PARSE(${ts_string}, ${format})'
  },
};

const from_unixtime: DefinitionBlueprint = {
  takes: {'unixtime': 'number'},
  returns: 'timestamp',
  impl: {function: 'FROM_UNIXTIME'},
};

const json_extract_scalar: DefinitionBlueprint = {
  takes: {'json_val': 'string', 'json_path': 'string'},
  returns: 'string',
  impl: {sql: 'JSON_EXTRACT_SCALAR(${json_val}, ${json_path})'}
}

const regexp_like: DefinitionBlueprint = {
  takes: {'str': 'string', 'pattern': 'string'},
  returns: 'boolean',
  impl: {sql: 'REGEXP_LIKE(${str}, ${pattern})'},
}

const regexp_replace: OverloadedDefinitionBlueprint = {
  remove_matches: {
    takes: {'input_val': 'string', 'regexp_pattern': 'string'},
    returns: 'string',
    impl: {
      sql: "REGEXP_REPLACE(${input_val}, ${regexp_pattern})",
    },
  },

  replace_matches: {
    takes: {'input_val': 'string', 'regexp_pattern': 'string', 'replace_pattern': 'string'},
    returns: 'string',
    impl: {
      sql: "REGEXP_REPLACE(${input_val}, ${regexp_pattern}, ${replace_pattern})",
    },
  }
}

const to_unixtime: DefinitionBlueprint = {
  takes: {'ts_val': 'timestamp'},
  returns: 'number',
  impl: {function: 'TO_UNIXTIME'},
};

export const TRINO_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  // aggregate functions
  approx_percentile,
  arbitrary,
  bool_and,
  bool_or,
  corr,
  count_approx,
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
};
