/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import '../../util/db-jest-matchers';
import {databasesFromEnvironmentOr, mkSqlEqWith} from '../../util';
import {fail} from 'assert';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

function modelText(databaseName: string): string {
  return `
source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
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
}

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const expressionModel = runtime.loadModel(modelText(databaseName));
  // basic calculations for sum, filtered sum, without a join.

  const q = runtime.getQuoter();

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
    `).malloyResultMatches(expressionModel, {
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
    `).malloyResultMatches(expressionModel, {
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
    `).malloyResultMatches(expressionModel, {
      total_seats: 18294,
      boeing_seats: 6244,
    });
  });

  // simple turtle expressions
  it('simple turtle', async () => {
    await expect(`
      run:  ${databaseName}.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: airport_count.sum()
        nest: by_state is {
          group_by: state
          aggregate: airport_count.sum()
          limit: 2
        }
        limit: 3
      }
    `).malloyResultMatches(expressionModel, {
      'by_state.state': 'TX',
      'by_state.airport_count': 1845,
    });
  });

  it('double turtle', async () => {
    await expect(`
      run:  ${databaseName}.table('malloytest.state_facts') -> {
        aggregate: airport_count.sum()
        nest: o is {
          group_by: popular_name
          aggregate: airport_count.sum()
          nest: by_state is {
            group_by: state
            aggregate: airport_count.sum()
            limit: 2
          }
          limit: 3
          nest: inline is {
            aggregate: inline_sum is airport_count.sum()
          }
        }
      }
    `).malloyResultMatches(expressionModel, {
      'o.by_state.state': 'TX',
      'o.by_state.airport_count': 1845,
      'o.airport_count': 11146,
      'o.inline/inline_sum': 11146,
      'airport_count': 19701,
    });
  });

  it('double turtle - pipeline', async () => {
    await expect(`
      run:  ${databaseName}.table('malloytest.state_facts') -> {
        aggregate: airport_count.sum()
        nest: o is {
          group_by: popular_name
          aggregate: airport_count.sum()
          nest: by_state is {
            group_by: state
            aggregate: airport_count.sum()
            limit: 2
          }
          limit: 3
        }
      } -> {
        aggregate: o.by_state.airport_count.sum()
      }
    `).malloyResultMatches(expressionModel, {
      'airport_count': 5023,
    });
  });

  // turtle expressions
  it('model: turtle', async () => {
    await expect('run: aircraft->by_manufacturer').malloyResultMatches(
      expressionModel,
      {manufacturer: 'CESSNA'}
    );
  });

  // filtered turtle expressions
  test.when(runtime.supportsNesting)('model: filtered turtle', async () => {
    await expect(`
      run: aircraft->{
        nest: b is by_manufacturer + { where: aircraft_models.manufacturer ?~'B%'}
      }
    `).malloyResultMatches(expressionModel, {'b.manufacturer': 'BEECH'});
  });

  // having.
  it('model: simple having', async () => {
    await expect(`
      run: aircraft->{
        having: aircraft_count >90
        group_by: state
        aggregate: aircraft_count
        order_by: 2
        limit: 2
      }
    `).malloyResultMatches(expressionModel, {aircraft_count: 91});
  });

  test.when(runtime.supportsNesting)('model: having in a nest', async () => {
    await expect(`
      run: aircraft->{
        top: 10
        order_by: 1
        where: region != NULL
        group_by: region
        nest: by_state is {
          top: 10
          order_by: 1 desc
          having: aircraft_count > 50
          group_by: state
          aggregate: aircraft_count
        }
      }
    `).malloyResultMatches(expressionModel, {'by_state.state': 'VA'});
  });

  test.when(runtime.supportsNesting)(
    'model: turtle having on main',
    async () => {
      await expect(`
      run: aircraft->{
        order_by: 2 asc
        having: aircraft_count ? >500
        group_by: region
        aggregate: aircraft_count
        nest: by_state is {
          order_by: 2 asc
          having: aircraft_count >45
          group_by: state
          aggregate: aircraft_count
          nest: by_city is {
            order_by: 2 asc
            having: aircraft_count ? >5
            group_by: city
            aggregate: aircraft_count
          }
        }
      }
    `).malloyResultMatches(expressionModel, {
        'by_state.by_city.city': 'ALBUQUERQUE',
      });
    }
  );

  // bigquery doesn't like to partition by floats,
  test.when(runtime.supportsNesting)(
    'model: having float group by partition',
    async () => {
      await expect(`${modelText(databaseName)}
        run: aircraft_models->{
          order_by: 1
          where: seats_bucketed > 0
          having: aircraft_model_count > 400
          group_by: seats_bucketed
          aggregate: aircraft_model_count
          nest: foo is {
            group_by: engines
            aggregate: aircraft_model_count
          }
      }`).malloyResultMatches(runtime, {aircraft_model_count: 448});
    }
  );

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
    `).malloyResultMatches(expressionModel, {
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

  // TODO not sure why this test needs to be skipped on postgres, feels like an oversight
  // NOTE: unless underlying type is stored as a timestamp snowflake does not support extraction
  test.when(!['postgres', 'snowflake'].includes(databaseName))(
    'model: dates named',
    async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.alltypes')->{
        group_by:
          t_date,
          t_date_month is t_date.month,
          t_date_year is t_date.year,
          t_timestamp,
          t_timestamp_date is t_timestamp.day,
          t_timestamp_hour is t_timestamp.hour,
          t_timestamp_minute is t_timestamp.minute,
          t_timestamp_second is t_timestamp.second,
          t_timestamp_month is t_timestamp.month,
          t_timestamp_year is t_timestamp.year,
      }
    `).malloyResultMatches(runtime, {
        t_date: new Date('2020-03-02'),
        t_date_month: new Date('2020-03-01'),
        t_date_year: new Date('2020-01-01'),
        t_timestamp: new Date('2020-03-02T12:35:56.000Z'),
        t_timestamp_second: new Date('2020-03-02T12:35:56.000Z'),
        t_timestamp_minute: new Date('2020-03-02T12:35:00.000Z'),
        t_timestamp_hour: new Date('2020-03-02T12:00:00.000Z'),
        t_timestamp_date: new Date('2020-03-02'),
        t_timestamp_month: new Date('2020-03-01'),
        t_timestamp_year: new Date('2020-01-01'),
      });
    }
  );

  it('named query metadata undefined', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: aircraft->{
          aggregate: aircraft_count is count()
        }
        `
      )
      .run();
    // TODO The result explore should really be unnamed. This test currently
    //      inspects inner information because we have no way to have unnamed
    //       explores today.
    // expect(result.getResultExplore().name).toBe(undefined);
    expect(result._queryResult.queryName).toBe(undefined);
  });

  it('named query metadata named', async () => {
    const result = await expressionModel
      .loadQuery('run: aircraft->by_manufacturer')
      .run();
    expect(result.resultExplore.name).toBe('by_manufacturer');
  });

  it('named query metadata named head of pipeline', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: aircraft->by_manufacturer->{ aggregate: c is count()}
        `
      )
      .run();
    // TODO Same as above -- this test should check the explore name
    // expect(result.resultExplore.name).toBe(undefined);
    expect(result._queryResult.queryName).toBe(undefined);
  });

  it('filtered explores basic', async () => {
    await expect(`
      run: aircraft extend { where: aircraft_models.manufacturer ? ~'B%' }
        -> {aggregate: m_count is count(aircraft_models.manufacturer) }
    `).malloyResultMatches(expressionModel, {m_count: 63});
  });

  it('sql cast', async () => {
    await expect(`
      run: aircraft -> {
        group_by: a is "312"::"integer"
      }
    `).malloyResultMatches(expressionModel, {a: 312});
  });

  test.when(!['postgres'].includes(runtime.connection.name))(
    'sql safe cast',
    async () => {
      await expect(`
      run: ${databaseName}.sql('SELECT 1 as one') -> { select:
        bad_date is '12a':::date
        bad_number is 'abc':::number
        good_number is "312":::"integer"
      }
    `).malloyResultMatches(expressionModel, {
        bad_date: null,
        bad_number: null,
        good_number: 312,
      });
    }
  );

  it('many_field.sum() has correct locality', async () => {
    await expect(`
      source: a is ${databaseName}.table('malloytest.aircraft')
      source: am is ${databaseName}.table('malloytest.aircraft_models') extend {
        join_many: a on a.aircraft_model_code = a.aircraft_model_code
        dimension: a_year_built is a.year_built
      }

      run: am -> {
        aggregate: avg_a_year_built1 is floor(a_year_built.avg())
        aggregate: avg_a_year_built2 is floor(a.avg(a_year_built))
      }
    `).malloyResultMatches(runtime, {
      avg_a_year_built1: 1969,
      avg_a_year_built2: 1969,
    });
  });

  describe('sql expr functions', () => {
    it('sql_string', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: string_1 is sql_string("UPPER(\${manufacturer})")
        }
      `).malloyResultMatches(expressionModel, {
        string_1: 'AHRENS AIRCRAFT CORP.',
      });
    });

    it('sql_number', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: seats
          group_by: number_1 is sql_number("\${seats} * 2")
        }
  `).malloyResultMatches(expressionModel, {
        seats: 29,
        number_1: 58,
      });
    });

    it('sql_number can be sum()med', async () => {
      await expect(`
        ##! experimental { sql_functions }
        source: a is ${databaseName}.table('malloytest.aircraft_models') extend {
          where: aircraft_model_code ? '0270202'
          dimension: number_1 is sql_number("\${seats} * 2")
        }

        run: a -> {
          aggregate: s is number_1.sum()
        }
      `).malloyResultMatches(expressionModel, {
        s: 58,
      });
    });

    it('sql_boolean', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: boolean_1 is sql_boolean("\${seats} > 20")
          group_by: boolean_2 is sql_boolean("\${engines} = 2")
        }
  `).malloyResultMatches(expressionModel, {
        boolean_1: true,
        boolean_2: false,
      });
    });

    it('sql_date', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft') extend { where: tail_num ? 'N110WL' }

      run: a -> {
          group_by: date_1 is sql_date("\${last_action_date}")
        }
  `).malloyResultMatches(expressionModel, {
        date_1: new Date('2000-01-04T00:00:00.000Z'),
      });
    });

    it('sql_timestamp', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft') extend { where: tail_num ? 'N110WL' }

      run: a -> {
        group_by: timestamp_1 is sql_timestamp("\${last_action_date}")
        }
  `).malloyResultMatches(expressionModel, {
        timestamp_1: new Date('2000-01-04T00:00:00.000Z'),
      });
    });

    it('with ${TABLE}.field', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: string_1 is sql_string('UPPER(\${TABLE}.${q`manufacturer`})')
        }
      `).malloyResultMatches(expressionModel, {
        string_1: 'AHRENS AIRCRAFT CORP.',
      });
    });

    it('with ${field}', async () => {
      await expect(`
      ##! experimental { sql_functions }
      source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

      run: a -> {
          group_by: string_1 is sql_string("UPPER(\${manufacturer})")
        }
      `).malloyResultMatches(expressionModel, {
        string_1: 'AHRENS AIRCRAFT CORP.',
      });
    });

    it('sql_functions - experimental feature is ignored', async () => {
      const query = await expressionModel.loadQuery(
        `
        source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

        run: a -> {
            group_by: manufacturer
            group_by: string_1 is sql_string("UPPER(\${manufacturer})")
          }
        `
      );

      const runResult = await query.run();
      const dataResult = runResult.data.toObject();
      expect(dataResult.length).toEqual(1);
      const firstRow = dataResult.at(0);
      if (firstRow !== undefined) {
        expect(firstRow['manufacturer']).toEqual('AHRENS AIRCRAFT CORP.');
        expect('string_1' in firstRow).toBeFalsy();
      } else {
        fail('exepected a single row, but found none');
      }
    });

    describe('[not yet supported]', () => {
      // See ${...} documentation for lookml here for guidance on remaining work:
      // https://cloud.google.com/looker/docs/reference/param-field-sql#sql_for_dimensions
      it('${view_name.dimension_name} - one path', async () => {
        const query = await expressionModel.loadQuery(
          `
          ##! experimental { sql_functions }
          source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

          run: a -> {
              group_by: string_1 is sql_string("UPPER(\${a.manufacturer})")
            }
          `
        );
        await expect(query.run()).rejects.toThrow(
          "'.' paths are not yet supported in sql interpolations, found ${a.manufacturer}"
        );
      });

      it('${view_name.dimension_name} - multiple paths', async () => {
        const query = await expressionModel.loadQuery(
          `
          ##! experimental { sql_functions }
          source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

          run: a -> {
              group_by: number_1 is sql_number("\${a.seats} * \${a.seats} + \${a.total_seats}")
            }
          `
        );
        await expect(query.run()).rejects.toThrow(
          "'.' paths are not yet supported in sql interpolations, found [${a.seats}, ${a.seats}, ${a.total_seats}]"
        );
      });

      it('${view_name.SQL_TABLE_NAME}', async () => {
        const query = await expressionModel.loadQuery(
          `
          ##! experimental { sql_functions }
          source: a is ${databaseName}.table('malloytest.aircraft_models') extend { where: aircraft_model_code ? '0270202' }

          run: a -> {
              group_by: number_1 is sql_number("\${a.SQL_TABLE_NAME}.seats")
            }
          `
        );
        await expect(query.run()).rejects.toThrow(
          "'.' paths are not yet supported in sql interpolations, found ${a.SQL_TABLE_NAME}"
        );
      });
    });
  });

  test.when(runtime.supportsNesting)(
    'query with aliasname used twice',
    async () => {
      await expect(`
        run: aircraft->{
          group_by: first is substr(city,1,1)
          aggregate: aircraft_count is count()
          nest: aircraft is {
            group_by: first_two is substr(city,1,2)
            aggregate: aircraft_count is count()
            nest: aircraft is {
              group_by: first_three is substr(city,1,3)
              aggregate: aircraft_count is count()
            }
          }
        } -> {
          select:
            aircraft.aircraft.first_three
            aircraft_count
            order_by: 2 desc, 1
        }
      `).malloyResultMatches(expressionModel, {first_three: 'SAB'});
    }
  );

  it('joined filtered sources', async () => {
    await expect(`
      source: a_models is ${databaseName}.table('malloytest.aircraft_models') extend {
        where: manufacturer ? ~'B%'
        primary_key: aircraft_model_code
        measure:model_count is count()
      }

      source: aircraft2 is ${databaseName}.table('malloytest.aircraft') extend {
        join_one: model is a_models with aircraft_model_code
        measure: aircraft_count is count()
      }

      run: aircraft2->{
        aggregate:
          model.model_count
          aircraft_count
      }
    `).malloyResultMatches(expressionModel, {
      model_count: 244,
      aircraft_count: 3599,
    });
  });

  test.when(runtime.dialect.supportsComplexFilteredSources)(
    'joined filtered explores with dependencies',
    async () => {
      await expect(`
      source: bo_models is
        ${databaseName}.table('malloytest.aircraft_models') extend { where: manufacturer ? ~ 'BO%' }
        -> { select: aircraft_model_code, manufacturer, seats }
        extend {
          primary_key: aircraft_model_code
          measure: bo_count is count()
        }
      source: b_models is
        ${databaseName}.table('malloytest.aircraft_models') extend { where: manufacturer ? ~ 'B%' }
        -> { select: aircraft_model_code, manufacturer, seats }
        extend {
          where: bo_models.seats > 200
          primary_key: aircraft_model_code
          measure: b_count is count()
          join_one: bo_models with aircraft_model_code
        }

      source: models is ${databaseName}.table('malloytest.aircraft_models') extend {
        join_one: b_models with aircraft_model_code
        measure: model_count is count()
      }

      run: models -> {
        aggregate: model_count
        aggregate: b_models.b_count
        -- aggregate: b_models.bo_models.bo_count
      }
    `).malloyResultMatches(runtime, {model_count: 60461, b_count: 355});
    }
  );
});

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const q = runtime.getQuoter();
  const sqlEq = mkSqlEqWith(runtime, databaseName, {
    malloy: `extend {
      dimension: friName is 'friday'
      dimension: friDay is 5
      dimension: satName is 'saturday'
      dimension: satDay is 6
    }`,
  });

  describe.skip('alternations with not-eq', () => {
    /*
     Here's the desired truth table ...

     x      x != y | z
     ====== ============
     y      false
     z      false
     ^[yz]  true
     */
    test('x not-eq y or z : x eq y', async () => {
      const result = await sqlEq('6 != (6|7)', false);
      expect(result).isSqlEq();
    });
    test('x not-eq y or z : x eq z', async () => {
      const result = await sqlEq('7 != (6|7)', false);
      expect(result).isSqlEq();
    });
    test('x not-eq y or z : else', async () => {
      const result = await sqlEq('5 != (6|7)', true);
      expect(result).isSqlEq();
    });
    /*
      Writing this the old way, should have the same truth table ...
        x != y & != z
    */
    test('x not-eq y and not-eq z : x eq y', async () => {
      const result = await sqlEq('6 != (6 & !=7)', false);
      expect(result).isSqlEq();
    });
    test('x not-eq y and not-eq z : x eq z', async () => {
      const result = await sqlEq('7 != (6 & != 7)', false);
      expect(result).isSqlEq();
    });
    test('x not-eq y and not-eq z : else', async () => {
      const result = await sqlEq('5 != (6 & !=7)', true);
      expect(result).isSqlEq();
    });
  });

  describe('string literal quoting', () => {
    const dq = '"';
    const tick = "'";
    const back = '\\';
    test('quote single character', async () => {
      expect(await sqlEq(`'${back}x'`, 'x')).isSqlEq();
    });
    test('quote single quote', async () => {
      expect(await sqlEq(`'${back}${tick}'`, tick)).isSqlEq();
    });
    test('quote double quote', async () => {
      await expect(
        `run: ${databaseName}.sql("SELECT 1 as one") -> {
          select: double_quote is "${back}${dq}"
        }`
      ).malloyResultMatches(runtime, {double_quote: '"'});
    });
    test('quote backslash', async () => {
      expect(await sqlEq(`'${back}${back}'`, back)).isSqlEq();
    });
  });

  test('nullish ?? operator', async () => {
    await expect(
      `run: ${databaseName}.sql("""
          SELECT '' as ${q`null_value`}, '' as ${q`string_value`}
          UNION ALL SELECT null, 'correct'
      """) -> {
        where: null_value = null
        select:
          found_null is  null_value ?? 'correct',
          else_pass is string_value ?? 'incorrect'
          literal_null is null ?? 'correct'
      }`
    ).malloyResultMatches(runtime, {
      found_null: 'correct',
      else_pass: 'correct',
      literal_null: 'correct',
    });
  });

  test('dimension expressions expanded with parens properly', async () => {
    await expect(
      `run: ${databaseName}.sql("SELECT 1 as one") extend {
        dimension: fot is (false) or (true)
      } -> {
        select:
          no_paren is false and fot
          paren is    false and (fot)
      }`
    ).malloyResultMatches(runtime, {paren: false, no_paren: false});
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
