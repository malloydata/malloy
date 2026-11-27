/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';
import {brokenIn} from '../util';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
  view: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;

const expressionModel = testDatabase.runtime.loadModel(modelText);
const testModel = wrapTestModel(testDatabase, modelText);

const q = (x: TemplateStringsArray) =>
  testDatabase.dialect.sqlQuoteIdentifier(x.toString());

describe('sql expr functions', () => {
  it('sql_string', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: string_1 is sql_string("UPPER(\${manufacturer})")
        }
      `).toMatchResult(testModel, {
      string_1: 'AHRENS AIRCRAFT CORP.',
    });
  });

  it('sql_number', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: seats
          group_by: number_1 is sql_number("\${seats} * 2")
        }
  `).toMatchResult(testModel, {
      seats: 29,
      number_1: 58,
    });
  });

  it('sql_number can be sum()med', async () => {
    await expect(`
        ##! experimental { sql_functions }
        source: a is db.table('malloytest.aircraft_models') extend {
          where: aircraft_model_code ? '0270202'
          dimension: number_1 is sql_number("\${seats} * 2")
        }

        run: a -> {
          aggregate: s is number_1.sum()
        }
      `).toMatchResult(testModel, {
      s: 58,
    });
  });

  it('sql_boolean', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by:
            boolean_1 is pick 'yes' when sql_boolean("\${seats} > 20") else 'no'
            boolean_2 is pick 'yes' when sql_boolean("\${engines} = 2") else 'no'
        }
  `).toMatchResult(testModel, {
      boolean_1: 'yes',
      boolean_2: 'no',
    });
  });

  it('sql_date', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft') extend { where: tail_num ? 'N110WL' }

      run: a -> {
          group_by: date_1 is sql_date("\${last_action_date}")
        }
  `).toMatchResult(testModel, {
      date_1: new Date('2000-01-04T00:00:00.000Z'),
    });
  });

  it('sql_timestamp', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft') extend { where: tail_num ? 'N110WL' }

      run: a -> {
        group_by: timestamp_1 is sql_timestamp("\${last_action_date}")
        }
  `).toMatchResult(testModel, {
      timestamp_1: new Date('2000-01-04T00:00:00.000Z'),
    });
  });

  it('with ${TABLE}.field', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: string_1 is sql_string('UPPER(\${TABLE}.${q`manufacturer`})')
        }
      `).toMatchResult(testModel, {
      string_1: 'AHRENS AIRCRAFT CORP.',
    });
  });

  it('with ${field}', async () => {
    await expect(`
      ##! experimental { sql_functions }
      source: a is db.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: string_1 is sql_string("UPPER(\${manufacturer})")
        }
      `).toMatchResult(testModel, {
      string_1: 'AHRENS AIRCRAFT CORP.',
    });
  });

  it('${view_name.dimension_name} - one path', async () => {
    await expect(`
        ##! experimental { sql_functions }
        source: a0 is db.table('malloytest.aircraft_models')
        source: a is db.table('malloytest.aircraft_models') extend {
          where: aircraft_model_code ? '0270202'
          join_one: a0 on aircraft_model_code = a0.aircraft_model_code
        }

        run: a -> {
          group_by: string_1 is sql_string("UPPER(\${a0.manufacturer})")
        }
      `).toMatchResult(testModel, {
      string_1: 'AHRENS AIRCRAFT CORP.',
    });
  });

  it('${view_name.dimension_name} - multiple paths', async () => {
    await expect(`
        ##! experimental { sql_functions }
        source: a0 is db.table('malloytest.aircraft_models')
        source: a is db.table('malloytest.aircraft_models') extend {
          where: aircraft_model_code ? '0270202'
          join_one: a0 on aircraft_model_code = a0.aircraft_model_code
        }

        run: a -> {
          group_by: number_1 is sql_number("\${seats} + \${a0.seats}")
        }
      `).toMatchResult(testModel, {
      number_1: 58,
    });
  });

  describe('[not yet supported]', () => {
    // See ${...} documentation for lookml here for guidance on remaining work:
    // https://cloud.google.com/looker/docs/reference/param-field-sql#sql_for_dimensions
    it('${SQL_TABLE_NAME}', async () => {
      const query = await expressionModel.loadQuery(
        `
          ##! experimental { sql_functions }
          source: a0 is db.table('malloytest.aircraft_models')
          source: a is db.table('malloytest.aircraft_models') extend {
            where: aircraft_model_code ? '0270202'
            join_one: a0 on aircraft_model_code = a0.aircraft_model_code
          }

          run: a -> {
            group_by: number_1 is sql_number("\${a0.SQL_TABLE_NAME}.seats")
          }
          `
      );
      await expect(query.run()).rejects.toThrow(
        "Invalid interpolation: 'SQL_TABLE_NAME' is not defined"
      );
    });
  });
});

const functionsModelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
}

source: airports is db.table('malloytest.airports')

source: state_facts is db.table('malloytest.state_facts')

source: flights is db.table('malloytest.flights')

source: carriers is db.table('malloytest.carriers')
`;

const functionsExpressionModel =
  testDatabase.runtime.loadModel(functionsModelText);
const functionsTestModel = wrapTestModel(testDatabase, functionsModelText);

const funcTestGeneral = async (
  expr: string,
  type: 'group_by' | 'aggregate',
  expected:
    | {error: string; success?: undefined}
    | {success: string | boolean | number | null; error?: undefined}
) => {
  const run = async () => {
    return await functionsExpressionModel
      .loadQuery(
        `
    run: aircraft -> { ${type}: f is ${expr} }`
      )
      .run();
  };

  if (expected.success !== undefined) {
    const expectedSuccess =
      typeof expected.success === 'boolean'
        ? testDatabase.dialect.resultBoolean(expected.success)
        : expected.success;
    const result = await run();
    expect(result.data.path(0, 'f').value).toBe(expectedSuccess);
  } else {
    expect(run).rejects.toThrow(expected.error);
  }
};

const funcTest = (expr: string, expexted: string | boolean | number | null) =>
  funcTestGeneral(expr, 'group_by', {success: expexted});

const funcTestAgg = (
  expr: string,
  expexted: string | boolean | number | null
) => funcTestGeneral(expr, 'aggregate', {success: expexted});

const funcTestMultiple = async (
  ...testCases: [string, string | boolean | number | null][]
) => {
  const run = async () => {
    return await functionsExpressionModel
      .loadQuery(
        `
    run: state_facts -> { ${testCases.map(
      (testCase, i) => `group_by: f${i} is ${testCase[0]}`
    )} }`
      )
      .run();
  };

  const result = await run();
  testCases.forEach((testCase, i) => {
    // console.log(testDatabase.name, result.sql);
    // console.log(result.data);
    expect(result.data.path(0, `f${i}`).value).toBe(testCase[1]);
  });
};

describe('concat', () => {
  it.when(
    !brokenIn('trino', testDatabase.name) &&
      !brokenIn('presto', testDatabase.name) /* crswenson */
  )('works', async () => {
    const expected = {
      'bigquery': 'foo2003-01-01 12:00:00+00',
      'snowflake': 'foo2003-01-01T12:00:00.000Z',
    };

    await funcTestMultiple(
      ["concat('foo', 'bar')", 'foobar'],
      ["concat(1, 'bar')", '1bar'],
      ["concat('foo', @2003)", 'foo2003-01-01'],
      [
        "concat('foo', @2003-01-01 12:00:00)",
        expected[testDatabase.name] ?? 'foo2003-01-01 12:00:00',
      ],
      // TODO Maybe implement consistent null behavior
      // ["concat('foo', null)", null],
      ['concat()', '']
    );
  });
  it.when(
    testDatabase.dialect.booleanType !== 'none' &&
      !brokenIn('trino', testDatabase.name) &&
      !brokenIn('presto', testDatabase.name)
  )('works with a boolean', async () => {
    await funcTest(
      "concat('cons', true)",
      testDatabase.name === 'postgres'
        ? 'const'
        : testDatabase.name === 'mysql'
          ? 'cons1'
          : 'construe'
    );
  });
});

describe('round', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['round(1.2)', 1],
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      ...(testDatabase.name === 'duckdb_wasm'
        ? []
        : ([['round(12.222, 1)', 12.2]] as [string, number][])),
      ['round(12.2, -1)', 10],
      ['round(null)', null],
      ['round(1, null)', null]
    );
  });
});

describe('floor', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['floor(1.9)', 1],
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      ...(testDatabase.name === 'duckdb_wasm'
        ? []
        : ([['floor(-1.9)', -2]] as [string, number][])),
      ['floor(null)', null]
    );
    await funcTest('floor(1.9)', 1);
  });
});

describe('ceil', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['ceil(1.9)', 2],
      ['ceil(-1.9)', -1],
      ['ceil(null)', null]
    );
  });
});

describe('length', () => {
  it('works', async () => {
    await funcTestMultiple(["length('foo')", 3], ['length(null)', null]);
  });
});

describe('lower', () => {
  it('works', async () => {
    await funcTestMultiple(["lower('FoO')", 'foo'], ['lower(null)', null]);
  });
});

describe('upper', () => {
  it('works', async () => {
    await funcTestMultiple(["upper('fOo')", 'FOO'], ['upper(null)', null]);
  });
});

describe('regexp_extract', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["regexp_extract('I have a dog', r'd[aeiou]g')", 'dog'],
      ["regexp_extract(null, r'd[aeiou]g')", null],
      ["regexp_extract('foo', null)", null],
      ["regexp_extract('I have a d0g', r'd.g')", 'd0g']
    );
  });
});

describe('replace', () => {
  // Dialects using Java regex use $N for backreferences, not \N.
  // TODO: extend function template system to translate \N -> $N
  const usesVirguleBackreferences = ![
    'trino',
    'presto',
    'mysql',
    'databricks',
  ].includes(testDatabase.name);
  it('works', async () => {
    await funcTestMultiple(
      ["replace('aaaa', 'a', 'c')", 'cccc'],
      ["replace('aaaa', r'.', 'c')", 'cccc'],
      [
        "replace('aaaa', '', 'c')",
        testDatabase.name === 'trino' || testDatabase.name === 'presto'
          ? 'cacacacac'
          : 'aaaa',
      ],
      ["replace(null, 'a', 'c')", null],
      ["replace('aaaa', null, 'c')", null],
      ["replace('aaaa', 'a', null)", null]
    );
  });
  it.when(usesVirguleBackreferences)('regex backreferences', async () => {
    await funcTestMultiple([
      "replace('axbxc', r'(a).(b).(c)', s'\\0 - \\1 - \\2 - \\3')",
      testDatabase.name === 'postgres'
        ? '\\0 - a - b - c'
        : 'axbxc - a - b - c',
    ]);
  });
});

describe('substr', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["substr('foo', 2)", 'oo'],
      ["substr('foo', 2, 1)", 'o'],
      ["substr('foo bar baz', -3)", 'baz'],
      ["substr(nullif('x','x'), 1, 2)", null], //  nullMatchesFunctionSignature.
      ["substr('aaaa', null, 1)", null],
      ["substr('aaaa', 1, null)", null]
    );
  });
});

describe('raw function call', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['floor(sqrt!(25)::number)', 5],
      ['floor(sqrt!number(25))', 5],
      ["substr('foo bar baz', -3)", 'baz'],
      ["substr(nullif('x','x'), 1, 2)", null], // nullMatchesFunctionSignature
      ["substr('aaaa', null, 1)", null],
      ["substr('aaaa', 1, null)", null]
    );
  });
});

describe('stddev', () => {
  const supportsAggDistinct = testDatabase.dialect.supportsAggDistinct;
  it('works', async () => {
    await funcTestAgg('round(stddev(aircraft_models.seats))', 29);
  });

  it.when(supportsAggDistinct)('works with struct', async () => {
    await funcTestAgg(
      'round(aircraft_models.stddev(aircraft_models.seats))',
      41
    );
  });

  it.when(supportsAggDistinct)('works with implicit parameter', async () => {
    await funcTestAgg('round(aircraft_models.seats.stddev())', 41);
  });

  it.when(supportsAggDistinct)('works with filter', async () => {
    await funcTestAgg(
      'round(aircraft_models.seats.stddev() { where: 1 = 1 })',
      41
    );
    await funcTestAgg(
      'round(aircraft_models.seats.stddev() { where: aircraft_models.seats > 4 })',
      69
    );
  });
});

describe('trunc', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['trunc(1.9)', 1],
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      ...(testDatabase.name === 'duckdb_wasm'
        ? []
        : ([['trunc(-1.9)', -1]] as [string, number][])),
      ['trunc(12.29, 1)', 12.2],
      ['trunc(19.2, -1)', 10],
      ['trunc(null)', null],
      ['trunc(1, null)', null]
    );
  });
});
describe('log', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['log(10, 10)', 1],
      ['log(100, 10)', 2],
      ['log(32, 2)', 5],
      ['log(null, 2)', null],
      ['log(10, null)', null]
    );
  });
});
describe('ln', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['ln(exp(1))', 1],
      ['ln(exp(2))', 2],
      ['ln(null)', null]
    );
  });
});
describe('exp', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['exp(0)', 1],
      ['ln(exp(1))', 1],
      ['exp(null)', null]
    );
  });
});

// TODO trig functions could have more exhaustive tests -- these are mostly just here to
// ensure they exist
describe('cos', () => {
  it('works', async () => {
    await funcTestMultiple(['cos(0)', 1], ['cos(null)', null]);
  });
});
describe('acos', () => {
  it('works', async () => {
    await funcTestMultiple(['acos(1)', 0], ['acos(null)', null]);
  });
});

describe('sin', () => {
  it('works', async () => {
    await funcTestMultiple(['sin(0)', 0], ['sin(null)', null]);
  });
});
describe('asin', () => {
  it('works', async () => {
    await funcTestMultiple(['asin(0)', 0], ['asin(null)', null]);
  });
});

describe('tan', () => {
  it('works', async () => {
    await funcTestMultiple(['tan(0)', 0], ['tan(null)', null]);
  });
});
describe('atan', () => {
  it('works', async () => {
    await funcTestMultiple(['atan(0)', 0], ['atan(null)', null]);
  });
});
describe('atan2', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['atan2(0, 1)', 0],
      ['atan2(null, 1)', null],
      ['atan2(1, null)', null]
    );
  });
});
describe('sqrt', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['sqrt(9)', 3],
      ['sqrt(6.25)', 2.5],
      ['sqrt(null)', null]
    );
  });
});
describe('pow', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['pow(2, 3)', 8],
      ['pow(null, 3)', null],
      ['pow(2, null)', null]
    );
  });
});
describe('abs', () => {
  it('works', async () => {
    await funcTestMultiple(['abs(-3)', 3], ['abs(3)', 3], ['abs(null)', null]);
  });
});
describe('sign', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['sign(100)', 1],
      ['sign(-2)', -1],
      ['sign(0)', 0],
      ['sign(null)', null]
    );
  });
});
describe('is_inf', () => {
  const inf = ['trino', 'presto'].includes(testDatabase.name)
    ? 'infinity!()'
    : "'+inf'::number";
  it.when(testDatabase.name !== 'mysql')('works', async () => {
    await funcTestMultiple(
      [`pick 'yes' when is_inf(${inf}) else 'no'`, 'yes'],
      ["pick 'yes' when is_inf(100) else 'no'", 'no'],
      ["pick 'yes' when is_inf(null) else 'no'", 'no']
    );
  });
  // A null input is false, not null
  it.when(
    testDatabase.name !== 'mysql' && testDatabase.dialect.booleanType !== 'none'
  )('is false for null', async () => {
    await funcTest('is_inf(null)', testDatabase.dialect.resultBoolean(false));
  });
});
describe('is_nan', () => {
  it.when(testDatabase.name !== 'mysql')('works', async () => {
    await funcTestMultiple(
      ["pick 'yes' when is_nan('NaN'::number) else 'no'", 'yes'],
      ["pick 'yes' when is_nan(100) else 'no'", 'no'],
      ["pick 'yes' when is_nan(null) else 'no'", 'no']
    );
  });
  it.when(
    testDatabase.name !== 'mysql' && testDatabase.dialect.booleanType !== 'none'
  )('is false for null', async () => {
    await funcTest('is_nan(null)', testDatabase.dialect.resultBoolean(false));
  });
});
describe('greatest', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['greatest(1, 10, -100)', 10],
      [
        "pick 'yes' when greatest(@2003, @2004, @1994) = @2004 else 'no'",
        'yes',
      ],
      [
        "pick 'yes' when greatest(@2023-05-26 11:58:00, @2023-05-26 11:59:00) = @2023-05-26 11:59:00 else 'no'",
        'yes',
      ],
      ["greatest('a', 'b')", 'b'],
      ['greatest(1, null, 0)', null],
      ['greatest(null, null)', null]
    );
  });
});
describe('least', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['least(1, 10, -100)', -100],
      ["pick 'yes' when least(@2003, @2004, @1994) = @1994 else 'no'", 'yes'],
      [
        "pick 'yes' when least(@2023-05-26 11:58:00, @2023-05-26 11:59:00) = @2023-05-26 11:58:00 else 'no'",
        'yes',
      ],
      ["least('a', 'b')", 'a'],
      ['least(1, null, 0)', null],
      ['least(null, null)', null]
    );
  });
});
describe('div', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['div(3, 2)', 1],
      ['div(null, 2)', null],
      ['div(2, null)', null]
    );
  });
});
describe('strpos', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["strpos('123456789', '3')", 3],
      ["strpos('123456789', '0')", 0],
      ["strpos(null, '0')", null],
      ["strpos('123456789', null)", null]
    );
  });
});
describe('starts_with', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["pick 'yes' when starts_with('hello world', 'hello') else 'no'", 'yes'],
      ["pick 'yes' when starts_with('hello world', 'world') else 'no'", 'no'],
      ["pick 'yes' when starts_with(null, 'world') else 'no'", 'no'],
      ["pick 'yes' when starts_with('hello world', null) else 'no'", 'no']
    );
  });
  it.when(testDatabase.dialect.booleanType !== 'none')(
    'is false for null',
    async () => {
      await funcTestMultiple(
        [
          "starts_with(null, 'world')",
          testDatabase.dialect.resultBoolean(false),
        ],
        [
          "starts_with('hello world', null)",
          testDatabase.dialect.resultBoolean(false),
        ]
      );
    }
  );
});
describe('ends_with', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["pick 'yes' when ends_with('hello world', 'world') else 'no'", 'yes'],
      ["pick 'yes' when ends_with('hello world', 'hello') else 'no'", 'no'],
      ["pick 'yes' when ends_with(null, 'world') else 'no'", 'no'],
      ["pick 'yes' when ends_with('hello world', null) else 'no'", 'no']
    );
  });
  it.when(testDatabase.dialect.booleanType !== 'none')(
    'is false for null',
    async () => {
      await funcTestMultiple(
        ["ends_with(null, 'world')", testDatabase.dialect.resultBoolean(false)],
        [
          "ends_with('hello world', null)",
          testDatabase.dialect.resultBoolean(false),
        ]
      );
    }
  );
});
describe('trim', () => {
  it('trim works', async () => {
    await funcTestMultiple(
      ["trim('  keep this  ')", 'keep this'],
      ["trim('__keep_this__', '_')", 'keep_this'],
      ["trim(' keep everything ', '')", ' keep everything '],
      ["trim('null example', null)", null],
      ["trim(null, 'a')", null],
      ['trim(null)', null]
    );
  });
});
describe('ltrim', () => {
  it('ltrim works', async () => {
    await funcTestMultiple(
      ["ltrim('  keep this ->  ')", 'keep this ->  '],
      ["ltrim('__keep_this -> __', '_')", 'keep_this -> __'],
      ["ltrim(' keep everything ', '')", ' keep everything '],
      ["ltrim('null example', null)", null],
      ["ltrim(null, 'a')", null],
      ['ltrim(null)', null]
    );
  });
});
describe('rtrim', () => {
  it('rtrim works', async () => {
    await funcTestMultiple(
      ["rtrim('  <- keep this  ')", '  <- keep this'],
      ["rtrim('__ <- keep_this__', '_')", '__ <- keep_this'],
      ["rtrim(' keep everything ', '')", ' keep everything '],
      ["rtrim('null example', null)", null],
      ["rtrim(null, 'a')", null],
      ['rtrim(null)', null]
    );
  });
});
describe('rand', () => {
  it('is usually not the same value', async () => {
    // There are around a billion values that rand() can be, so if this
    // test fails, most likely something is broken. Otherwise, you're the lucky
    // one in a billion!
    await funcTest("pick 'same' when rand() = rand() else 'differ'", 'differ');
  });
});
describe('pi', () => {
  it('is pi', async () => {
    await funcTest(
      "pick 'yes' when abs(pi() - 3.141592653589793) < 0.0000000000001 else 'no'",
      'yes'
    );
  });
});

describe('byte_length', () => {
  it.when(testDatabase.name !== 'mysql')('works', async () => {
    await funcTestMultiple(
      ["byte_length('hello')", 5],
      ["byte_length('©')", 2],
      ['byte_length(null)', null]
    );
  });
});
describe('ifnull', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["ifnull('a', 'b')", 'a'],
      ["ifnull(null, 'b')", 'b'],
      ["ifnull('a', null)", 'a'],
      ['ifnull(null, null)', null]
    );
  });
});
describe('coalesce', () => {
  it('works', async () => {
    await funcTestMultiple(
      // ["coalesce('a')", 'a'],
      ["coalesce('a', 'b')", 'a'],
      ["coalesce(null, 'a', 'b')", 'a'],
      ["coalesce(null, 'b')", 'b'],
      ["coalesce('a', null)", 'a'],
      ['coalesce(null, null)', null]
      // ['coalesce(null)', null]
    );
  });
});
describe('nullif', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["nullif('a', 'a')", null],
      ["nullif('a', 'b')", 'a'],
      ["nullif('a', null)", 'a'],
      ['nullif(null, null)', null],
      ['nullif(null, 2)', null]
    );
  });
});
describe('chr', () => {
  it('works', async () => {
    await funcTestMultiple(
      ['chr(65)', 'A'],
      ['chr(255)', 'ÿ']
      // BigQuery's documentation says that `chr(0)` returns the empty string, but it doesn't,
      // it actually returns the null character. We generate code so that it does this.
      // ['chr(0)', '']
      // ['chr(null)', null]
    );
  });
});
describe('ascii', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["ascii('A')", 65],
      ["ascii('ABC')", 65],
      //["ascii('')", 0],   // I don't think we can guarentee this Trino returns null
      ['ascii(null)', null]
    );
  });
});
describe('unicode', () => {
  it.when(testDatabase.name !== 'mysql')('works', async () => {
    await funcTestMultiple(
      ["unicode('A')", 65],
      ["unicode('â')", 226],
      ["unicode('âBC')", 226],
      //["unicode('')", 0],   // I don't think we can guarentee this Trino returns null
      ['unicode(null)', null]
    );
  });
});

describe('string_repeat', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["string_repeat('foo', 0)", ''],
      ["string_repeat('foo', 1)", 'foo'],
      ["string_repeat('foo', 2)", 'foofoo'],
      ['string_repeat(null, 2)', null],
      ["string_repeat('foo', null)", null]
    );
  });
  // TODO how does a user do this: the second argument needs to be an integer, but floor doesn't cast to "integer" type.
  it.skip('works floor decimal', async () => {
    await funcTest("repeat('foo', floor(2.5))", 'foofoo');
  });
  // undefined behavior when negative, undefined behavior (likely error) when non-integer
});
describe('reverse', () => {
  it('works', async () => {
    await funcTestMultiple(
      ["reverse('foo')", 'oof'],
      ["reverse('')", ''],
      ['reverse(null)', null]
    );
  });
});

describe('count_approx', () => {
  const supported = testDatabase.dialect.supportsCountApprox;
  test.when(supported)('works generally', async () => {
    const tm = wrapTestModel(testDatabase, '');
    await expect(`
        // be accurate within 30%
        run: db.table('malloytest.state_facts') -> {
          aggregate: passes is abs(count_approx(state)-count(state))/count(state) < 0.3
          aggregate: also_passes is abs(count_approx(airport_count)-count(airport_count))/count(airport_count) < 0.3
        }
        `).toMatchResult(tm, {
      'passes': true,
      'also_passes': true,
    });
  });
  test.when(supported)('works with fanout', async () => {
    const tm = wrapTestModel(testDatabase, '');
    await expect(`
      source: state_facts is db.table('malloytest.state_facts')
      source: state_facts_fanout is db.table('malloytest.state_facts') extend {
        join_cross: state_facts on true
      }
      run: state_facts_fanout -> {
        aggregate: x is state_facts.state.count_approx() > 0
      }
    `).toMatchResult(tm, {x: true});
  });
});

describe('hll_functions', () => {
  const supported = testDatabase.dialect.supportsHyperLogLog;
  it.when(supported)('hyperloglog basic', async () => {
    const tm = wrapTestModel(testDatabase, '');
    await expect(`run: db.table('malloytest.state_facts') -> {
      aggregate:
        m1 is floor(hll_estimate(hll_accumulate(state))/10)
    }`).toMatchResult(tm, {m1: 5});
  });

  it.when(supported)('hyperloglog combine', async () => {
    const tm = wrapTestModel(testDatabase, '');
    await expect(`run: db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: names_hll is hll_accumulate(popular_name)
    } -> {
        aggregate: name_count is hll_estimate(hll_combine(names_hll))
    }
    `).toMatchResult(tm, {name_count: 6});
  });

  it.when(supported)('hyperloglog import/export', async () => {
    const tm = wrapTestModel(testDatabase, '');
    await expect(`run: db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: names_hll is hll_export(hll_accumulate(popular_name))
    } -> {
        aggregate: name_count is hll_estimate(hll_combine(hll_import(names_hll)))
    }
    `).toMatchResult(tm, {name_count: 6});
  });
});

describe('string_agg', () => {
  // Capability matrix: what each dialect supports for string_agg
  const canOrderBy = !['databricks'].includes(testDatabase.name);
  const canFanout = !['snowflake', 'mysql'].includes(testDatabase.name);
  const canFanoutOrderBy = ![
    'bigquery',
    'snowflake',
    'trino',
    'presto',
    'mysql',
    'databricks',
  ].includes(testDatabase.name);

  it('works no order by', async () => {
    await expect(`run: aircraft -> {
      where: name = 'RUTHERFORD PAT R JR'
      aggregate: f is string_agg(name)
    }`).toMatchResult(functionsTestModel, {f: 'RUTHERFORD PAT R JR'});
  });

  it('works with dotted shortcut', async () => {
    await expect(`run: aircraft -> {
      where: name = 'RUTHERFORD PAT R JR'
      aggregate: f is name.string_agg()
    }`).toMatchResult(functionsTestModel, {f: 'RUTHERFORD PAT R JR'});
  });

  it.when(canOrderBy)('works with order by field', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*RUTHERFORD.*'
      aggregate: f is string_agg(name, ',') {
        order_by: name
      }
    }`).toMatchResult(functionsTestModel, {
      f: 'RUTHERFORD JAMES C,RUTHERFORD PAT R JR',
    });
  });

  it.when(canOrderBy)('works with order by direction', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*RUTHERFORD.*'
      aggregate: f is string_agg(name, ',') {
        order_by: asc
      }
    }`).toMatchResult(functionsTestModel, {
      f: 'RUTHERFORD JAMES C,RUTHERFORD PAT R JR',
    });
  });

  it.when(canOrderBy)('works with multiple order_bys', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*RUTHERFORD.*'
      aggregate: f is string_agg(name, ',') {
        order_by: city, name
      }
    }`).toMatchResult(functionsTestModel, {
      f: 'RUTHERFORD PAT R JR,RUTHERFORD JAMES C',
    });
  });

  it.when(canOrderBy)('works with order by expression', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*FLY.*'
      group_by: name
      order_by: name desc
      limit: 3
    } -> {
      aggregate: f is string_agg(name, ',') {
        order_by: length(name)
      }
    }`).toMatchResult(functionsTestModel, {
      f: 'YANKEE FLYING CLUB INC,WESTCHESTER FLYING CLUB,WILSON FLYING SERVICE INC',
    });
  });

  it.when(canOrderBy)('works with order by join expression', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*ADVENTURE.*'
      aggregate: f is string_agg(name, ',') { order_by: aircraft_models.model }
    }`).toMatchResult(functionsTestModel, {
      f: 'ADVENTURE INC,SEA PLANE ADVENTURE INC,A BALLOON ADVENTURES ALOFT,A AERONAUTICAL ADVENTURE INC',
    });
  });

  it.when(canOrderBy)('works with order asc', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*FLY.*'
      group_by: name
      order_by: name desc
      limit: 3
    } -> {
      aggregate: f is string_agg(name, ',') { order_by: name asc }
    }`).toMatchResult(functionsTestModel, {
      f: 'WESTCHESTER FLYING CLUB,WILSON FLYING SERVICE INC,YANKEE FLYING CLUB INC',
    });
  });

  it.when(canOrderBy)('works with order desc', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*FLY.*'
      group_by: name
      order_by: name desc
      limit: 3
    } -> {
      aggregate: f is string_agg(name, ',') { order_by: name desc }
    }`).toMatchResult(functionsTestModel, {
      f: 'YANKEE FLYING CLUB INC,WILSON FLYING SERVICE INC,WESTCHESTER FLYING CLUB',
    });
  });

  it.when(canFanoutOrderBy)('works with fanout and order_by', async () => {
    await expect(`##! experimental.aggregate_order_by
    run: state_facts extend { join_many:
      state_facts2 is db.table('malloytest.state_facts')
        on state_facts2.state = state
    } -> {
      aggregate: c is state_facts2.count()
      aggregate: s is string_agg(state) {
        order_by: popular_name, state
      }
    }`).toMatchResult(functionsTestModel, {
      s: 'IA,LA,MN,AL,AR,IN,ME,MT,NC,AZ,CA,CO,CT,FL,GA,HI,IL,KS,KY,MA,MO,NJ,NM,NV,NY,OH,OK,PA,RI,TN,TX,WV,WY,DC,MS,SC,ID,NE,UT,VA,AK,DE,MD,MI,ND,NH,OR,SD,VT,WA,WI',
      c: 51,
    });
  });

  it.when(canFanout)('works with fanout', async () => {
    await expect(`##! experimental.aggregate_order_by
    run: state_facts extend { join_many:
      state_facts2 is db.table('malloytest.state_facts')
        on state_facts2.state = state
    } -> {
      aggregate: c is state_facts2.count()
      aggregate: s is string_agg('o')
    }`).toMatchResult(functionsTestModel, {
      s: 'o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o,o',
      c: 51,
    });
  });

  it.when(canFanout)('works with fanout and separator', async () => {
    await expect(`##! experimental.aggregate_order_by
    run: state_facts extend { join_many:
      state_facts2 is db.table('malloytest.state_facts')
        on state_facts2.state = state
    } -> {
      aggregate: c is state_facts2.count()
      aggregate: s is string_agg('o', '')
    }`).toMatchResult(functionsTestModel, {
      s: 'ooooooooooooooooooooooooooooooooooooooooooooooooooo',
      c: 51,
    });
  });

  it.when(canOrderBy)('works with limit', async () => {
    const query = `##! experimental { aggregate_order_by aggregate_limit }
    run: aircraft -> {
        where: name ~ r'.*FLY.*'
        group_by: name
        order_by: name desc
        limit: 3
      } -> {
        aggregate: f is string_agg(name, ',') {
          order_by: name desc
          limit: 2
        }
      }`;
    if (testDatabase.name === 'bigquery') {
      await expect(query).toMatchResult(functionsTestModel, {
        f: 'YANKEE FLYING CLUB INC,WILSON FLYING SERVICE INC',
      });
    } else {
      await expect(
        functionsExpressionModel.loadQuery(query).run()
      ).rejects.toThrow('Function string_agg does not support limit');
    }
  });
});

describe('string_agg_distinct', () => {
  // Capability matrix: what each dialect supports for string_agg_distinct
  const canOrderByDistinct = !['databricks'].includes(testDatabase.name);

  it.when(canOrderByDistinct)('actually distincts', async () => {
    const tm = wrapTestModel(testDatabase, '');
    await expect(`##! experimental { aggregate_order_by }
      source: aircraft is db.table('malloytest.aircraft') extend {
        primary_key: tail_num
      }

      source: aircraft_models is db.table('malloytest.aircraft_models') extend {
        primary_key: aircraft_model_code
        join_many: aircraft on aircraft_model_code = aircraft.aircraft_model_code
      }

      run: aircraft_models -> {
        where: aircraft.name = 'RAYTHEON AIRCRAFT COMPANY' | 'FOWLER IRA R DBA'
        aggregate: f_dist is aircraft.name.string_agg_distinct() { order_by: asc }
        aggregate: f_all is aircraft.name.string_agg() { order_by: aircraft.name }
    }`).toMatchResult(tm, {
      f_dist: 'FOWLER IRA R DBA,RAYTHEON AIRCRAFT COMPANY',
      f_all:
        'FOWLER IRA R DBA,FOWLER IRA R DBA,RAYTHEON AIRCRAFT COMPANY,RAYTHEON AIRCRAFT COMPANY',
    });
  });

  it('works no order by', async () => {
    await expect(`run: aircraft -> {
      where: name = 'RUTHERFORD PAT R JR'
      aggregate: f is string_agg_distinct(name)
    }`).toMatchResult(functionsTestModel, {
      f: 'RUTHERFORD PAT R JR',
    });
  });

  it('works with dotted shortcut', async () => {
    await expect(`run: aircraft -> {
      where: name = 'RUTHERFORD PAT R JR'
      aggregate: f is name.string_agg_distinct()
    }`).toMatchResult(functionsTestModel, {
      f: 'RUTHERFORD PAT R JR',
    });
  });

  it.when(canOrderByDistinct)('works with order by direction', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*RUTHERFORD.*'
      aggregate: f is string_agg_distinct(name, ',') {
        order_by: asc
      }
    }`).toMatchResult(functionsTestModel, {
      f: 'RUTHERFORD JAMES C,RUTHERFORD PAT R JR',
    });
  });

  it.when(canOrderByDistinct)('works with order asc', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*FLY.*'
      group_by: name
      order_by: name desc
      limit: 3
    } -> {
      aggregate: f is string_agg_distinct(name, ',') { order_by: asc }
    }`).toMatchResult(functionsTestModel, {
      f: 'WESTCHESTER FLYING CLUB,WILSON FLYING SERVICE INC,YANKEE FLYING CLUB INC',
    });
  });

  it.when(canOrderByDistinct)('works with order desc', async () => {
    await expect(`##! experimental { aggregate_order_by }
    run: aircraft -> {
      where: name ~ r'.*FLY.*'
      group_by: name
      order_by: name desc
      limit: 3
    } -> {
      aggregate: f is string_agg_distinct(name, ',') { order_by: desc }
    }`).toMatchResult(functionsTestModel, {
      f: 'YANKEE FLYING CLUB INC,WILSON FLYING SERVICE INC,WESTCHESTER FLYING CLUB',
    });
  });

  it.when(canOrderByDistinct)('works with limit', async () => {
    const query = `##! experimental { aggregate_order_by aggregate_limit }
      run: aircraft -> {
        where: name ~ r'.*FLY.*'
        group_by: name
        order_by: name desc
        limit: 3
      } -> {
        aggregate: f is string_agg_distinct(name, ',') {
          order_by: desc
          limit: 2
        }
      }`;
    if (testDatabase.name === 'bigquery') {
      await expect(query).toMatchResult(functionsTestModel, {
        f: 'YANKEE FLYING CLUB INC,WILSON FLYING SERVICE INC',
      });
    } else {
      await expect(
        functionsExpressionModel.loadQuery(query).run()
      ).rejects.toThrow('Function string_agg_distinct does not support limit');
    }
  });
});
