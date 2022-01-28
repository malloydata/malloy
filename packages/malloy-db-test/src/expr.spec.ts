/* eslint-disable no-console */
/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import * as malloy from "@malloydata/malloy";
import { RuntimeList } from "./runtimes";

const runtimes = new RuntimeList([
  "bigquery", //
  "postgres", //
]);

const expressionModelText = `
explore: aircraft_models is table('malloytest.aircraft_models'){
  primary_key: aircraft_model_code
  measure: [
    airport_count is count(*),
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) {? manufacturer: 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is FLOOR(boeing_seats / total_seats * 100),
  ]
  dimension: seats_bucketed is FLOOR(seats/20)*20.0
}

explore: aircraft is table('malloytest.aircraft'){
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

const expressionModels = new Map<string, malloy.ModelMaterializer>();
runtimes.runtimeMap.forEach((runtime, databaseName) =>
  expressionModels.set(databaseName, runtime.loadModel(expressionModelText))
);

expressionModels.forEach((expressionModel, databaseName) => {
  // basic calculations for sum, filtered sum, without a join.
  it(`basic calculations - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
        query: aircraft_models->{
          aggregate: [
            total_seats,
            total_seats2 is sum(seats),
            boeing_seats,
            boeing_seats2 is sum(seats) {? manufacturer: 'BOEING'},
            boeing_seats3 is total_seats {? manufacturer: 'BOEING'},
            percent_boeing,
            percent_boeing2 is boeing_seats / total_seats * 100,
            -- percent_boeing_floor,
            -- percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
          ]
        }
        `
      )
      .run();
    expect(result.data.path(0, "total_seats").value).toBe(452415);
    expect(result.data.path(0, "total_seats2").value).toBe(452415);
    expect(result.data.path(0, "boeing_seats").value).toBe(252771);
    expect(result.data.path(0, "boeing_seats2").value).toBe(252771);
    expect(result.data.path(0, "boeing_seats3").value).toBe(252771);
    expect(Math.floor(result.data.path(0, "percent_boeing").number.value)).toBe(
      55
    );
    expect(
      Math.floor(result.data.path(0, "percent_boeing2").number.value)
    ).toBe(55);
    // expect(result.data.path(0, "percent_boeing_floor").value).toBe(55);
    // expect(result.data.path(0, "percent_boeing_floor2").value).toBe(55);
  });
  // Floor is broken (doesn't compile because the expression returned isn't an aggregate.)
  it(`Floor() -or any function bustage with aggregates - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
        query: aircraft_models->{
          aggregate: [
            percent_boeing_floor
            percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
          ]
        }
      `
      )
      .run();
    expect(result.data.path(0, "percent_boeing_floor").value).toBe(55);
    expect(result.data.path(0, "percent_boeing_floor2").value).toBe(55);
  });

  // Model based version of sums.
  it(`model: expression fixups. - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
            query: aircraft->{
              aggregate: [
                aircraft_models.total_seats
                aircraft_models.boeing_seats
              ]
            }
          `
      )
      .run();
    expect(result.data.path(0, "total_seats").value).toBe(18294);
    expect(result.data.path(0, "boeing_seats").value).toBe(6244);
  });

  // turtle expressions
  it(`model: turtle - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
          query: aircraft->by_manufacturer
          `
      )
      .run();
    expect(result.data.path(0, "manufacturer").value).toBe("CESSNA");
  });

  // filtered turtle expressions
  it(`model: filtered turtle - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
          query: aircraft->{
            nest: b is by_manufacturer{? aircraft_models.manufacturer:~'B%'}
          }
        `
      )
      .run();
    expect(result.data.path(0, "b", 0, "manufacturer").value).toBe("BEECH");
  });

  // having.
  it(`model: simple having - ${databaseName}`, async () => {
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
    expect(result.data.path(0, "aircraft_count").value).toBe(91);
  });

  it(`model: turtle having2 - ${databaseName}`, async () => {
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
    expect(result.data.path(0, "by_state", 0, "state").value).toBe("VA");
  });

  it(`model: turtle having on main - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
      query: aircraft->{
        order_by: 2 asc
        having: aircraft_count: >500
        group_by: region
        aggregate: aircraft_count
        nest: by_state is {
          order_by: 2 asc
          having: aircraft_count >45
          group_by: state
          aggregate: aircraft_count
          nest: by_city is {
            order_by: 2 asc
            having: aircraft_count: >5
            group_by: city
            aggregate: aircraft_count
          }
        }
      }
        `
      )
      .run();
    expect(result.data.path(0, "by_state", 0, "by_city", 0, "city").value).toBe(
      "ALBUQUERQUE"
    );
  });

  // bigquery doesn't like to partition by floats,
  it(`model: having float group by partition - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
      query: aircraft_models->{
        order_by: 1
        having: [seats_bucketed > 0, aircraft_model_count > 400]
        group_by: seats_bucketed
        aggregate: aircraft_model_count
        nest: foo is {
          group_by: engines
          aggregate: aircraft_model_count
        }
      }
      `
      )
      .run();
    expect(result.data.path(0, "aircraft_model_count").value).toBe(448);
  });

  it(`model: aggregate functions distinct min max - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
        query: aircraft_models->{
          aggregate: [
            distinct_seats is count(distinct seats),
            boeing_distinct_seats is count(distinct seats) {?manufacturer: 'BOEING'},
            min_seats is min(seats),
            cessna_min_seats is min(seats) {? manufacturer: 'CESSNA'},
            max_seats is max(seats),
            cessna_max_seats is max(seats) {? manufacturer: 'CESSNA'},
            min_code is min(aircraft_model_code),
            boeing_min_model is min(model) {? manufacturer: 'BOEING'},
            max_model is max(model),
            boeing_max_model is max(model) {? manufacturer: 'BOEING'},
          ]
        }
        `
      )
      .run();
    expect(result.data.path(0, "distinct_seats").value).toBe(187);
    expect(result.data.path(0, "boeing_distinct_seats").value).toBe(85);
    expect(result.data.path(0, "min_seats").value).toBe(0);
    expect(result.data.path(0, "cessna_min_seats").value).toBe(1);
    expect(result.data.path(0, "max_seats").value).toBe(660);
    expect(result.data.path(0, "min_code").value).toBe("0030109");
    expect(result.data.path(0, "cessna_max_seats").value).toBe(14);
    expect(result.data.path(0, "boeing_min_model").value).toBe("100");
    expect(result.data.path(0, "max_model").value).toBe("ZWEIFEL PA18");
    expect(result.data.path(0, "boeing_max_model").value).toBe("YL-15");
  });

  (databaseName === "postgres" ? it.skip : it)(
    `model: dates - ${databaseName}`,
    async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: table('malloytest.alltypes')->{
          group_by: [
            t_date,
            t_date.\`month\`,
            t_date.\`year\`,
            t_date.day_of_month,
            t_date.day_of_year,
            t_timestamp,
            t_timestamp.\`date\`,
            t_timestamp.\`hour\`,
            t_timestamp.\`minute\`,
            t_timestamp.\`second\`,
            t_timestamp.\`month\`,
            t_timestamp.\`year\`,
            t_timestamp.day_of_month,
            t_timestamp.day_of_year,
          ]
        }

        `
        )
        .run();
      expect(result.data.path(0, "t_date").value).toEqual(
        new Date("2020-03-02")
      );
      expect(result.data.path(0, "t_date_month").value).toEqual(
        new Date("2020-03-01")
      );
      expect(result.data.path(0, "t_date_year").value).toEqual(
        new Date("2020-01-01")
      );
      expect(result.data.path(0, "t_date_day_of_year").value).toEqual(62);
      expect(result.data.path(0, "t_date_day_of_month").value).toEqual(2);
      expect(result.data.path(0, "t_timestamp").value).toEqual(
        new Date("2020-03-02T12:35:56.000Z")
      );
      expect(result.data.path(0, "t_timestamp_second").value).toEqual(
        new Date("2020-03-02T12:35:56.000Z")
      );
      expect(result.data.path(0, "t_timestamp_minute").value).toEqual(
        new Date("2020-03-02T12:35:00.000Z")
      );
      expect(result.data.path(0, "t_timestamp_hour").value).toEqual(
        new Date("2020-03-02T12:00:00.000Z")
      );
      expect(result.data.path(0, "t_timestamp_date").value).toEqual(
        new Date("2020-03-02")
      );
      expect(result.data.path(0, "t_timestamp_month").value).toEqual(
        new Date("2020-03-01")
      );
      expect(result.data.path(0, "t_timestamp_year").value).toEqual(
        new Date("2020-01-01")
      );
      expect(result.data.path(0, "t_timestamp_day_of_year").value).toEqual(62);
      expect(result.data.path(0, "t_timestamp_day_of_month").value).toEqual(2);
    }
  );

  (databaseName === "postgres" ? it.skip : it)(
    `model: dates named - ${databaseName}`,
    async () => {
      const result = await expressionModel
        .loadQuery(
          `
        query: table('malloytest.alltypes')->{
          group_by: [
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
          ]
        }

        `
        )
        .run();
      expect(result.data.path(0, "t_date").value).toEqual(
        new Date("2020-03-02")
      );
      expect(result.data.path(0, "t_date_month").value).toEqual(
        new Date("2020-03-01")
      );
      expect(result.data.path(0, "t_date_year").value).toEqual(
        new Date("2020-01-01")
      );
      expect(result.data.path(0, "t_timestamp").value).toEqual(
        new Date("2020-03-02T12:35:56.000Z")
      );
      expect(result.data.path(0, "t_timestamp_second").value).toEqual(
        new Date("2020-03-02T12:35:56.000Z")
      );
      expect(result.data.path(0, "t_timestamp_minute").value).toEqual(
        new Date("2020-03-02T12:35:00.000Z")
      );
      expect(result.data.path(0, "t_timestamp_hour").value).toEqual(
        new Date("2020-03-02T12:00:00.000Z")
      );
      expect(result.data.path(0, "t_timestamp_date").value).toEqual(
        new Date("2020-03-02")
      );
      expect(result.data.path(0, "t_timestamp_month").value).toEqual(
        new Date("2020-03-01")
      );
      expect(result.data.path(0, "t_timestamp_year").value).toEqual(
        new Date("2020-01-01")
      );
    }
  );

  it.skip("defines in model", async () => {
    // const result1 = await model.makeQuery(`
    //   define a is ('malloytest.alltypes');
    //   explore a | reduce x is count(*)
    //   `);
    // const result = await model.makeQuery(`
    //     define a is ('malloytest.alltypes');
    //     explore a | reduce x is count(*)
    //     `);
  });

  it(`named query metadata undefined - ${databaseName}`, async () => {
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

  it(`named query metadata named - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
        query: aircraft->by_manufacturer
        `
      )
      .run();
    expect(result.resultExplore.name).toBe("by_manufacturer");
  });

  it(`named query metadata named head of pipeline - ${databaseName}`, async () => {
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

  it(`filtered explores basic - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
        explore: b is aircraft{ where: aircraft_models.manufacturer: ~'B%' }

        query: b->{aggregate: m_count is count(distinct aircraft_models.manufacturer) }
        `
      )
      .run();
    expect(result.data.path(0, "m_count").value).toBe(63);
  });

  it(`query with aliasname used twice - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
        query: aircraft->{
          group_by: first is substring(city,1,1)
          aggregate: aircraft_count is count()
          nest: aircraft is {
            group_by: first_two is substring(city,1,2)
            aggregate: aircraft_count is count()
            nest: aircraft is {
              group_by: first_three is substring(city,1,3)
              aggregate: aircraft_count is count()
            }
          }
        } -> {
          project: [
            aircraft.aircraft.first_three
            aircraft_count
          ]
        }
      `
      )
      .run();
    expect(result.data.path(0, "first_three").value).toBe("SAN");
  });

  it.skip("join foreign_key reverse", async () => {
    const result = await expressionModel
      .loadQuery(
        `
  explore: a is table('malloytest.aircraft') {
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
    expect(result.data.path(0, "first_three").value).toBe("SAN");
  });

  it(`joined filtered explores - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
    explore: a_models is table('malloytest.aircraft_models'){
      where: manufacturer: ~'B%'
      primary_key: aircraft_model_code
      measure:model_count is count()
    }

    explore: aircraft2 is table('malloytest.aircraft'){
      join_one: model is a_models with aircraft_model_code
      measure: aircraft_count is count()
    }

    query: aircraft2->{
      aggregate: [
        model.model_count
        aircraft_count
      ]
    }
        `
      )
      .run();
    expect(result.data.path(0, "model_count").value).toBe(244);
    expect(result.data.path(0, "aircraft_count").value).toBe(3599);
  });

  it(`joined filtered explores with dependancies - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
    explore: bo_models is
      from(
          table('malloytest.aircraft_models') {? manufacturer: ~ 'BO%' }
          -> { project: [ aircraft_model_code, manufacturer, seats ] }
        ) {
          primary_key: aircraft_model_code
          measure: bo_count is count()
        }

    explore: b_models is
        from(
          table('malloytest.aircraft_models') {? manufacturer: ~ 'B%' }
          -> { project: [ aircraft_model_code, manufacturer, seats ] }
        ) {
          where: bo_models.seats > 200
          primary_key: aircraft_model_code
          measure: b_count is count()
          join_one: bo_models with aircraft_model_code
        }

    explore: models is table('malloytest.aircraft_models') {
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
    expect(result.data.path(0, "model_count").value).toBe(60461);
    expect(result.data.path(0, "b_count").value).toBe(355);
  });

  it(`group by explore - simple group by - ${databaseName}`, async () => {
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
    expect(result.data.path(0, "aircraft_count").value).toBe(58);
    expect(result.data.path(0, "aircraft_models_id").value).toBe("7102802");
  });

  it(`group by explore - pipeline - ${databaseName}`, async () => {
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
    expect(result.data.path(0, "aircraft_count").value).toBe(1048);
    expect(result.data.path(0, "manufacturer").value).toBe("CESSNA");
  });

  it(`group by explore - pipeline 2 levels - ${databaseName}`, async () => {
    const result = await expressionModel
      .loadQuery(
        `
      explore: f is table('malloytest.flights'){
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
    expect(result.data.path(0, "flight_count").value).toBe(199726);
    expect(result.data.path(0, "popular_name").value).toBe("Isabella");
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
