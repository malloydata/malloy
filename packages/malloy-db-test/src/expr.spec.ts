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

import * as malloy from "@malloy-lang/malloy";
import { getRuntimes, rows } from "./runtimes";

const runtimes = getRuntimes(["bigquery"]);
// const runtimes = getRuntimes();

const expressionModelText = `
export define aircraft_models is (explore 'malloytest.aircraft_models'
  primary key aircraft_model_code
  airport_count is count(*),
  aircraft_model_count is count(),
  total_seats is sum(seats),
  boeing_seats is sum(seats) : [manufacturer: 'BOEING'],
  percent_boeing is boeing_seats / total_seats * 100,
  percent_boeing_floor is FLOOR(boeing_seats / total_seats * 100),
  seats_bucketed is FLOOR(seats/20)*20.0,
);

export define aircraft is (
  explore 'malloytest.aircraft'
  primary key tail_num
  aircraft_count is count(*),
  by_manufacturer is (reduce top 5
    aircraft_models.manufacturer,
    aircraft_count
  )

  joins
    aircraft_models on aircraft_model_code
);
`;

const expressionModels = new Map<string, malloy.RuntimeModelMaterializer>();
runtimes.forEach((runtime, databaseName) =>
  expressionModels.set(
    databaseName,
    runtime.createModelMaterializer(expressionModelText)
  )
);

expressionModels.forEach((expressionModel, databaseName) => {
  // basic calculations for sum, filtered sum, without a join.
  it(`basic calculations - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        explore aircraft_models | reduce
          total_seats,
          total_seats2 is sum(seats),
          boeing_seats,
          boeing_seats2 is sum(seats) : [manufacturer: 'BOEING'],
          boeing_seats3 is total_seats : [manufacturer: 'BOEING'],
          percent_boeing,
          percent_boeing2 is boeing_seats / total_seats * 100,
          -- percent_boeing_floor,
          -- percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
      `
      )
      .run();
    // console.log(JSON.stringify(result.getData().toObject(), undefined, 2));
    // console.log(result.sql);
    expect(result.getData().toObject()[0].total_seats).toBe(452415);
    expect(result.getData().toObject()[0].total_seats2).toBe(452415);
    expect(result.getData().toObject()[0].boeing_seats).toBe(252771);
    expect(result.getData().toObject()[0].boeing_seats2).toBe(252771);
    expect(result.getData().toObject()[0].boeing_seats3).toBe(252771);
    expect(
      Math.floor(result.getData().toObject()[0].percent_boeing as number)
    ).toBe(55);
    expect(
      Math.floor(result.getData().toObject()[0].percent_boeing2 as number)
    ).toBe(55);
    // expect(result.getData().toObject()[0].percent_boeing_floor).toBe(55);
    // expect(result.getData().toObject()[0].percent_boeing_floor2).toBe(55);
  });
  // Floor is broken (doesn't compile because the expression returned isn't an aggregate.)
  it(`Floor() -or any function bustage with aggregates - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        explore aircraft_models | reduce
          percent_boeing_floor,
          percent_boeing_floor2 is FLOOR(boeing_seats / total_seats * 100)
      `
      )
      .run();
    expect(result.getData().toObject()[0].percent_boeing_floor).toBe(55);
    expect(result.getData().toObject()[0].percent_boeing_floor2).toBe(55);
  });

  // BROKEN:
  // Model based version of sums.
  it(`model: expression fixups. - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
            explore aircraft | reduce
              aircraft_models.total_seats,
              aircraft_models.boeing_seats
          `
      )
      .run();
    expect(result.getData().toObject()[0].total_seats).toBe(18294);
    expect(result.getData().toObject()[0].boeing_seats).toBe(6244);
  });

  // turtle expressions
  it(`model: turtle - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
            explore aircraft | reduce
              by_manufacturer
          `
      )
      .run();
    expect(rows(result)[0].by_manufacturer[0].manufacturer).toBe("CESSNA");
  });

  // filtered turtle expressions
  it(`model: filtered turtle - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
              explore aircraft | reduce
                b is by_manufacturer : [aircraft_models.manufacturer:~'B%']
            `
      )
      .run();
    expect(rows(result)[0].b[0].manufacturer).toBe("BEECH");
  });

  // having.
  it(`model: simple having - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
          explore aircraft | reduce : [aircraft_count: >90 ]
            state,
            aircraft_count
            order by 2
          `
      )
      .run();
    expect(result.getData().toObject()[0].aircraft_count).toBe(91);
  });

  it(`model: turtle having2 - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
      -- hacking a null test for now
      explore aircraft
      | reduce top 10 order by 1: [region != NULL]
          region,
          by_state is (reduce top 10 order by 1 desc : [aircraft_count: >50]
            state,
            aircraft_count
          )
        `
      )
      .run();
    // console.log(result.sql);
    // console.log(JSON.stringify(result.getData().toObject(), undefined, 2));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.getData().toObject()[0] as any).by_state[0].state).toBe(
      "VA"
    );
  });

  it(`model: turtle having on main - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
      -- hacking a null test for now
      explore aircraft
      | reduce order by 2 asc: [aircraft_count: >500]
          region
          aircraft_count
          by_state is (reduce  order by 2 asc : [aircraft_count: >45]
            state,
            aircraft_count
            by_city is (reduce  order by 2 asc : [aircraft_count: >5 ]
              city,
              aircraft_count
            )
          )
        `
      )
      .run();
    // console.log(result.sql);
    // console.log(pretty(result.getData().toObject()));
    expect(rows(result)[0].by_state[0].by_city[0].city).toBe("ALBUQUERQUE");
  });

  // bigquery doesn't like to partition by floats,
  it(`model: having float group by partition - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
    -- hacking a null test for now
    explore aircraft_models
    | reduce order by 1 : [seats_bucketed > 0, aircraft_model_count > 400]
        seats_bucketed
        aircraft_model_count
        foo is (reduce
          engines
          aircraft_model_count
        )
      `
      )
      .run();
    // console.log(result.sql);
    // console.log(result.getData().toObject());
    expect(result.getData().toObject()[0].aircraft_model_count).toBe(448);
  });

  it(`model: aggregate functions distinct min max - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        explore aircraft_models | reduce
          distinct_seats is count(distinct seats),
          boeing_distinct_seats is count(distinct seats) : [manufacturer: 'BOEING'],
          min_seats is min(seats),
          cessna_min_seats is min(seats) : [manufacturer: 'CESSNA'],
          max_seats is max(seats),
          cessna_max_seats is max(seats) : [manufacturer: 'CESSNA'],
          min_model is min(model),
          boeing_min_model is min(model) : [manufacturer: 'BOEING'],
          max_model is max(model),
          boeing_max_model is max(model) : [manufacturer: 'BOEING'],
        `
      )
      .run();
    expect(result.getData().toObject()[0].distinct_seats).toBe(187);
    expect(result.getData().toObject()[0].boeing_distinct_seats).toBe(85);
    expect(result.getData().toObject()[0].min_seats).toBe(0);
    expect(result.getData().toObject()[0].cessna_min_seats).toBe(1);
    expect(result.getData().toObject()[0].max_seats).toBe(660);
    expect(result.getData().toObject()[0].cessna_max_seats).toBe(14);
    expect(result.getData().toObject()[0].min_model).toBe(" SEAREY");
    expect(result.getData().toObject()[0].boeing_min_model).toBe("100");
    expect(result.getData().toObject()[0].max_model).toBe("ZWEIFEL PA18");
    expect(result.getData().toObject()[0].boeing_max_model).toBe("YL-15");
  });

  it(`model: dates - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        explore 'malloytest.alltypes' | reduce
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

        `
      )
      .run();
    expect(rows(result)[0].t_date.value).toBe("2020-03-02");
    expect(rows(result)[0].t_date_month.value).toBe("2020-03-01");
    expect(rows(result)[0].t_date_year.value).toBe("2020-01-01");
    expect(rows(result)[0].t_date_day_of_year).toBe(62);
    expect(rows(result)[0].t_date_day_of_month).toBe(2);
    expect(rows(result)[0].t_timestamp.value).toBe("2020-03-02T12:35:56.000Z");
    expect(rows(result)[0].t_timestamp_second.value).toBe(
      "2020-03-02T12:35:56.000Z"
    );
    expect(rows(result)[0].t_timestamp_minute.value).toBe(
      "2020-03-02T12:35:00.000Z"
    );
    expect(rows(result)[0].t_timestamp_hour.value).toBe(
      "2020-03-02T12:00:00.000Z"
    );
    expect(rows(result)[0].t_timestamp_date.value).toBe("2020-03-02");
    expect(rows(result)[0].t_timestamp_month.value).toBe("2020-03-01");
    expect(rows(result)[0].t_timestamp_year.value).toBe("2020-01-01");
    expect(rows(result)[0].t_timestamp_day_of_year).toBe(62);
    expect(rows(result)[0].t_timestamp_day_of_month).toBe(2);
  });

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
      .createQueryMaterializer(
        `
        explore aircraft| reduce
          aircraft_count is count()
        `
      )
      .run();
    // TODO The result explore should really be unnamed. This test currently
    //      inspects inner information because we have no way to have unnamed
    //       explores today.
    // expect(result.getResultExplore().getName()).toBe(undefined);
    expect(result._getQueryResult().queryName).toBe(undefined);
  });

  it(`named query metadata named - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        explore aircraft | by_manufacturer
        `
      )
      .run();
    expect(result.getResultExplore().getName()).toBe("by_manufacturer");
  });

  it(`named query metadata named head of pipeline - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        explore aircraft | by_manufacturer | reduce c is count()
        `
      )
      .run();
    // TODO Same as above -- this test should check the explore name
    // expect(result.getResultExplore().getName()).toBe(undefined);
    expect(result._getQueryResult().queryName).toBe(undefined);
  });

  it(`filtered explores - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
        define b is (explore aircraft : [aircraft_models.manufacturer: ~'B%']);

        explore b | reduce m_count is count(distinct aircraft_models.manufacturer);
        `
      )
      .run();
    expect(rows(result)[0].m_count).toBe(63);
  });

  it(`query with aliasname used twice - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
aircraft | reduce
first is substring(city,1,1)
aircraft_count is count()
aircraft is (reduce
  first_two is substring(city,1,2)
  aircraft_count is count()
  aircraft is (reduce
    first_three is substring(city,1,3)
    aircraft_count is count()
  )
)
| project
aircraft.aircraft.first_three
aircraft_count
    `
      )
      .run();
    expect(rows(result)[0].first_three).toBe("SAN");
  });

  it.skip("join foreign_key reverse", async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
  define a is('malloytest.aircraft'
    primary key tail_num
    aircraft_count is count()
  );
  export define am is ('malloytest.aircraft_models'
    primary key aircraft_model_code
    a is join on a.aircraft_model_code

    some_measures is (reduce
      am_count is count()
      a.aircraft_count
    )
  );
  am | some_measures
    `
      )
      .run();
    expect(rows(result)[0].first_three).toBe("SAN");
  });

  it(`joined filtered explores - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
    define a_models is (explore 'malloytest.aircraft_models'
    : [manufacturer: ~'B%']
    primary key aircraft_model_code
    model_count is count()
  )

    define aircraft2 is (explore 'malloytest.aircraft'
    model is join a_models on aircraft_model_code
    aircraft_count is count()
  )

    explore aircraft2 | reduce
      model.model_count
      aircraft_count
        `
      )
      .run();
    // console.log(result.sql);
    expect(rows(result)[0].model_count).toBe(244);
    expect(rows(result)[0].aircraft_count).toBe(3599);
  });

  it(`joined filtered explores with dependancies - ${databaseName}`, async () => {
    const result = await expressionModel
      .createQueryMaterializer(
        `
    define bo_models is (
      (explore 'malloytest.aircraft_models'
        : [manufacturer: ~ 'BO%']
      | project
        aircraft_model_code
        manufacturer
        seats
      )
      primary key aircraft_model_code
      bo_count is count()
    );

    define b_models is (
      (explore 'malloytest.aircraft_models'
        : [manufacturer: ~ 'B%']
      | project
        aircraft_model_code
        manufacturer
        seats
      ) : [bo_models.seats > 200]
      primary key aircraft_model_code
      b_count is count()
      bo_models is join on aircraft_model_code
    );

    define models is (explore 'malloytest.aircraft_models'
      b_models is join on aircraft_model_code
      model_count is count()
    )

    explore models | reduce
      model_count
      b_models.b_count
      -- b_models.bo_models.bo_count
        `
      )
      .run();
    expect(result.getData().toObject()[0].model_count).toBe(60461);
    expect(rows(result)[0].b_count).toBe(355);
  });
});
