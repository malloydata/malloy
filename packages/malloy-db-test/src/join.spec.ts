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
/* eslint-disable no-console */

import { Malloy, QueryModel } from "@malloy-lang/malloy";
import { BigQueryConnection } from "@malloy-lang/malloy-db-bigquery";

Malloy.db = new BigQueryConnection("test");

const joinModelText = `
export define aircraft_models is ('lookerdata.liquor.aircraft_models'
  primary key aircraft_model_code
  model_count is count(*),
  manufacturer_models is (reduce
    manufacturer,
    num_models is count(*)
  ),
  manufacturer_seats is (reduce
    manufacturer,
    total_seats is seats.sum()
  )
);

export define funnel is (
  (aircraft_models | manufacturer_models)
  joins seats is (aircraft_models | manufacturer_seats)
      on manufacturer
);

export define pipe is (aircraft_models
  | reduce manufacturer, f is count(*)
  | reduce f_sum is f.sum());

export define aircraft is ('lookerdata.liquor.aircraft'
  primary key tail_num
  aircraft_count is count(*),
)
`;

describe("expression tests", () => {
  let model: QueryModel;
  beforeAll(async () => {
    model = new QueryModel(undefined);
    await model.parseModel(joinModelText);
  });

  it("model post join", async () => {
    const result = await model.runQuery(`
      explore aircraft joins aircraft_models on aircraft_model_code | reduce
        aircraft_count,
        aircraft_models.model_count
    `);
    expect(result.result[0].model_count).toBe(46953);
  });

  it("model: join fact table query", async () => {
    const result = await model.runQuery(`
      explore aircraft_models
        joins am_facts is (
          aircraft_models  | reduce
            m is manufacturer,
            num_models is count(*)
      )  on manufacturer | project
        manufacturer,
        am_facts.num_models
        order by 2 desc
        limit 1
    `);
    expect(result.result[0].num_models).toBe(1147);
  });

  it("model: explore based on query", async () => {
    const result = await model.runQuery(`
      explore (
            aircraft_models  | reduce
            m is manufacturer,
            num_models is count(*)
      )  | project
        m,
        num_models
        order by 2 desc
        limit 1
    `);
    expect(result.result[0].num_models).toBe(1147);
  });

  it("model: funnel - merge two queries", async () => {
    const result = await model.runQuery(`
      explore (
          aircraft_models  | reduce
            m is manufacturer,
            num_models is count(*)
        )
        joins seats is (
          aircraft_models  | reduce
          m is manufacturer,
          total_seats is seats.sum()
        ) on m
      | project
        m,
        num_models,
        seats.total_seats,
        order by 2 desc
        limit 1
    `);
    expect(result.result[0].num_models).toBe(1147);
    expect(result.result[0].total_seats).toBe(252771);
  });

  it("model: modeled funnel", async () => {
    const result = await model.runQuery(`
      explore (aircraft_models | manufacturer_models)
        joins seats is (aircraft_models | manufacturer_seats)
          on manufacturer
      | project
        manufacturer,
        num_models,
        seats.total_seats,
        order by 2 desc
        limit 1
    `);
    expect(result.result[0].num_models).toBe(1147);
    expect(result.result[0].total_seats).toBe(252771);
  });

  it("model: modeled funnel", async () => {
    const result = await model.runQuery(`
      explore funnel
      | project
        manufacturer,
        num_models,
        seats.total_seats,
        order by 2 desc
        limit 1
    `);
    expect(result.result[0].num_models).toBe(1147);
    expect(result.result[0].total_seats).toBe(252771);
  });

  it("model: double_pipe", async () => {
    const result = await model.runQuery(`
      explore
       (aircraft_models | reduce manufacturer, f is count(*) | reduce f_sum is f.sum())
      | project f_sum2 is f_sum+1
    `);
    expect(result.result[0].f_sum2).toBe(60462);
  });

  it("model: double_pipe2", async () => {
    const result = await model.runQuery(`
      explore pipe | project f_sum2 is f_sum+1
    `);
    expect(result.result[0].f_sum2).toBe(60462);
  });
});
