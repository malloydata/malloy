/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Dialect} from '@malloydata/malloy';
import {RuntimeList, allDatabases, testFileSpace} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {
  extendTestModel,
  mkTestModel,
  TV,
  wrapTestModel,
} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

function modelText(connectionName: string) {
  return `
  source: aircraft_models is ${connectionName}.table('malloytest.aircraft_models') extend {
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

  source: aircraft is ${connectionName}.table('malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
  }

  source: funnel is aircraft_models->manufacturer_models extend {
    join_one: seats is aircraft_models->manufacturer_seats
        with manufacturer
  }
`;
}

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const joinModel = wrapTestModel(runtime, modelText(databaseName));
  const testModel = wrapTestModel(runtime, '');

  it('model source refine join', async () => {
    await expect(`
      source: a2 is aircraft extend {
        join_one: aircraft_models with aircraft_model_code
      }
      run: a2 -> {
        aggregate:
          aircraft_count
          aircraft_models.model_count
      }
    `).toMatchResult(joinModel, {model_count: 1416});
  });

  it('model source refine in query join', async () => {
    await expect(`
      run: aircraft extend {
        join_one: aircraft_models with aircraft_model_code
      } -> {
        aggregate:
          aircraft_count
          aircraft_models.model_count
      }
    `).toMatchResult(joinModel, {model_count: 1416});
  });

  it('model: join fact table query', async () => {
    await expect(`
      run: aircraft_models extend {
        join_one: am_facts is
          aircraft_models->{
            group_by: m is manufacturer
            aggregate: num_models is count()
          } with manufacturer
      } -> {
        select:
          manufacturer
          am_facts.num_models
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {num_models: 1147});
  });

  it('model: source based on query', async () => {
    await expect(`
      run: aircraft_models
        -> {
          group_by: m is manufacturer
          aggregate: num_models is count()
        } -> {
          select:
          m
          num_models
          order_by: 2 desc
          limit: 1
        }
    `).toMatchResult(joinModel, {num_models: 1147});
  });

  it('model: funnel - merge two queries', async () => {
    await expect(`
      run: aircraft_models->{
        group_by: m is manufacturer
        aggregate: num_models is count()
        } extend {
          join_one: seats_join is
            aircraft_models->{
              group_by: m is manufacturer
              aggregate: total_seats is seats.sum()
            } with m
        } -> {
          select:
            m
            num_models
            seats_join.total_seats
          order_by: 2 desc
          limit: 1
        }
    `).toMatchResult(joinModel, {
      num_models: 1147,
      total_seats: 252771,
    });
  });

  it('model: modeled funnel', async () => {
    await expect(`
      run: aircraft_models-> manufacturer_models extend {
        join_one: seats is aircraft_models->manufacturer_seats with manufacturer
      } -> {
        select:
          manufacturer,
          num_models,
          seats.total_seats
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {
      num_models: 1147,
      total_seats: 252771,
    });
  });

  it('model: modeled funnel2', async () => {
    await expect(`
      run: funnel->{
        select:
        manufacturer
          num_models
          seats.total_seats
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {
      num_models: 1147,
      total_seats: 252771,
    });
  });

  it('model: double_pipe', async () => {
    await expect(`
      run: aircraft_models->{
        group_by: manufacturer
        aggregate: f is count()
      }->{
        aggregate: f_sum is f.sum()
      }->{
        select: f_sum2 is f_sum+1
      }
  `).toMatchResult(joinModel, {f_sum2: 60462});
  });

  test.when(runtime.supportsNesting && runtime.dialect.supportsLeftJoinUnnest)(
    'model: unnest is left join',
    async () => {
      await expect(`
        // produce a table with 4 rows that has a nested element
        query: a_states is ${databaseName}.table('malloytest.state_facts')-> {
        where: state ? ~ 'A%'
          group_by: state
          nest: somthing is {group_by: state}
        }

        // join the 4 rows and reference the
        //  nested column. should return all the rows.
        //  If the unnest is an inner join, we'll get back just 4 rows.
        run: ${databaseName}.table('malloytest.state_facts') extend {
          join_one: a_states is a_states with state
        }
        -> {
          group_by: state
          aggregate: c is count()
          nest: a is  {
            group_by: a_states.somthing.state
          }
          limit: 5
        }
      `).toMatchRows(joinModel, [{}, {}, {}, {}, {}]);
    }
  );

  // Trino and Presto declare the nest's count() as INTEGER in its ROW type,
  // which makes this the symmetric sum of a 32 bit value.
  test.when(runtime.supportsNesting)(
    'symmetric sum of an integer nest field through a join',
    async () => {
      await expect(`
        source: three is ${databaseName}.table('malloytest.airports') -> {
          group_by: state
          nest: types is { group_by: fac_type; aggregate: c is count() }
        }
        source: sf is ${databaseName}.table('malloytest.state_facts') extend {
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
    const accounts = mkTestModel(runtime, {
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
    const byHash = runtime.dialect.sumDistinctByHash;
    const isShifty = byHash?.form === 'shifty';
    const roundsWideProducts =
      byHash?.form === 'shifty' && byHash.roundsWideProducts;

    // The dialect without the cast to its result type, which would round
    // away the digits these tests compare.
    const exact: Dialect = Object.create(runtime.dialect);
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
      const result = await runtime.connection.runSQL(
        `SELECT ${matches} AS matches FROM (${source}) t ${where}`
      );
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
      expect(
        await shiftySum('SUM', 'BIGINT', rows, '9223372036854775808')
      ).toBe(true);
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
        expect(
          await shiftySum('SUM', 'DECIMAL(20,9)', rows, '1.12345678')
        ).toBe(true);
      }
    );

    test.when(isShifty)(
      'sums a double as its nearest eight digits',
      async () => {
        const rows: Row[] = [
          [1, '0.1'],
          [1, '0.1'],
          [2, '0.2'],
          [3, '-1.00000001'],
        ];
        expect(await shiftySum('SUM', 'DOUBLE', rows, '-0.70000001')).toBe(
          true
        );
      }
    );

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

  it('activates parent join when fields in leaf join are referenced', async () => {
    await expect(`
      source: flights is ${databaseName}.table('malloytest.flights') extend {
        join_one: aircraft is ${databaseName}.table('malloytest.aircraft')
          on tail_num = aircraft.tail_num
        join_one: aircraft_models is ${databaseName}.table('malloytest.aircraft_models')
          on aircraft.aircraft_model_code = aircraft_models.aircraft_model_code
      }

      run: flights -> {
        group_by: aircraft_models.seats
        aggregate: flight_count is count()
        limit: 5
      }
    `).toMatchRows(testModel, [{}, {}, {}, {}, {}]);
  });

  // I don't know what join issue 440 was, there was a change of repos and that
  // is no longer recorded anywhere. I suspect it was the indirect reference to
  // the leaf join field. In a world where the join tree is built from fieldUsage
  // that automatically works, but what is a problem is inferring the join tree
  // from the ordering of usages. Inverting the "on" comparison in this test
  // caused it to fail when the previous one passed.
  it('join issue440', async () => {
    await expect(`
      source: aircraft is ${databaseName}.table('malloytest.aircraft')
      source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models')

      source: flights is ${databaseName}.table('malloytest.flights') extend {
        join_one: aircraft on aircraft.tail_num = tail_num
        join_one: aircraft_models on aircraft_models.aircraft_model_code = aircraft.aircraft_model_code
      }

      run: flights-> {
        group_by: testtwo is aircraft_models.seats
        limit: 1
      }
    `).toMatchResult(testModel, {});
  });

  it('join issue1092', async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        extend: {join_one: sf is ${databaseName}.table('malloytest.state_facts') on sf.state = state}
        aggregate: x is sf.births.sum() { where:  state = 'CA' }
      }
    `).toMatchResult(testModel, {});
  });

  it('always join in query', async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        join_cross: x is ${databaseName}.table('malloytest.state_facts') on true
        select: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 51 * 51});
  });

  it('not always join in extend', async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        extend: {
          join_cross: x is ${databaseName}.table('malloytest.state_facts') on true
        }
        select: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 51});
  });

  it('always inner join has side effects (in group_by)', async () => {
    await expect(`
      ##! experimental.join_types
      run: ${databaseName}.table('malloytest.state_facts') -> {
        join_cross: x is ${databaseName}.table('malloytest.state_facts') inner on false
        group_by: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 0});
  });

  it.when(runtime.dialect.nestedArrays)(
    'finds join dependency in non basic atomic fields',
    async () => {
      await expect(`
      run: ${databaseName}.sql("SELECT 1 as n")
        extend { dimension: a1 is [[1]], a2 is [[2]] }
        -> { select: pick_a1 is pick a1.each when true else a2.each }
      `).toMatchResult(testModel, {pick_a1: [1]});
    }
  );

  it('cross-model import with sql interpolation in join', async () => {
    // When a sql_select source uses %{ source -> view } interpolation,
    // the Query segment stores the source's structRef as a string name.
    // After import into another model, that name is not in the importing
    // model's namespace, causing "Unexpected reference to an undefined source".
    const baseURL = new URL('test://join-import-base.malloy');
    const userURL = new URL('test://join-import-user.malloy');

    testFileSpace.setFile(
      baseURL,
      `
      source: base_models is ${databaseName}.table('malloytest.aircraft_models') extend {
        view: mfr_list is { select: manufacturer }
      }

      source: sql_mfrs is ${databaseName}.sql("""
        SELECT
          ${runtime.dialect.sqlQuoteIdentifier('manufacturer')}
          as ${runtime.dialect.sqlQuoteIdentifier('sql_mfr')}
          FROM %{ base_models -> mfr_list } as SpOrKlE
      """)

      source: combined is base_models extend {
        join_one: sql_mfrs on manufacturer = sql_mfrs.sql_mfr
      }

      source: result_src is combined -> {
        select: manufacturer, sql_mfrs.sql_mfr
      }
      `
    );

    testFileSpace.setFile(
      userURL,
      `
      import { result_src } from "test://join-import-base.malloy"

      run: result_src -> { select: * limit: 1 }
      `
    );

    try {
      const sql = await runtime.loadQuery(userURL).getSQL();
      expect(sql).toContain('SELECT');
    } finally {
      testFileSpace.deleteFile(baseURL);
      testFileSpace.deleteFile(userURL);
    }
  });

  // Carol is the customer no order matches: in the joined result she has one
  // row, in which the order is all NULLs.
  describe('aggregate at a joined source with an unmatched row', () => {
    const unmatched = extendTestModel(
      mkTestModel(runtime, {
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
        !['snowflake', 'mysql', 'sqlserver'].includes(databaseName);
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
        mkTestModel(runtime, {
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
    it.when(databaseName === 'duckdb')(
      'an aggregate at an array skips an empty array',
      async () => {
        await expect(`
          run: ${databaseName}.sql("""
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
});
