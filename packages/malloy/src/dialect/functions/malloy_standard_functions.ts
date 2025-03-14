/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {LeafExpressionType} from '../../model/malloy_types';
import type {
  DefinitionBlueprint,
  DialectFunctionOverloadDef,
  ImplementationBlueprint,
} from './util';
import {expandBlueprintMap, expandOverrideMapFromBase} from './util';

type D = DefinitionBlueprint;
type I = ImplementationBlueprint;
type DefinitionsFor<T> = {[key in keyof T]: D};
type ImplementationsFor<T> = {[key in keyof T]?: I};

type DefinitionFor<T> = T extends D ? D : DefinitionsFor<T>;
type ImplementationFor<T> = T extends D ? I : ImplementationsFor<T>;

type DefinitionMap<T> = {[key in keyof T]: DefinitionFor<T[key]>};

type ImplementationMap<T> = {[key in keyof T]?: ImplementationFor<T[key]>};

type Standard = {
  abs: D;
  acos: D;
  ascii: D;
  asin: D;
  atan2: D;
  atan: D;
  byte_length: D;
  ceil: D;
  chr: D;
  coalesce: D;
  concat: {empty: D; variadic: D};
  cos: D;
  div: D;
  ends_with: D;
  exp: D;
  floor: D;
  greatest: D;
  ifnull: D;
  is_inf: D;
  is_nan: D;
  least: D;
  length: D;
  ln: D;
  log: D;
  lower: D;
  ltrim: {whitespace: D; characters: D};
  nullif: D;
  pi: D;
  pow: D;
  rand: D;
  regexp_extract: D;
  string_repeat: D;
  replace: {string: D; regular_expression: D};
  round: {to_integer: D; to_precision: D};
  rtrim: {whitespace: D; characters: D};
  sign: D;
  sin: D;
  sqrt: D;
  starts_with: D;
  strpos: D;
  substr: {position_only: D; with_length: D};
  tan: D;
  trim: {whitespace: D; characters: D};
  trunc: {to_integer: D; to_precision: D};
  unicode: D;
  upper: D;
  stddev: D;
  avg_moving: {preceding: D; following: D};
  first_value: D;
  lag: {bare: D; with_offset: D; with_default: D};
  last_value: D;
  lead: {bare: D; with_offset: D; with_default: D};
  max_cumulative: D;
  max_window: D;
  min_cumulative: D;
  min_window: D;
  rank: D;
  row_number: D;
  sum_cumulative: D;
  sum_moving: {preceding: D; following: D};
  sum_window: D;
  sql_boolean: D;
  sql_date: D;
  sql_number: D;
  sql_string: D;
  sql_timestamp: D;
};

export type MalloyStandardFunctionDefinitions = DefinitionMap<Standard>;
export type MalloyStandardFunctionImplementations = ImplementationMap<Standard>;

const abs: DefinitionFor<Standard['abs']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ABS'},
};

const acos: DefinitionFor<Standard['acos']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ACOS'},
};

const ascii: DefinitionFor<Standard['ascii']> = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'ASCII'},
};

const asin: DefinitionFor<Standard['asin']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ASIN'},
};

const atan2: DefinitionFor<Standard['atan2']> = {
  takes: {'y': 'number', 'x': 'number'},
  returns: 'number',
  impl: {function: 'ATAN2'},
};

const atan: DefinitionFor<Standard['atan']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'ATAN'},
};

const byte_length: DefinitionFor<Standard['byte_length']> = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'BYTE_LENGTH'},
};

const ceil: DefinitionFor<Standard['ceil']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'CEIL'},
};

const chr: DefinitionFor<Standard['chr']> = {
  takes: {'value': 'number'},
  returns: 'string',
  impl: {sql: "CASE WHEN ${value} = 0 THEN '' ELSE CHR(${value}) END"},
};

const coalesce: DefinitionFor<Standard['coalesce']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date', 'json']},
  takes: {'value': {variadic: {generic: 'T'}}},
  returns: {generic: 'T'},
  impl: {function: 'COALESCE'},
};

const concat: DefinitionFor<Standard['concat']> = {
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

const cos: DefinitionFor<Standard['cos']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'COS'},
};

const div: DefinitionFor<Standard['div']> = {
  takes: {'dividend': 'number', 'divisor': 'number'},
  returns: 'number',
  impl: {function: 'DIV'},
};

const ends_with: DefinitionFor<Standard['ends_with']> = {
  takes: {'value': 'string', 'suffix': 'string'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(ENDS_WITH(${value}, ${suffix}), false)'},
};

const exp: DefinitionFor<Standard['exp']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'EXP'},
};

const floor: DefinitionFor<Standard['floor']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'FLOOR'},
};

const greatest: DefinitionFor<Standard['greatest']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date', 'json']},
  takes: {'values': {variadic: {generic: 'T'}}},
  returns: {generic: 'T'},
  impl: {function: 'GREATEST'},
};

const ifnull: DefinitionFor<Standard['ifnull']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date', 'json']},
  takes: {'value': {generic: 'T'}, 'default': {generic: 'T'}},
  returns: {generic: 'T'},
  impl: {function: 'IFNULL'},
};

const is_inf: DefinitionFor<Standard['is_inf']> = {
  takes: {'value': 'number'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(IS_INF(${value}), false)'},
};

const is_nan: DefinitionFor<Standard['is_nan']> = {
  takes: {'value': 'number'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(IS_NAN(${value}), false)'},
};

const least: DefinitionFor<Standard['least']> = {
  ...greatest,
  impl: {function: 'LEAST'},
};

const length: DefinitionFor<Standard['length']> = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'LENGTH'},
};

const ln: DefinitionFor<Standard['ln']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'LN'},
};

const log: DefinitionFor<Standard['log']> = {
  takes: {
    'value': 'number',
    'base': 'number',
  },
  returns: 'number',
  impl: {function: 'LOG'},
};

const lower: DefinitionFor<Standard['lower']> = {
  takes: {'value': 'string'},
  returns: 'string',
  impl: {function: 'LOWER'},
};

const ltrim: DefinitionFor<Standard['ltrim']> = {
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

const nullif: DefinitionFor<Standard['nullif']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date', 'json']},
  takes: {'value1': {generic: 'T'}, 'value2': {generic: 'T'}},
  returns: {generic: 'T'},
  impl: {function: 'NULLIF'},
};

const pi: DefinitionFor<Standard['pi']> = {
  takes: {},
  returns: 'number',
  impl: {function: 'PI'},
};

const pow: DefinitionFor<Standard['pow']> = {
  takes: {'base': 'number', 'exponent': 'number'},
  returns: 'number',
  impl: {function: 'POW'},
};

const rand: DefinitionFor<Standard['rand']> = {
  takes: {},
  returns: 'number',
  impl: {function: 'RAND'},
};

const regexp_extract: DefinitionFor<Standard['regexp_extract']> = {
  // TODO consider supporting these parameters
  // 'position': 'number',
  // 'occurrence': 'number',
  takes: {'value': 'string', 'pattern': 'regular expression'},
  returns: 'string',
  impl: {function: 'REGEXP_EXTRACT'},
};

const string_repeat: DefinitionFor<Standard['string_repeat']> = {
  takes: {'value': 'string', 'count': 'number'},
  returns: 'string',
  impl: {function: 'REPEAT'},
};

// TODO maybe we need to have a parameter to say whether it's a global replacement or not...
const replace: DefinitionFor<Standard['replace']> = {
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

const round: DefinitionFor<Standard['round']> = {
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

const rtrim: DefinitionFor<Standard['rtrim']> = {
  'whitespace': {
    ...ltrim['whitespace'],
    impl: {function: 'RTRIM'},
  },
  'characters': {
    ...ltrim['characters'],
    impl: {function: 'RTRIM'},
  },
};

const sign: DefinitionFor<Standard['sign']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'SIGN'},
};

const sin: DefinitionFor<Standard['sin']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'SIN'},
};

const sqrt: DefinitionFor<Standard['sqrt']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'SQRT'},
};

const starts_with: DefinitionFor<Standard['starts_with']> = {
  takes: {'value': 'string', 'prefix': 'string'},
  returns: 'boolean',
  impl: {sql: 'COALESCE(STARTS_WITH(${value}, ${prefix}), false)'},
};

const strpos: DefinitionFor<Standard['strpos']> = {
  takes: {'test_string': 'string', 'search_string': 'string'},
  returns: 'number',
  impl: {function: 'STRPOS'},
};

const substr: DefinitionFor<Standard['substr']> = {
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

const tan: DefinitionFor<Standard['tan']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'TAN'},
};

const trim: DefinitionFor<Standard['trim']> = {
  'whitespace': {
    ...ltrim['whitespace'],
    impl: {function: 'TRIM'},
  },
  'characters': {
    ...ltrim['characters'],
    impl: {function: 'TRIM'},
  },
};

const trunc: DefinitionFor<Standard['trunc']> = {
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

const unicode: DefinitionFor<Standard['unicode']> = {
  takes: {'value': 'string'},
  returns: 'number',
  impl: {function: 'UNICODE'},
};

const upper: DefinitionFor<Standard['upper']> = {
  takes: {'value': 'string'},
  returns: 'string',
  impl: {function: 'UPPER'},
};

// Aggregate functions
const stddev: DefinitionFor<Standard['stddev']> = {
  takes: {'value': {dimension: 'number'}},
  returns: {measure: 'number'},
  impl: {function: 'STDDEV'},
};

// Analytic functions
const avg_moving: DefinitionFor<Standard['avg_moving']> = {
  'preceding': {
    generic: {'T': ['string', 'number', 'timestamp', 'date']},
    takes: {
      'value': {measure: {generic: 'T'}},
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
    generic: {'T': ['string', 'number', 'timestamp', 'date']},
    takes: {
      'value': {measure: {generic: 'T'}},
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

const first_value: DefinitionFor<Standard['first_value']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date', 'json']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'FIRST_VALUE', needsWindowOrderBy: true},
};

const LAG_TYPES: LeafExpressionType[] = [
  'string',
  'number',
  'timestamp',
  'date',
  'json',
  'boolean',
];
const lag: DefinitionFor<Standard['lag']> = {
  'bare': {
    generic: {'T': LAG_TYPES},
    takes: {
      'value': {measure: {generic: 'T'}},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {function: 'LAG', needsWindowOrderBy: true},
  },
  'with_offset': {
    generic: {'T': LAG_TYPES},
    takes: {
      'value': {measure: {generic: 'T'}},
      'offset': {literal: 'number'},
    },
    returns: {calculation: {generic: 'T'}},
    impl: {function: 'LAG', needsWindowOrderBy: true},
  },
  'with_default': {
    generic: {'T': LAG_TYPES},
    takes: {
      'value': {measure: {generic: 'T'}},
      'offset': {literal: 'number'},
      'default': {constant: {generic: 'T'}}, // TODO needs to be constant max aggregate?
    },
    returns: {calculation: {generic: 'T'}},
    impl: {function: 'LAG', needsWindowOrderBy: true},
  },
};

const last_value: DefinitionFor<Standard['last_value']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date', 'json']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {
    function: 'LAST_VALUE',
    needsWindowOrderBy: true,
    between: {preceding: -1, following: -1},
  },
};

const lead: DefinitionFor<Standard['lead']> = {
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

const max_cumulative: DefinitionFor<Standard['max_cumulative']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MAX', needsWindowOrderBy: true},
};

const max_window: DefinitionFor<Standard['max_window']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MAX', needsWindowOrderBy: false},
};

const min_cumulative: DefinitionFor<Standard['min_cumulative']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MIN', needsWindowOrderBy: true},
};

const min_window: DefinitionFor<Standard['min_window']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'MIN', needsWindowOrderBy: false},
};

// TODO would you ever want to rank by a different thing than the order by?
const rank: DefinitionFor<Standard['rank']> = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'RANK', needsWindowOrderBy: true},
};

const row_number: DefinitionFor<Standard['row_number']> = {
  takes: {},
  returns: {calculation: 'number'},
  impl: {function: 'ROW_NUMBER', needsWindowOrderBy: true},
};

const sum_cumulative: DefinitionFor<Standard['sum_cumulative']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'SUM', needsWindowOrderBy: true},
};

const sum_moving: DefinitionFor<Standard['sum_moving']> = {
  'preceding': {
    generic: {'T': ['string', 'number', 'timestamp', 'date']},
    takes: {
      'value': {measure: {generic: 'T'}},
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
    generic: {'T': ['string', 'number', 'timestamp', 'date']},
    takes: {
      'value': {measure: {generic: 'T'}},
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

const sum_window: DefinitionFor<Standard['sum_window']> = {
  generic: {'T': ['string', 'number', 'timestamp', 'date']},
  takes: {'value': {measure: {generic: 'T'}}},
  returns: {calculation: {generic: 'T'}},
  impl: {function: 'SUM', needsWindowOrderBy: false},
};

// SQL functions
const sql_boolean: DefinitionFor<Standard['sql_boolean']> = {
  takes: {'value': {literal: 'string'}},
  returns: 'boolean',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_date: DefinitionFor<Standard['sql_date']> = {
  takes: {'value': {literal: 'string'}},
  returns: 'date',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_number: DefinitionFor<Standard['sql_number']> = {
  takes: {'value': {literal: 'string'}},
  returns: 'number',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_string: DefinitionFor<Standard['sql_string']> = {
  takes: {'value': {literal: 'string'}},
  returns: 'string',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

const sql_timestamp: DefinitionFor<Standard['sql_timestamp']> = {
  takes: {'value': {literal: 'string'}},
  returns: 'timestamp',
  impl: {expr: {node: 'function_parameter', name: 'value'}},
};

export const MALLOY_STANDARD_FUNCTIONS: MalloyStandardFunctionDefinitions = {
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
  replace,
  round,
  rtrim,
  sign,
  sin,
  sqrt,
  starts_with,
  string_repeat,
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

export function expandOverrideMap(
  overrides: MalloyStandardFunctionImplementations
): {
  [name: string]: DialectFunctionOverloadDef[];
} {
  return expandOverrideMapFromBase(MALLOY_STANDARD_FUNCTIONS, overrides);
}
