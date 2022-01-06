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

import * as malloy from "@malloy-lang/malloy";
import { RuntimeList } from "./runtimes";

const joinModelText = `
export define aircraft_models is ('malloytest.aircraft_models'
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

export define aircraft is ('malloytest.aircraft'
  primary key tail_num
  aircraft_count is count(*),
)
`;

const runtimes = new RuntimeList([
  "bigquery", //
  // "postgres", //
]);

afterAll(async () => {
  await runtimes.closeAll();
});

const models = new Map<string, malloy.ModelMaterializer>();
runtimes.runtimeMap.forEach((runtime, key) => {
  models.set(key, runtime.loadModel(joinModelText));
});

describe("join expression tests", () => {
  models.forEach((model, database) => {
    it(`model post join - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore aircraft joins aircraft_models on aircraft_model_code | reduce
        aircraft_count,
        aircraft_models.model_count
      `
        )
        .run();
      expect(result.data.value[0].model_count).toBe(1416);
    });

    it(`model: join fact table query - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
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
    `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
    });

    it(`model: explore based on query - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore (
            aircraft_models  | reduce
            m is manufacturer,
            num_models is count(*)
      )  | project
        m,
        num_models
        order by 2 desc
        limit 1
        `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
    });

    it(`model: funnel - merge two queries - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
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
        `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
      expect(result.data.value[0].total_seats).toBe(252771);
    });

    it(`model: modeled funnel - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore (aircraft_models | manufacturer_models)
        joins seats is (aircraft_models | manufacturer_seats)
          on manufacturer
      | project
        manufacturer,
        num_models,
        seats.total_seats,
        order by 2 desc
        limit 1
        `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
      expect(result.data.value[0].total_seats).toBe(252771);
    });

    it(`model: modeled funnel - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore funnel
      | project
        manufacturer,
        num_models,
        seats.total_seats,
        order by 2 desc
        limit 1
        `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
      expect(result.data.value[0].total_seats).toBe(252771);
    });

    it(`model: double_pipe - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore
       (aircraft_models | reduce manufacturer, f is count(*) | reduce f_sum is f.sum())
      | project f_sum2 is f_sum+1
    `
        )
        .run();
      expect(result.data.value[0].f_sum2).toBe(60462);
    });

    it(`model: double_pipe2 - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore pipe | project f_sum2 is f_sum+1
      `
        )
        .run();
      expect(result.data.value[0].f_sum2).toBe(60462);
    });
  });
});
