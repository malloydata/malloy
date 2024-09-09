/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {ExpressionValueType} from '../../model';
import {
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  DialectFunctionOverloadDef,
  OverloadedDefinitionBlueprint,
  OverrideMap,
  expandBlueprintMap,
  expandOverrideMapFromBase,
} from './util';

const abs: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ABS'},
};

const acos: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ACOS'},
};

const ascii: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'ASCII'},
};

const asin: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ASIN'},
};

const atan2: DefinitionBlueprint = {
  takes: {'y': 'number', 'x': 'number'},
  returns: 'number',
  impl: {function: 'ATAN2'},
};

const atan: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ATAN'},
};

const byte_length: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'BYTE_LENGTH'},
};

const ceil: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'CEIL'},
};

const chr: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'string',
  impl: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE CHR(${value}) END"},
};

const coalesce: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date', 'json']],
  takes: {'value': {variadic: {generic: 'T'}}},
  returns: {generic: 'T'},
  impl: {function: 'COALESCE'},
};

const concat: OverloadedDefinitionBlueprint = {
  'empty': {
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

const cos: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'COS'},
};

const div: DefinitionBlueprint = {
  takes: {'dividend': 'number', 'divisor': 'number'},
  returns: 'number',
  impl: {function: 'DIV'},
};

const ends_with: DefinitionBlueprint = {
  takes: {'value': 'string', 'suffix': 'string'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(ENDS_WITH(${value}, ${suffix}), false)'},
};

const exp: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'EXP'},
};

const floor: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'FLOOR'},
};

const greatest: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date', 'json']],
  takes: {'values': {variadic: {generic: 'T'}}},
  returns: {generic: 'T'},
  impl: {function: 'GREATEST'},
};

const ifnull: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date', 'json']],
  takes: {'value': {generic: 'T'}, 'default': {generic: 'T'}},
  returns: {generic: 'T'},
  impl: {function: 'IFNULL'},
};

const is_inf: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(IS_INF(${value}), false)'},
};

const is_nan: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(IS_NAN(${value}), false)'},
};

const least: DefinitionBlueprint = {
  ...greatest,
  impl: {function: 'LEAST'},
};

const length: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'LENGTH'},
};

const ln: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'LN'},
};

const log: DefinitionBlueprint = {
  takes: {
    'value': 'number',
    'base': 'number',
  },
  returns: 'number',
  impl: {function: 'LOG'},
};

const lower: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'string',
  impl: {function: 'LOWER'},
};

const ltrim: OverloadedDefinitionBlueprint = {
  'whitespace': {
    takes: {'value': 'string'},
    returns: 'string',
    impl: {function: 'LTRIM'},
  },
  'characters': {
    takes: {'value': 'string', 'trim_characters': 'string'},
    returns: 'string',
    impl: {function: 'LTRIM'},
  },
};

const nullif: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date', 'json']],
  takes: {'value1': {generic: 'T'}, 'value2': {generic: 'T'}},
  returns: {generic: 'T'},
  impl: {function: 'NULLIF'},
};

const pi: DefinitionBlueprint = {
  takes: {},
  returns: 'number',
  impl: {function: 'PI'},
};

const pow: DefinitionBlueprint = {
  takes: {'base': 'number', 'exponent': 'number'},
  returns: 'number',
  impl: {function: 'POW'},
};

const rand: DefinitionBlueprint = {
  takes: {},
  returns: 'number',
  impl: {function: 'RAND'},
};

const regexp_extract: DefinitionBlueprint = {
  // TODO consider supporting these parameters
  // 'position': 'number',
  // 'occurrence': 'number',
  takes: {'value': 'string', 'pattern': 'regular expression'},
  returns: 'string',
  impl: {function: 'REGEXP_EXTRACT'},
};

const repeat: DefinitionBlueprint = {
  takes: {'value': 'string', 'count': 'number'},
  returns: 'string',
  impl: {function: 'REPEAT'},
};

// TODO maybe we need to have a parameter to say whether it's a global replacement or not...
const replace: OverloadedDefinitionBlueprint = {
  'string': {
    takes: {'value': 'string', 'pattern': 'string', 'replacement': 'string'},
    returns: 'string',
    impl: {function: 'REPLACE'},
  },
  // TODO perhaps this should be a separate `regexp_replace` function.
  // Which would better match BQ, but I think it should be just a different
  // overload of `replace` (how it is here):
  'regular_expression': {
    takes: {
      'value': 'string',
      'pattern': 'regular expression',
      'replacement': 'string',
    },
    returns: 'string',
    impl: {function: 'REGEXP_REPLACE'},
  },
};

const reverse: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'string',
  impl: {function: 'REVERSE'},
};

const round: OverloadedDefinitionBlueprint = {
  'to_integer': {
    takes: {'value': 'number'},
    returns: 'number',
    impl: {function: 'ROUND'},
  },
  // TODO Consider adding a third overload for round(x, y, mode), where
  // "mode" is "ROUND_HALF_AWAY_FROM_ZERO" or "ROUND_HALF_EVEN"
  // TODO precision should only accept integers, but we don't have a good
  // way of expressing that constraint at the moment
  'to_precision': {
    takes: {'value': 'number', 'precision': 'number'},
    returns: 'number',
    impl: {function: 'ROUND'},
  },
};

const rtrim: OverloadedDefinitionBlueprint = {
  'whitespace': {
    ...ltrim['whitespace'],
    impl: {function: 'RTRIM'},
  },
  'characters': {
    ...ltrim['characters'],
    impl: {function: 'RTRIM'},
  },
};

const sign: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'SIGN'},
};

const sin: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'SIN'},
};

const sqrt: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'SQRT'},
};

const starts_with: DefinitionBlueprint = {
  takes: {'value': 'string', 'prefix': 'string'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(STARTS_WITH(${value}, ${prefix}), false)'},
};

const strpos: DefinitionBlueprint = {
  takes: {'test_string': 'string', 'search_string': 'string'},
  returns: 'number',
  impl: {function: 'STRPOS'},
};

const substr: OverloadedDefinitionBlueprint = {
  'position_only': {
    takes: {'value': 'string', 'position': 'number'},
    returns: 'string',
    impl: {function: 'SUBSTR'},
  },
  'with_length': {
    takes: {'value': 'string', 'position': 'number', 'length': 'number'},
    returns: 'string',
    impl: {function: 'SUBSTR'},
  },
};

const tan: DefinitionBlueprint = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'TAN'},
};

const trim: OverloadedDefinitionBlueprint = {
  'whitespace': {
    ...ltrim['whitespace'],
    impl: {function: 'TRIM'},
  },
  'characters': {
    ...ltrim['characters'],
    impl: {function: 'TRIM'},
  },
};

const trunc: OverloadedDefinitionBlueprint = {
  'to_integer': {
    takes: {'value': 'number'},
    returns: 'number',
    impl: {function: 'TRUNC'},
  },
  // TODO precision should only accept integers, but we don't have a good
  // way of expressing that constraint at the moment
  'to_precision': {
    takes: {'value': 'number', 'precision': 'number'},
    returns: 'number',
    impl: {function: 'TRUNC'},
  },
};

const unicode: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'UNICODE'},
};

const upper: DefinitionBlueprint = {
  takes: {'value': 'string'},
  returns: 'string',
  impl: {function: 'UPPER'},
};

// Aggregate functions
const stddev: DefinitionBlueprint = {
  takes: {'value': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {function: 'STDDEV'},
};

// Analytic functions
const avg_moving: OverloadedDefinitionBlueprint = {
  'preceding': {
    generic: ['T', ['string', 'number', 'timestamp', 'date']],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO only output
      'preceding': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {
      sql: 'AVG(${value})',
      needsWindowOrderBy: true,
      between: {preceding: 'preceding', following: 0},
    },
  },
  'following': {
    generic: ['T', ['string', 'number', 'timestamp', 'date']],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO only output
      'preceding': {literal: 'number'},
      'following': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {
      sql: 'AVG(${value})',
      needsWindowOrderBy: true,
      between: {preceding: 'preceding', following: 'following'},
    },
  },
};

const first_value: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date', 'json']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO needs output aggregate?
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'FIRST_VALUE', needsWindowOrderBy: true},
};

const LAG_TYPES: ExpressionValueType[] = [
  'string',
  'number',
  'timestamp',
  'date',
  'json',
  'boolean',
];
const lag: OverloadedDefinitionBlueprint = {
  'bare': {
    generic: ['T', LAG_TYPES],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO needs to be output
    },
    returns: {calculation: {generic: 'T'}},
    impl: {function: 'LAG', needsWindowOrderBy: true},
  },
  'with_offset': {
    generic: ['T', LAG_TYPES],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO needs to be output
      'offset': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {function: 'LAG', needsWindowOrderBy: true},
  },
  'with_default': {
    generic: ['T', LAG_TYPES],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO needs to be output
      'offset': {literal: 'number'},
      'default': {constant: {generic: 'T'}}, // TODO needs to be constant max aggregate?
    },
    returns: {calculation: {generic: 'T'}},
    impl: {function: 'LAG', needsWindowOrderBy: true},
  },
};

const last_value: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date', 'json']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO needs output aggregate?
  returns: {calculation: {generic: 'T'}},
  impl: {
    function: 'LAST_VALUE',
    needsWindowOrderBy: true,
    between: {preceding: -1, following: -1},
  },
};

const lead: OverloadedDefinitionBlueprint = {
  'bare': {
    ...lag['bare'],
    impl: {function: 'LEAD', needsWindowOrderBy: true},
  },
  'with_offset': {
    ...lag['with_offset'],
    impl: {function: 'LEAD', needsWindowOrderBy: true},
  },
  'with_default': {
    ...lag['with_default'],
    impl: {function: 'LEAD', needsWindowOrderBy: true},
  },
};

const max_cumulative: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO should be output only
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MAX', needsWindowOrderBy: true},
};

const max_window: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO should be output only
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MAX', needsWindowOrderBy: false},
};

const min_cumulative: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO should be output only
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MIN', needsWindowOrderBy: true},
};

const min_window: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO should be output only
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MIN', needsWindowOrderBy: false},
};

// TODO would you ever want to rank by a different thing than the order by?
const rank: DefinitionBlueprint = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'RANK', needsWindowOrderBy: true},
};

const row_number: DefinitionBlueprint = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'ROW_NUMBER', needsWindowOrderBy: true},
};

const sum_cumulative: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO should be output only
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'SUM', needsWindowOrderBy: true},
};

const sum_moving: OverloadedDefinitionBlueprint = {
  'preceding': {
    generic: ['T', ['string', 'number', 'timestamp', 'date']],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO only output
      'preceding': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {
      sql: 'SUM(${value})',
      needsWindowOrderBy: true,
      between: {preceding: 'preceding', following: 0},
    },
  },
  'following': {
    generic: ['T', ['string', 'number', 'timestamp', 'date']],
    takes: {
      'value': {measure: {generic: 'T'}}, // TODO only output
      'preceding': {literal: 'number'},
      'following': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {
      sql: 'SUM(${value})',
      needsWindowOrderBy: true,
      between: {preceding: 'preceding', following: 'following'},
    },
  },
};

const sum_window: DefinitionBlueprint = {
  generic: ['T', ['string', 'number', 'timestamp', 'date']],
  takes: {'value': {measure: {generic: 'T'}}}, // TODO should be output only
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'SUM', needsWindowOrderBy: false},
};

// SQL functions
const sql_boolean: DefinitionBlueprint = {
  takes: {'value': {literal: 'string'}},
  returns: 'boolean',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_date: DefinitionBlueprint = {
  takes: {'value': {literal: 'string'}},
  returns: 'date',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_number: DefinitionBlueprint = {
  takes: {'value': {literal: 'string'}},
  returns: 'number',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_string: DefinitionBlueprint = {
  takes: {'value': {literal: 'string'}},
  returns: 'string',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_timestamp: DefinitionBlueprint = {
  takes: {'value': {literal: 'string'}},
  returns: 'timestamp',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

export const MALLOY_STANDARD_FUNCTIONS: DefinitionBlueprintMap = {
  abs,
  acos,
  ascii,
  asin,
  atan2,
  atan,
  byte_length,
  ceil,
  chr,
  coalesce,
  concat,
  cos,
  div,
  ends_with,
  exp,
  floor,
  greatest,
  ifnull,
  is_inf,
  is_nan,
  least,
  length,
  ln,
  log,
  lower,
  ltrim,
  nullif,
  pi,
  pow,
  rand,
  regexp_extract,
  repeat,
  replace,
  reverse,
  round,
  rtrim,
  sign,
  sin,
  sqrt,
  starts_with,
  strpos,
  substr,
  tan,
  trim,
  trunc,
  unicode,
  upper,

  // Aggregate functions
  stddev,
  // string_agg,
  // string_agg_distinct,

  // Analytic functions
  avg_moving,
  first_value,
  lag,
  last_value,
  lead,
  max_cumulative,
  max_window,
  min_cumulative,
  min_window,
  rank,
  row_number,
  sum_cumulative,
  sum_moving,
  sum_window,

  // SQL functions
  sql_boolean,
  sql_date,
  sql_number,
  sql_string,
  sql_timestamp,
};

export function getMalloyStandardFunctions(): {
  [name: string]: DialectFunctionOverloadDef[];
} {
  return expandBlueprintMap(MALLOY_STANDARD_FUNCTIONS);
}

export function expandOverrideMap(overrides: OverrideMap): {
  [name: string]: DialectFunctionOverloadDef[];
} {
  return expandOverrideMapFromBase(MALLOY_STANDARD_FUNCTIONS, overrides);
}
