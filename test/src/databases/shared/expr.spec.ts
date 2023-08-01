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

import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {mkSqlEqWith} from '../../util';

const expressionModelText = `
source: aircraft_models is table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    airport_count is count(*),
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) {? manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count(*)
  query: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;

export const exprSharedTests = (runtimes: RuntimeList) => {
  describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
    const expressionModel = runtime.loadModel(expressionModelText);
    // basic calculations for sum, filtered sum, without a join.
    it('basic calculations', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft_models->{
          aggregate:
            total_seats,
            total_seats2 is sum(seats),
            boeing_seats,
            boeing_seats2 is sum(seats) {? manufacturer ? 'BOEING'},
            boeing_seats3 is total_seats {? manufacturer ? 'BOEING'},
            percent_boeing,
            percent_boeing2 is boeing_seats / total_seats * 100,
            -- percent_boeing_floor,
            -- percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
        }
        `
        )
        .run();
      expect(result.data.path(0, 'total_seats').value).toBe(452415);
      expect(result.data.path(0, 'total_seats2').value).toBe(452415);
      expect(result.data.path(0, 'boeing_seats').value).toBe(252771);
      expect(result.data.path(0, 'boeing_seats2').value).toBe(252771);
      expect(result.data.path(0, 'boeing_seats3').value).toBe(252771);
      expect(
        Math.floor(result.data.path(0, 'percent_boeing').number.value)
      ).toBe(55);
      expect(
        Math.floor(result.data.path(0, 'percent_boeing2').number.value)
      ).toBe(55);
      // expect(result.data.path(0, "percent_boeing_floor").value).toBe(55);
      // expect(result.data.path(0, "percent_boeing_floor2").value).toBe(55);
    });

    // Floor is broken (doesn't compile because the expression returned isn't an aggregate.)
    it('Floor() -or any function bustage with aggregates', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft_models->{
          aggregate:
            percent_boeing_floor
            percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
        }
      `
        )
        .run();
      expect(result.data.path(0, 'percent_boeing_floor').value).toBe(55);
      expect(result.data.path(0, 'percent_boeing_floor2').value).toBe(55);
    });

    // Model based version of sums.
    it('model: expression fixups.', async () => {
      const result = await expressionModel
        .loadQuery(
          `
            query: aircraft->{
              aggregate:
                aircraft_models.total_seats
                aircraft_models.boeing_seats
            }
          `
        )
        .run();
      expect(result.data.path(0, 'total_seats').value).toBe(18294);
      expect(result.data.path(0, 'boeing_seats').value).toBe(6244);
    });

    // turtle expressions
    it('model: turtle', async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: aircraft->by_manufacturer
          `
        )
        .run();
      expect(result.data.path(0, 'manufacturer').value).toBe('CESSNA');
    });

    // filtered turtle expressions
    it('model: filtered turtle', async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: aircraft->{
            nest: b is by_manufacturer{? aircraft_models.manufacturer ?~'B%'}
          }
        `
        )
        .run();
      expect(result.data.path(0, 'b', 0, 'manufacturer').value).toBe('BEECH');
    });

    // having.
    it('model: simple having', async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: aircraft->{
            having: aircraft_count >90
            group_by: state
            aggregate: aircraft_count
            order_by: 2
          }
          `
        )
        .run();
      expect(result.data.path(0, 'aircraft_count').value).toBe(91);
    });

    it('model: turtle having2', async () => {
      const result = await expressionModel
        .loadQuery(
          `
      -- hacking a null test for now
      query: aircraft->{
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
        `
        )
        .run();
      expect(result.data.path(0, 'by_state', 0, 'state').value).toBe('VA');
    });

    it('model: turtle having on main', async () => {
      const result = await expressionModel
        .loadQuery(
          `
      query: aircraft->{
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
        `
        )
        .run();
      expect(
        result.data.path(0, 'by_state', 0, 'by_city', 0, 'city').value
      ).toBe('ALBUQUERQUE');
    });

    // bigquery doesn't like to partition by floats,
    it('model: having float group by partition', async () => {
      await expect(runtime).queryMatches(
        `${expressionModelText}
      query: aircraft_models->{
        order_by: 1
        where: seats_bucketed > 0
        having: aircraft_model_count > 400
        group_by: seats_bucketed
        aggregate: aircraft_model_count
        nest: foo is {
          group_by: engines
          aggregate: aircraft_model_count
        }
      }`,
        {aircraft_model_count: 448}
      );
    });

    it('model: aggregate functions distinct min max', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft_models->{
          aggregate:
            distinct_seats is count(distinct seats),
            boeing_distinct_seats is count(distinct seats) {?manufacturer ? 'BOEING'},
            min_seats is min(seats),
            cessna_min_seats is min(seats) {? manufacturer ? 'CESSNA'},
            max_seats is max(seats),
            cessna_max_seats is max(seats) {? manufacturer ? 'CESSNA'},
            min_code is min(aircraft_model_code),
            boeing_min_model is min(model) {? manufacturer ? 'BOEING'},
            max_model is max(model),
            boeing_max_model is max(model) {? manufacturer ? 'BOEING'},
        }
        `
        )
        .run();
      expect(result.data.path(0, 'distinct_seats').value).toBe(187);
      expect(result.data.path(0, 'boeing_distinct_seats').value).toBe(85);
      expect(result.data.path(0, 'min_seats').value).toBe(0);
      expect(result.data.path(0, 'cessna_min_seats').value).toBe(1);
      expect(result.data.path(0, 'max_seats').value).toBe(660);
      expect(result.data.path(0, 'min_code').value).toBe('0030109');
      expect(result.data.path(0, 'cessna_max_seats').value).toBe(14);
      expect(result.data.path(0, 'boeing_min_model').value).toBe('100');
      expect(result.data.path(0, 'max_model').value).toBe('ZWEIFEL PA18');
      expect(result.data.path(0, 'boeing_max_model').value).toBe('YL-15');
    });

    (databaseName !== 'bigquery' ? it.skip : it)(
      'model: dates named',
      async () => {
        const result = await expressionModel
          .loadQuery(
            `
        query: table('malloytest.alltypes')->{
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

        `
          )
          .run();
        expect(result.data.path(0, 't_date').value).toEqual(
          new Date('2020-03-02')
        );
        expect(result.data.path(0, 't_date_month').value).toEqual(
          new Date('2020-03-01')
        );
        expect(result.data.path(0, 't_date_year').value).toEqual(
          new Date('2020-01-01')
        );
        expect(result.data.path(0, 't_timestamp').value).toEqual(
          new Date('2020-03-02T12:35:56.000Z')
        );
        expect(result.data.path(0, 't_timestamp_second').value).toEqual(
          new Date('2020-03-02T12:35:56.000Z')
        );
        expect(result.data.path(0, 't_timestamp_minute').value).toEqual(
          new Date('2020-03-02T12:35:00.000Z')
        );
        expect(result.data.path(0, 't_timestamp_hour').value).toEqual(
          new Date('2020-03-02T12:00:00.000Z')
        );
        expect(result.data.path(0, 't_timestamp_date').value).toEqual(
          new Date('2020-03-02')
        );
        expect(result.data.path(0, 't_timestamp_month').value).toEqual(
          new Date('2020-03-01')
        );
        expect(result.data.path(0, 't_timestamp_year').value).toEqual(
          new Date('2020-01-01')
        );
      }
    );

    it.skip('defines in model', async () => {
      // const result1 = await model.makeQuery(`
      //   define a is ('malloytest.alltypes');
      //   explore a | reduce x is count(*)
      //   `);
      // const result = await model.makeQuery(`
      //     define a is ('malloytest.alltypes');
      //     explore a | reduce x is count(*)
      //     `);
    });

    it('named query metadata undefined', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft->{
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
        .loadQuery(
          `
        query: aircraft->by_manufacturer
        `
        )
        .run();
      expect(result.resultExplore.name).toBe('by_manufacturer');
    });

    it('named query metadata named head of pipeline', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft->by_manufacturer->{ aggregate: c is count()}
        `
        )
        .run();
      // TODO Same as above -- this test should check the explore name
      // expect(result.getResultExplore().name).toBe(undefined);
      expect(result._queryResult.queryName).toBe(undefined);
    });

    it('filtered explores basic', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        source: b is aircraft{ where: aircraft_models.manufacturer ? ~'B%' }

        query: b->{aggregate: m_count is count(distinct aircraft_models.manufacturer) }
        `
        )
        .run();
      expect(result.data.path(0, 'm_count').value).toBe(63);
    });

    it('query with aliasname used twice', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft->{
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
          project:
            aircraft.aircraft.first_three
            aircraft_count
            order_by: 2 desc, 1
        }
      `
        )
        .run();
      expect(result.data.path(0, 'first_three').value).toBe('SAB');
    });

    it.skip('join foreign_key reverse', async () => {
      const result = await expressionModel
        .loadQuery(
          `
  source: a is table('malloytest.aircraft') {
    primary_key: tail_num
    measure: aircraft_count is count()
  }
  query: table('malloytest.aircraft_models') {
    primary_key: aircraft_model_code
    join_many: a on a.aircraft_model_code

    some_measures is {
      aggregate: am_count is count()
      aggregate: a.aircraft_count
    }
  } -> some_measure
    `
        )
        .run();
      expect(result.data.path(0, 'first_three').value).toBe('SAN');
    });

    it('joined filtered explores', async () => {
      const result = await expressionModel
        .loadQuery(
          `
    source: a_models is table('malloytest.aircraft_models'){
      where: manufacturer ? ~'B%'
      primary_key: aircraft_model_code
      measure:model_count is count()
    }

    source: aircraft2 is table('malloytest.aircraft'){
      join_one: model is a_models with aircraft_model_code
      measure: aircraft_count is count()
    }

    query: aircraft2->{
      aggregate:
        model.model_count
        aircraft_count
    }
        `
        )
        .run();
      expect(result.data.path(0, 'model_count').value).toBe(244);
      expect(result.data.path(0, 'aircraft_count').value).toBe(3599);
    });

    it('joined filtered explores with dependancies', async () => {
      const result = await expressionModel
        .loadQuery(
          `
    source: bo_models is
      from(
          table('malloytest.aircraft_models') {? manufacturer ? ~ 'BO%' }
          -> { project: aircraft_model_code, manufacturer, seats }
        ) {
          primary_key: aircraft_model_code
          measure: bo_count is count()
        }

    source: b_models is
        from(
          table('malloytest.aircraft_models') {? manufacturer ? ~ 'B%' }
          -> { project: aircraft_model_code, manufacturer, seats }
        ) {
          where: bo_models.seats > 200
          primary_key: aircraft_model_code
          measure: b_count is count()
          join_one: bo_models with aircraft_model_code
        }

    source: models is table('malloytest.aircraft_models') {
      join_one: b_models with aircraft_model_code
      measure: model_count is count()
    }

    query: models -> {
      aggregate: model_count
      aggregate: b_models.b_count
      -- aggregate: b_models.bo_models.bo_count
    }
        `
        )
        .run();
      expect(result.data.path(0, 'model_count').value).toBe(60461);
      expect(result.data.path(0, 'b_count').value).toBe(355);
    });

    it('group by explore - simple group by', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft->{
          group_by: aircraft_models
          aggregate: aircraft_count
        }
    `
        )
        .run();
      expect(result.data.path(0, 'aircraft_count').value).toBe(58);
      expect(result.data.path(0, 'aircraft_models_id').value).toBe('7102802');
    });

    it('group by explore - pipeline', async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: aircraft->{
          group_by: aircraft_models
          aggregate: aircraft_count
        } -> {
          group_by: aircraft_models.manufacturer
          aggregate: aircraft_count is aircraft_count.sum()
        }
    `
        )
        .run();
      expect(result.data.path(0, 'aircraft_count').value).toBe(1048);
      expect(result.data.path(0, 'manufacturer').value).toBe('CESSNA');
    });

    it('group by explore - pipeline 2 levels', async () => {
      const result = await expressionModel
        .loadQuery(
          `
      source: f is table('malloytest.flights'){
        join_one: a is table('malloytest.aircraft') {
          join_one: state_facts is table('malloytest.state_facts'){primary_key: state} with state
        } on tail_num = a.tail_num
      }

      query: f-> {
        group_by: a.state_facts
        aggregate: flight_count is count()
      } -> {
        group_by: state_facts.popular_name
        aggregate: flight_count is flight_count.sum()
      }
    `
        )
        .run();
      // console.log(result.data.toObject());
      expect(result.data.path(0, 'flight_count').value).toBe(199726);
      expect(result.data.path(0, 'popular_name').value).toBe('Isabella');
    });
  });

  describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
    const sqlEq = mkSqlEqWith(runtime, {
      malloy: `+ {
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
        await expect(runtime).queryMatches(
          `sql: x is {connection:"${databaseName}" select:"""SELECT 1 as x"""}
        query: from_sql(x) -> {
          project: double_quote is "${back}${dq}"
        }
      `,
          {double_quote: '"'}
        );
      });
      test('quote backslash', async () => {
        expect(await sqlEq(`'${back}${back}'`, back)).isSqlEq();
      });
    });

    test('nullish ?? operator', async () => {
      await expect(runtime).queryMatches(
        `sql: nullTest is { connection: "${databaseName}" select: """
          SELECT '' as null_value, '' as string_value
          UNION ALL SELECT null, 'correct'
      """ }
      query: from_sql(nullTest) -> {
        where: null_value = null
        project:
          found_null is  null_value ?? 'correct',
          else_pass is string_value ?? 'incorrect'
          literal_null is null ?? 'correct'
      }`,
        {found_null: 'correct', else_pass: 'correct', literal_null: 'correct'}
      );
    });

    test('dimension expressions expanded with parens properly', async () => {
      await expect(runtime).queryMatches(
        `
      sql: tbl is { connection: "${databaseName}" select: """SELECT 1 as n"""}
      query: from_sql(tbl) + {
        dimension: fot is (false) or (true)
      } -> {
        project:
          no_paren is false and fot
          paren is    false and (fot)
      }
      `,
        {paren: false, no_paren: false}
      );
    });
  });

  afterAll(async () => {
    await runtimes.closeAll();
  });
};
