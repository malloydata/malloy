/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {
  wrapTestModel,
  mkTestModel,
  extendTestModel,
  TV,
} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';

import type {Dialect} from '@malloydata/malloy';

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
const testModel = wrapTestModel(testDatabase, modelText);

const q = (x: TemplateStringsArray) =>
  testDatabase.dialect.sqlQuoteIdentifier(x.toString());

const emptyModel = wrapTestModel(testDatabase, '');

it('basic calculations', async () => {
  await expect(`
      run: aircraft_models->{
        aggregate:
          total_seats,
          total_seats2 is sum(seats),
          boeing_seats,
          boeing_seats2 is sum(seats) { where: manufacturer ? 'BOEING'},
          boeing_seats3 is total_seats { where: manufacturer ? 'BOEING'},
          percent_boeing_floor,
      }
    `).toMatchResult(testModel, {
    total_seats: 452415,
    total_seats2: 452415,
    boeing_seats: 252771,
    boeing_seats2: 252771,
    boeing_seats3: 252771,
    percent_boeing_floor: 55,
  });
});

// Floor was broken (wouldn't compile because the expression returned isn't an aggregate.)
it('Floor() -or any function bustage with aggregates', async () => {
  await expect(`
      run: aircraft_models->{
        aggregate:
          percent_boeing_floor
          percent_boeing_floor2 is floor(boeing_seats / total_seats * 100)
      }
    `).toMatchResult(testModel, {
    percent_boeing_floor: 55,
    percent_boeing_floor2: 55,
  });
});

// Model based version of sums.
it('model: expression fixups.', async () => {
  await expect(`
      run: aircraft->{
        aggregate:
          aircraft_models.total_seats
          aircraft_models.boeing_seats
      }
    `).toMatchResult(testModel, {
    total_seats: 18294,
    boeing_seats: 6244,
  });
});

it('model: aggregate functions distinct min max', async () => {
  await expect(`
      run: aircraft_models->{
        aggregate:
          distinct_seats is count(seats),
          boeing_distinct_seats is count(seats) { where:manufacturer ? 'BOEING'},
          min_seats is min(seats),
          cessna_min_seats is min(seats) { where: manufacturer ? 'CESSNA'},
          max_seats is max(seats),
          cessna_max_seats is max(seats) { where: manufacturer ? 'CESSNA'},
          min_code is min(aircraft_model_code),
          boeing_min_model is min(model) { where: manufacturer ? 'BOEING'},
          max_model is max(model),
          boeing_max_model is max(model) { where: manufacturer ? 'BOEING'},
      }
    `).toMatchResult(testModel, {
    distinct_seats: 187,
    boeing_distinct_seats: 85,
    min_seats: 0,
    cessna_min_seats: 1,
    max_seats: 660,
    min_code: '0030109',
    cessna_max_seats: 14,
    boeing_min_model: '100',
    max_model: 'ZWEIFEL PA18',
    boeing_max_model: 'YL-15',
  });
});

it('many_field.sum() has correct locality', async () => {
  await expect(`
      source: a is db.table('malloytest.aircraft') extend {
        primary_key: tail_num
      }
      source: am is db.table('malloytest.aircraft_models') extend {
        join_many: a on a.aircraft_model_code = a.aircraft_model_code
        dimension: a_year_built is a.year_built
      }

      run: am -> {
        aggregate: avg_a_year_built1 is floor(a_year_built.avg())
        aggregate: avg_a_year_built2 is floor(a.avg(a_year_built))
      }
    `).toMatchResult(testModel, {
    avg_a_year_built1: 1969,
    avg_a_year_built2: 1969,
  });
});

test('a symmetric average is a single term of a larger expression', async () => {
  await expect(`
      run: db.table('malloytest.aircraft') extend {
        join_one: aircraft_models is db.table('malloytest.aircraft_models')
          on aircraft_model_code = aircraft_models.aircraft_model_code
      } -> {
        aggregate: back_to_100 is
          round(100 / aircraft_models.seats.avg() * aircraft_models.seats.avg())
      }`).toMatchResult(emptyModel, {back_to_100: 100});
});

const joinModelText = `
  source: aircraft_models is db.table('malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    measure: model_count is count()
    view: manufacturer_models is {
      group_by: manufacturer
      aggregate: num_models is count()
    }
    view: manufacturer_seats is {
      group_by: manufacturer
      aggregate: total_seats is seats.sum()
    }
  }

  source: aircraft is db.table('malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
  }

  source: funnel is aircraft_models->manufacturer_models extend {
    join_one: seats is aircraft_models->manufacturer_seats
        with manufacturer
  }
`;

const joinModel = wrapTestModel(testDatabase, joinModelText);

// Trino and Presto declare the nest's count() as INTEGER in its ROW type,
// which makes this the symmetric sum of a 32 bit value.
test.when(testDatabase.dialect.supportsNesting)(
  'symmetric sum of an integer nest field through a join',
  async () => {
    await expect(`
        source: three is db.table('malloytest.airports') -> {
          group_by: state
          nest: types is { group_by: fac_type; aggregate: c is count() }
        }
        source: sf is db.table('malloytest.state_facts') extend {
          join_one: three on three.state = state
        }
        run: sf -> {
          where: state = 'AK'
          aggregate:
            n is three.types.count()
            t is three.types.c.sum()
        }
      `).toMatchResult(joinModel, {n: 3, t: 608});
  }
);

// A dialect which sums a value by adding it to a hash of its row does
// arithmetic on the value, in whatever type its column has.
describe('symmetric sum and avg, by the type of the value', () => {
  const accounts = mkTestModel(testDatabase, {
    accounts: [
      {
        account_id: 1,
        small: 474,
        negative: -474,
        negative_fraction: TV.float(-2.5),
        big: TV.bigint(30000000001),
        huge: TV.float(2 ** 84),
        fraction: TV.float(0.1),
      },
      {
        account_id: 2,
        small: 22,
        negative: -22,
        negative_fraction: TV.float(-0.25),
        big: TV.bigint(30000000004),
        huge: TV.float(2 ** 85),
        fraction: TV.float(0.2),
      },
      {
        account_id: 3,
        small: 1,
        negative: -5,
        negative_fraction: TV.float(-1.00000001),
        big: TV.bigint(1),
        huge: TV.float(0),
        fraction: TV.float(1.00000001),
      },
    ],
    entries: [
      {account_id: 1, n: 1},
      {account_id: 1, n: 2},
      {account_id: 2, n: 3},
      {account_id: 3, n: 4},
      {account_id: 3, n: 5},
    ],
  });
  const fannedOut = (aggregate: string) => `
      run: accounts extend {
        primary_key: account_id
        join_many: entries on entries.account_id = account_id
      } -> {
        aggregate:
          entry_count is entries.count()
          ${aggregate}
      }
    `;

  it('sums a negative 32 bit integer', async () => {
    await expect(fannedOut('negative_sum is negative.sum()')).toMatchResult(
      accounts,
      {entry_count: 5, negative_sum: -501}
    );
  });

  // -2.5 is half way between the whole numbers a value is split at.
  it('sums a negative value with fractional digits', async () => {
    await expect(
      fannedOut('negative_fraction_sum is negative_fraction.sum()')
    ).toMatchResult(accounts, {
      entry_count: 5,
      negative_fraction_sum: -3.75000001,
    });
  });

  // 30000000001 * 10^8 is past 2^53, where a double stops holding every
  // integer.
  it('sums a bigint exactly', async () => {
    await expect(fannedOut('big_sum is big.sum()')).toMatchResult(accounts, {
      entry_count: 5,
      big_sum: 60000000006,
    });
  });

  // Powers of two, which a double and a decimal both hold exactly. The sum
  // is divided back down because the Presto client cannot read a double
  // that large.
  it('sums values near 10^25', async () => {
    await expect(
      fannedOut('huge_ratio is huge.sum() / pow(2, 84)')
    ).toMatchResult(accounts, {entry_count: 5, huge_ratio: 3});
  });

  it('keeps eight fractional digits', async () => {
    await expect(fannedOut('fraction_sum is fraction.sum()')).toMatchResult(
      accounts,
      {entry_count: 5, fraction_sum: 1.30000001}
    );
  });

  // 497 / 3, to ten digits past the point.
  it('averages past the fractional digits of the sum', async () => {
    await expect(
      fannedOut('avg_digits is floor(small.avg() * 10000000000)')
    ).toMatchResult(accounts, {entry_count: 5, avg_digits: 1656666666666});
  });
});

// These run the SQL of the shifty sum on its own, and compare its result
// with the expected one inside the database. A result which has come
// through a query, a DOUBLE and a driver no longer shows whether every
// digit is right.
describe('the shifty sum, digit for digit', () => {
  const byHash = testDatabase.dialect.sumDistinctByHash;
  const isShifty = byHash?.form === 'shifty';
  const roundsWideProducts =
    byHash?.form === 'shifty' && byHash.roundsWideProducts;

  // The dialect without the cast to its result type, which would round
  // away the digits these tests compare.
  const exact: Dialect = Object.create(testDatabase.dialect);
  if (byHash) {
    exact.sumDistinctByHash = {...byHash, resultType: undefined};
  }

  // A row of the source being summed: its key, and its value as the digits
  // of a number, or undefined for NULL. A join which repeats a row is a key
  // which appears more than once.
  type Row = [key: number, value: string | undefined];

  const TOP_VALUE = '9'.repeat(29) + '.99999999';

  async function shiftySum(
    funcName: 'SUM' | 'AVG',
    valueType: string,
    rows: Row[],
    expected: string | undefined,
    where = ''
  ) {
    const source = rows
      .map(
        ([key, value]) =>
          `SELECT ${key} AS k, CAST(${
            value === undefined ? 'NULL' : `'${value}'`
          } AS ${valueType}) AS v`
      )
      .join(' UNION ALL ');
    const sum = exact.sqlSumDistinct('t.k', 't.v', funcName);
    const matches =
      expected === undefined
        ? `(${sum}) IS NULL`
        : `(${sum}) = CAST('${expected}' AS DECIMAL(38,8))`;
    const result = await (
      await testDatabase.connection()
    ).runSQL(`SELECT ${matches} AS matches FROM (${source}) t ${where}`);
    return Object.values(result.rows[0])[0];
  }

  test.when(isShifty)(
    'folds the rows a join repeated, and no others',
    async () => {
      const rows: Row[] = [
        [1, '5'],
        [1, '5'],
        [1, '5'],
        [2, '5'],
        [3, '7'],
      ];
      expect(await shiftySum('SUM', 'INTEGER', rows, '17')).toBe(true);
    }
  );

  test.when(isShifty)('sums the ends of a 32 bit integer', async () => {
    const rows: Row[] = [
      [1, '2147483647'],
      [1, '2147483647'],
      [2, '-2147483648'],
      [3, '474'],
    ];
    expect(await shiftySum('SUM', 'INTEGER', rows, '473')).toBe(true);
  });

  test.when(isShifty)('sums the ends of a 64 bit integer', async () => {
    const rows: Row[] = [
      [1, '9223372036854775807'],
      [1, '9223372036854775807'],
      [2, '9223372036854775807'],
      [3, '-9223372036854775807'],
      [4, '1'],
    ];
    expect(await shiftySum('SUM', 'BIGINT', rows, '9223372036854775808')).toBe(
      true
    );
  });

  test.when(isShifty)(
    'rounds each value at its ninth fractional digit',
    async () => {
      const rows: Row[] = [
        [1, '0.000000005'],
        [2, '0.000000014'],
        [3, '-0.000000015'],
        [4, '0.000000004'],
        [5, '0.999999995'],
        [6, '-2.5'],
        [6, '-2.5'],
        [7, '2.5'],
        [8, '0.12345678'],
      ];
      expect(await shiftySum('SUM', 'DECIMAL(20,9)', rows, '1.12345678')).toBe(
        true
      );
    }
  );

  test.when(isShifty)('sums a double as its nearest eight digits', async () => {
    const rows: Row[] = [
      [1, '0.1'],
      [1, '0.1'],
      [2, '0.2'],
      [3, '-1.00000001'],
    ];
    expect(await shiftySum('SUM', 'DOUBLE', rows, '-0.70000001')).toBe(true);
  });

  test.when(isShifty)('sums the largest value, of either sign', async () => {
    const rows: Row[] = [
      [1, TOP_VALUE],
      [1, TOP_VALUE],
      [2, `-${TOP_VALUE}`],
      [3, '0.00000001'],
    ];
    expect(await shiftySum('SUM', 'DECIMAL(37,8)', rows, '0.00000001')).toBe(
      true
    );
  });

  test.when(isShifty)('fails on a value of 10^29', async () => {
    const rows: Row[] = [[1, '1' + '0'.repeat(29)]];
    await expect(
      shiftySum('SUM', 'DECIMAL(38,0)', rows, undefined)
    ).rejects.toThrow();
  });

  // Nine of the largest value: a tenth would pass 10^38 once shifted.
  test.when(isShifty && !roundsWideProducts)(
    'sums as far as 38 digits reach',
    async () => {
      const rows: Row[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key => [
        key,
        TOP_VALUE,
      ]);
      expect(
        await shiftySum(
          'SUM',
          'DECIMAL(37,8)',
          rows,
          '8' + '9'.repeat(29) + '.99999991'
        )
      ).toBe(true);
    }
  );

  // Twenty, because Snowflake sums a little past 38 digits before it fails.
  test.when(isShifty)(
    'fails when the shifted values are more than the engine can sum',
    async () => {
      const rows: Row[] = [];
      for (let key = 1; key <= 20; key++) {
        rows.push([key, TOP_VALUE]);
      }
      await expect(
        shiftySum('SUM', 'DECIMAL(37,8)', rows, undefined)
      ).rejects.toThrow();
    }
  );

  test.when(roundsWideProducts)(
    'sums to just below 10^27 where a wide product is rounded',
    async () => {
      const top = '9'.repeat(27) + '.99999999';
      const rows: Row[] = [
        [1, top],
        [1, top],
      ];
      expect(await shiftySum('SUM', 'DECIMAL(37,8)', rows, top)).toBe(true);
    }
  );

  test.when(roundsWideProducts)(
    'fails on a sum of 10^27 where a wide product is rounded',
    async () => {
      const half = '5' + '0'.repeat(26);
      const rows: Row[] = [
        [1, half],
        [2, half],
      ];
      await expect(
        shiftySum('SUM', 'DECIMAL(38,0)', rows, undefined)
      ).rejects.toThrow();
    }
  );

  test.when(isShifty)('counts a NULL value as zero', async () => {
    const rows: Row[] = [
      [1, undefined],
      [2, '3'],
      [2, '3'],
    ];
    expect(await shiftySum('SUM', 'INTEGER', rows, '3')).toBe(true);
  });

  test.when(isShifty)('is NULL when there are no rows', async () => {
    const rows: Row[] = [[1, '3']];
    expect(
      await shiftySum('SUM', 'INTEGER', rows, undefined, 'WHERE t.k < 0')
    ).toBe(true);
  });

  test.when(isShifty)(
    'averages over the rows whose value is not NULL',
    async () => {
      const rows: Row[] = [
        [1, '1'],
        [1, '1'],
        [2, '2'],
        [3, undefined],
      ];
      expect(await shiftySum('AVG', 'INTEGER', rows, '1.5')).toBe(true);
    }
  );

  test.when(isShifty)('keeps thirty rows apart', async () => {
    const rows: Row[] = [];
    for (let key = 1; key <= 30; key++) {
      rows.push([key, '7'], [key, '7']);
    }
    expect(await shiftySum('SUM', 'INTEGER', rows, '210')).toBe(true);
  });
});

// Carol is the customer no order matches: in the joined result she has one
// row, in which the order is all NULLs.
describe('aggregate at a joined source with an unmatched row', () => {
  const unmatched = extendTestModel(
    mkTestModel(testDatabase, {
      customers: [
        {customer_id: 1, name: 'Alice', credit: 100},
        {customer_id: 2, name: 'Bob', credit: 400},
        {customer_id: 3, name: 'Carol', credit: 5000},
      ],
      order_rows: [
        {order_id: 10, customer_id: 1, amount: 5},
        {order_id: 11, customer_id: 1, amount: 7},
        {order_id: 12, customer_id: 2, amount: 11},
      ],
      tags: [
        {customer_id: 1, tag: 'a'},
        {customer_id: 1, tag: 'b'},
        {customer_id: 2, tag: 'c'},
      ],
      profiles: [
        {customer_id: 1, score: 7},
        {customer_id: 2, score: 9},
      ],
    }),
    `
        source: keyless_orders is order_rows extend {
          measure:
            order_count is count()
            padded_total is sum((amount ?? 0) + 1)
            tripled_avg is avg((amount ?? 0) * 3)
        }
        source: keyed_orders is keyless_orders extend { primary_key: order_id }
        source: buyers is customers extend {
          primary_key: customer_id
          join_many: keyed is keyed_orders on keyed.customer_id = customer_id
          join_many: keyless is keyless_orders on keyless.customer_id = customer_id
          join_many: tags on tags.customer_id = customer_id
          join_one: keyed_profile is profiles extend {
            primary_key: customer_id
          } on keyed_profile.customer_id = customer_id
          join_one: keyless_profile is profiles
            on keyless_profile.customer_id = customer_id
        }
      `
  );

  // A second join_many fans the orders out, which changes how every
  // aggregate at the orders is written.
  const shapes = [
    {orders: 'keyed', fanOut: ''},
    {orders: 'keyed', fanOut: 'tag_count is tags.count()'},
    {orders: 'keyless', fanOut: ''},
    {orders: 'keyless', fanOut: 'tag_count is tags.count()'},
  ].map(s => ({...s, shape: `${s.orders}${s.fanOut ? ', fanned out' : ''}`}));

  describe.each(shapes)('$shape', ({orders, fanOut}) => {
    it('count, sum and avg skip the unmatched row', async () => {
      await expect(`
          run: buyers -> {
            group_by: name
            aggregate:
              order_count is ${orders}.count()
              big_credit_count is ${orders}.count() { where: credit > 100 }
              credit_sum is ${orders}.sum(credit)
              big_credit_sum is ${orders}.sum(credit) { where: credit > 100 }
              credit_avg is ${orders}.avg(credit)
              amount_plus_one is ${orders}.sum((${orders}.amount ?? 0) + 1)
              amount_sum is ${orders}.amount.sum()
              ${fanOut}
            order_by: name
          }
        `).toMatchResult(
        unmatched,
        {
          name: 'Alice',
          order_count: 2,
          big_credit_count: 0,
          credit_sum: 200,
          big_credit_sum: 0,
          credit_avg: 100,
          amount_plus_one: 14,
          amount_sum: 12,
        },
        {
          name: 'Bob',
          order_count: 1,
          big_credit_count: 1,
          credit_sum: 400,
          big_credit_sum: 400,
          credit_avg: 400,
          amount_plus_one: 12,
          amount_sum: 11,
        },
        {
          name: 'Carol',
          order_count: 0,
          big_credit_count: 0,
          credit_sum: 0,
          big_credit_sum: 0,
          credit_avg: null,
          amount_plus_one: 0,
          amount_sum: 0,
        }
      );
    });

    it('a measure is the same through the join as on its own source', async () => {
      const measures = ['order_count', 'padded_total', 'tripled_avg'];
      const onItsOwn = await unmatched.model
        .loadQuery(
          `run: ${orders}_orders -> { aggregate: ${measures.join(', ')} }`
        )
        .run();
      await expect(`
          run: buyers -> {
            aggregate:
              ${measures.map(m => `${orders}.${m}`).join('\n')}
              ${fanOut}
          }
        `).toMatchResult(unmatched, onItsOwn.data.toObject()[0]);
    });

    it('totals skip the unmatched row', async () => {
      await expect(`
          run: buyers -> {
            aggregate:
              order_count is ${orders}.count()
              credit_sum is ${orders}.sum(credit)
              credit_avg is ${orders}.avg(credit)
              customer_count is count()
              ${fanOut}
          }
        `).toMatchResult(unmatched, {
        order_count: 3,
        credit_sum: 600,
        credit_avg: 200,
        customer_count: 3,
      });
    });

    const canStringAgg =
      fanOut === '' ||
      !['snowflake', 'mysql', 'sqlserver'].includes(testDatabase.name);
    it.when(canStringAgg)(
      'an aggregate function skips the unmatched row',
      async () => {
        await expect(`
            run: buyers -> {
              group_by: name
              aggregate:
                name_chars is length(${orders}.string_agg(name, ',')) ?? 0
                ${fanOut}
              order_by: name
            }
          `).toMatchResult(
          unmatched,
          {name: 'Alice', name_chars: 11},
          {name: 'Bob', name_chars: 3},
          {name: 'Carol', name_chars: 0}
        );
      }
    );
  });

  describe.each(['keyed_profile', 'keyless_profile'])(
    'join_one %s',
    profile => {
      it('count, sum and avg skip the unmatched row', async () => {
        await expect(`
            run: buyers -> {
              group_by: name
              aggregate:
                profile_count is ${profile}.count()
                credit_sum is ${profile}.sum(credit)
                credit_avg is ${profile}.avg(credit)
                score_plus_one is ${profile}.sum((${profile}.score ?? 0) + 1)
              order_by: name
            }
          `).toMatchResult(
          unmatched,
          {
            name: 'Alice',
            profile_count: 1,
            credit_sum: 100,
            credit_avg: 100,
            score_plus_one: 8,
          },
          {
            name: 'Bob',
            profile_count: 1,
            credit_sum: 400,
            credit_avg: 400,
            score_plus_one: 10,
          },
          {
            name: 'Carol',
            profile_count: 0,
            credit_sum: 0,
            credit_avg: null,
            score_plus_one: 0,
          }
        );
      });
    }
  );

  // A `where:` which no unmatched row passes lets the join be written
  // INNER, with the same answers.
  describe.each(['keyed', 'keyless'])('a where: on the %s orders', orders => {
    const aggregates = `
        group_by: name
        aggregate:
          order_count is ${orders}.count()
          amount_sum is ${orders}.amount.sum()
          credit_sum is ${orders}.sum(credit)
          customer_count is count()
        order_by: name
      `;

    it('writes the join INNER', async () => {
      const query = `run: buyers -> {
          where: ${orders}.amount > 6
          ${aggregates}
        }`;
      const sql = await unmatched.model.loadQuery(query).getSQL();
      expect(sql).toContain('INNER JOIN');
      await expect(query).toMatchResult(
        unmatched,
        {
          name: 'Alice',
          order_count: 1,
          amount_sum: 7,
          credit_sum: 100,
          customer_count: 1,
        },
        {
          name: 'Bob',
          order_count: 1,
          amount_sum: 11,
          credit_sum: 400,
          customer_count: 1,
        }
      );
    });
  });

  it('an inner join still skips a row whose declared key is NULL', async () => {
    const nullKey = extendTestModel(
      mkTestModel(testDatabase, {
        customers: [{customer_id: 1, name: 'Alice'}],
        null_key_orders: [
          {order_id: 10, customer_id: 1, amount: 5},
          {order_id: null, customer_id: 1, amount: 7},
        ],
      }),
      `
          source: nk_buyers is customers extend {
            join_many: o is null_key_orders extend {
              primary_key: order_id
            } on o.customer_id = customer_id
          }
        `
    );
    const query = `run: nk_buyers -> {
        where: o.amount > 0
        aggregate: order_count is o.count(), amount_sum is o.amount.sum()
      }`;
    const sql = await nullKey.model.loadQuery(query).getSQL();
    expect(sql).toContain('INNER JOIN');
    await expect(query).toMatchResult(nullKey, {
      order_count: 1,
      amount_sum: 5,
    });
  });

  // An empty array unnests to one unmatched row.
  it.when(testDatabase.name === 'duckdb')(
    'an aggregate at an array skips an empty array',
    async () => {
      await expect(`
          run: db.sql("""
            SELECT 'Alice' as name, 100 as credit, [5, 7] as amounts
            UNION ALL SELECT 'Carol', 5000, []::INTEGER[]
          """) -> {
            group_by: name
            aggregate:
              amount_count is amounts.count()
              credit_sum is amounts.sum(credit)
              credit_avg is amounts.avg(credit)
            order_by: name
          }
        `).toMatchResult(
        unmatched,
        {name: 'Alice', amount_count: 2, credit_sum: 200, credit_avg: 100},
        {name: 'Carol', amount_count: 0, credit_sum: 0, credit_avg: null}
      );
    }
  );

  // A right join leaves the query's own source unmatched: Carol's row has
  // no order in it.
  it('the query source skips its own unmatched row', async () => {
    await expect(`
        ##! experimental.join_types
        run: keyed_orders -> {
          extend: {
            join_one: customers right on customers.customer_id = customer_id
          }
          group_by: customers.name
          aggregate:
            order_count is count()
            ones is sum(1)
            amount_avg is avg(amount ?? 0)
          order_by: name
        }
      `).toMatchResult(
      unmatched,
      {name: 'Alice', order_count: 2, ones: 2, amount_avg: 6},
      {name: 'Bob', order_count: 1, ones: 1, amount_avg: 11},
      {name: 'Carol', order_count: 0, ones: 0, amount_avg: null}
    );
  });
});

function lotsOfNumbersSQLTable(db: string): string | undefined {
  return {
    'mysql': `
    SELECT
    p0.n
    + p1.n*2
    + p2.n * POWER(2,2)
    + p3.n * POWER(2,3)
    + p4.n * POWER(2,4)
    + p5.n * POWER(2,5)
    + p6.n * POWER(2,6)
    + p7.n * POWER(2,7)
    + p8.n * POWER(2,8)
    + p9.n * POWER(2,9)
    + p10.n * POWER(2,10)
    + p11.n * POWER(2,11)
    + p12.n * POWER(2,12)
    + p13.n * POWER(2,13)
    + p14.n * POWER(2,14)
    + p15.n * POWER(2,15)
    + p16.n * POWER(2,16)
    + p17.n * POWER(2,17)
    + p18.n * POWER(2,18)
    + p19.n * POWER(2,19)
    as n
  FROM
    (SELECT 0 as n UNION SELECT 1) p0,
    (SELECT 0 as n UNION SELECT 1) p1,
    (SELECT 0 as n UNION SELECT 1) p2,
    (SELECT 0 as n UNION SELECT 1) p3,
    (SELECT 0 as n UNION SELECT 1) p4,
    (SELECT 0 as n UNION SELECT 1) p5,
    (SELECT 0 as n UNION SELECT 1) p6,
    (SELECT 0 as n UNION SELECT 1) p7,
    (SELECT 0 as n UNION SELECT 1) p8,
    (SELECT 0 as n UNION SELECT 1) p9,
    (SELECT 0 as n UNION SELECT 1) p10,
    (SELECT 0 as n UNION SELECT 1) p11,
    (SELECT 0 as n UNION SELECT 1) p12,
    (SELECT 0 as n UNION SELECT 1) p13,
    (SELECT 0 as n UNION SELECT 1) p14,
    (SELECT 0 as n UNION SELECT 1) p15,
    (SELECT 0 as n UNION SELECT 1) p16,
    (SELECT 0 as n UNION SELECT 1) p17,
    (SELECT 0 as n UNION SELECT 1) p18,
    (SELECT 0 as n UNION SELECT 1) p19
    `,
    'duckdb': 'SELECT UNNEST(GENERATE_SERIES(0,1048575,1)) as n',
  }[db];
}
const lotsSQL = lotsOfNumbersSQLTable(testDatabase.name);
it.when(lotsSQL !== undefined)('big symmetric sum', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: lots_of_numbers is db.sql(""" ${lotsSQL} """) extend {
        measure:
          total_n is n.sum()
      }
      query: two_rows is db.table('malloytest.state_facts') -> {select: state;  limit: 2}
      source: b is two_rows extend {
        join_cross: lots_of_numbers
      }
      run: b -> {
        aggregate: lots_of_numbers.total_n
      }
    `).toMatchResult(testModel, {total_n: 549755289600});
});

it('symmetric sum and average large', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.airports') extend {
        primary_key: code
        dimension:
          big_elevation is elevation * 100000.0
          little_elevation is elevation / 100000.0
        measure:
          total_elevation is elevation.sum()
          total_little_elevation is round(little_elevation.sum(),4)
          average_elevation is floor(elevation.avg())
          total_big_elevation is round(big_elevation.sum(),0)     // mysql is weird
          average_big_elevation is floor(big_elevation.avg())
      }
      query: two_rows is db.table('malloytest.state_facts') -> {select: state;  limit: 2}
      source: b is two_rows extend {
        join_cross: a
      }

      run: b -> {aggregate: a.total_elevation, a.total_little_elevation, a.average_elevation, a.total_big_elevation, a.average_big_elevation}
      // run: two_rows

    `).toMatchResult(testModel, {
    total_elevation: 22629146,
    total_little_elevation: 226.2915,
    average_elevation: 1143,
    total_big_elevation: 2262914600000,
    average_big_elevation: 114329035,
  });
});

it('leafy count', async () => {
  // in a joined table when the joined is leafiest
  //  we need to make sure we don't count rows that
  //  don't match the join.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: am_states is db.table('malloytest.state_facts') -> {
        select: *
        where: state ~ r'^(A|M)'
      }

      source: states is db.table('malloytest.state_facts') extend {
        join_many: am_states on state=am_states.state
      }

      run: states -> {
        where: state = 'CA'
        aggregate:
          leafy_count is am_states.count()
          root_count is count()
      }
      `).toMatchResult(testModel, {
    leafy_count: 0,
    root_count: 1,
  });
});

it('count at root should not use distinct key', async () => {
  const q = await testDatabase.runtime
    .loadQuery(
      `
      source: states is db.table('malloytest.state_facts')

      run: states -> { aggregate: c is count() }
      `
    )
    .run();
  expect(q.sql.toLowerCase()).not.toContain('distinct');
});

it.when(testDatabase.dialect.supportsLeftJoinUnnest)(
  'leafy nested count',
  async () => {
    // in a joined table when the joined is leafiest
    //  we need to make sure we don't count rows that
    //  don't match the join.
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
      source: am_states is db.table('malloytest.state_facts') -> {
        group_by: state,popular_name
        where: state ~ r'^(A|M)'
        nest: nested_state is {
          group_by: state,popular_name
        }
      }

      source: states is db.table('malloytest.state_facts') extend {
        join_many: am_states on state=am_states.state
      }
      run: states -> {
        where: state = 'CA'
        group_by:
          state
          am_state is am_states.state
        aggregate:
          leafy_count is am_states.nested_state.count()
          root_count is count()
      }
      `).toMatchResult(testModel, {
      leafy_count: 0,
      root_count: 1,
      state: 'CA',
      am_state: null,
    });
  }
);

// average should only include non-null values in the denominator
it('avg ignore null', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: one is db.sql("""
        SELECT 2 as ${q`a`}
        UNION ALL SELECT 4
        UNION ALL SELECT null
      """)
      run: one -> {
        extend: { join_cross: x1 is one }
        aggregate:
          avg_a is a.avg()
          avg_b is x1.a.avg()
      }`).toMatchResult(testModel, {avg_a: 3});
});

it('ungrouped top level', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.table('malloytest.state_facts') extend {
        measure: total_births is births.sum()
        measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
      } -> {
        group_by: state
        aggregate: births_per_100k
      }`).toMatchResult(testModel, {births_per_100k: 9742});
});

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped top level with nested',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
      run: db.table('malloytest.state_facts') extend {
        measure: total_births is births.sum()
        measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
      } -> {
        group_by: state
        aggregate: births_per_100k
        nest: by_name is {
          group_by: popular_name
          aggregate: total_births
        }
        limit: 1000
      }`).toMatchResult(testModel, {births_per_100k: 9742});
  }
);

it('ungrouped - eliminate rows', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run : db.table('malloytest.state_facts') extend {
        measure: m is all(births.sum())
        where: state='CA' | 'NY'
      } -> {
        order_by: state
        group_by: state
        aggregate: m
      }`).toMatchResult(
    testModel,
    {state: 'CA', m: 52504699},
    {state: 'NY', m: 52504699}
  );
});

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped nested with no grouping above',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        // # test.debug
        run: db.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        } -> {
          aggregate: total_births
          nest: by_name is {
            group_by: popular_name
            aggregate: births_per_100k
          }
        }`).toMatchPaths(testModel, {'by_name.births_per_100k': 66703});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped - partial grouping',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.airports') extend {
          measure: c is count()
        } -> {
          where: state = 'TX' | 'NY'
          group_by:
            faa_region
            state
          aggregate:
            c
            all_ is all(c)
            airport_count is c { where: fac_type = 'AIRPORT'}
          nest: fac_type is {
            group_by: fac_type
            aggregate:
              c
              all_ is all(c)
              all_state_region is exclude(c,fac_type)
              all_of_this_type is exclude(c, state, faa_region)
              all_top is exclude(c, state, faa_region, fac_type)
          }
        }
      `).toMatchPaths(testModel, {
      'fac_type.all_': 1845,
      'fac_type.all_state_region': 1845,
      'fac_type.all_of_this_type': 1782,
      'fac_type.all_top': 2421,
    });
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped - all nested',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.airports') extend {
          measure: c is count()
        } -> {
          where: state = 'TX' | 'NY'
          group_by:
            state
          aggregate:
            c
            all_ is all(c)
            airport_count is c { where: fac_type = 'AIRPORT'}
          nest: fac_type is {
            group_by: fac_type, major
            aggregate:
              c
              all_ is all(c)
              all_major is all(c,major)
          }
        }
      `).toMatchPaths(testModel, {
      'fac_type.all_': 1845,
      'fac_type.all_major': 1819,
    });
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped nested',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        } -> {
          group_by: popular_name
          nest: by_state is {
            group_by: state
            aggregate: births_per_100k
          }
        }
      `).toMatchPaths(testModel, {'by_state.births_per_100k': 36593});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped nested expression',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        } -> {
          group_by: upper_name is upper(popular_name)
          nest: by_state is {
            group_by: state
            aggregate: births_per_100k
          }
        }
      `).toMatchPaths(testModel, {'by_state.births_per_100k': 36593});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'ungrouped nested group by float',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: ug is all(total_births)
        } -> {
          group_by: f is floor(airport_count/300.0)
          nest: by_state is {
            group_by: state
            aggregate: ug
          }
        }
      `).toMatchPaths(testModel, {'by_state.ug': 62742230});
  }
);

it('all with parameters - basic', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.table('malloytest.state_facts') extend  {
        measure: total_births is births.sum()
      } -> {
        group_by: popular_name, state
        aggregate:
          total_births
          all_births is all(total_births)
          all_name is exclude(total_births, state)
      }
    `).toMatchResult(testModel, {
    all_births: 295727065,
    all_name: 197260594,
  });
});

test.when(testDatabase.dialect.supportsNesting)(
  'all with parameters - nest',
  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          dimension: abc is floor(airport_count/300)
        } -> {
          group_by: abc
          aggregate: total_births
          nest: by_stuff is {
            group_by: popular_name, state
            aggregate:
              total_births
              all_births is all(total_births)
              all_name is exclude(total_births, state)
          }
        }
      `).toMatchPaths(testModel, {
      'by_stuff.all_births': 119809719,
      'by_stuff.all_name': 61091215,
    });
  }
);

const orderByModel = wrapTestModel(
  testDatabase,
  `
    source: models is db.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`
);

it('filtered measures in model are aggregates #352', async () => {
  await expect(`
      run: models->{
        aggregate: j_names is model_count {where: manufacturer ~ 'J%'}
      } -> {
        group_by: j_names
      }
    `).toMatchResult(orderByModel, {j_names: 1358});
});

it('aggregate and scalar conditions', async () => {
  await expect(`
      run: models->{
        aggregate: model_count is count(){ where: manufacturer ? ~'A%' }
      }
    `).toMatchResult(orderByModel, {});
});
