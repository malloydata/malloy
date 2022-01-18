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

import * as malloy from "@malloydata/malloy";
import { RuntimeList } from "./runtimes";

const joinModelText = `
  explore: aircraft_models is table('malloytest.aircraft_models') {
    primary_key: aircraft_model_code
    measure: model_count is count(*)
    query: manufacturer_models is {
      group_by: manufacturer
      aggregate: num_models is count(*)
    }
    query: manufacturer_seats is {
      group_by: manufacturer
      aggregate: total_seats is seats.sum()
    }
  }

  explore: aircraft is table('malloytest.aircraft'){
    primary_key: tail_num
    measure: aircraft_count is count(*)
  }

  explore: funnel is from(aircraft_models->manufacturer_models) {
    join: seats is from(aircraft_models->manufacturer_seats)
        on manufacturer
  }
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
    it(`model explore refine join - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      explore: a2 is aircraft {
        join: aircraft_models on aircraft_model_code
      }

      query: a2 -> {
        aggregate: [
          aircraft_count
          aircraft_models.model_count
        ]
      }
      `
        )
        .run();
      expect(result.data.value[0].model_count).toBe(1416);
    });

    it(`model explore refine in query join - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      query: aircraft {
        join: aircraft_models on aircraft_model_code
      } -> {
        aggregate: [
          aircraft_count
          aircraft_models.model_count
        ]
      }
      `
        )
        .run();
      expect(result.data.value[0].model_count).toBe(1416);
    });

    it(`model: join fact table query - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      query: aircraft_models {
        join: am_facts is from(
          aircraft_models->{
            group_by: m is manufacturer
            aggregate: num_models is count(*)
          }) on manufacturer
      } -> {
        project: [
          manufacturer
          am_facts.num_models
        ]
        order_by: 2 desc
        limit: 1
      }
    `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
    });

    it(`model: explore based on query - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      query:
          aircraft_models-> {
            group_by: m is manufacturer
            aggregate: num_models is count(*)
          }
      -> {
        project: [
          m
          num_models
        ]
        order_by: 2 desc
        limit: 1
      }
        `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
    });

    it(`model: funnel - merge two queries - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
          query: from(aircraft_models->{
            group_by: m is manufacturer
            aggregate: num_models is count(*)
            }){
            join: seats is from(
              aircraft_models->{
                group_by: m is manufacturer
                aggregate: total_seats is seats.sum()
              }
            ) on m
          }
          -> {
            project: [
              m
              num_models
              seats.total_seats
            ]
            order_by: 2 desc
            limit: 1
          }
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
      explore: foo is from(aircraft_models-> manufacturer_models){
        join: seats is from(aircraft_models->manufacturer_seats)
          on manufacturer
      }
      query: foo-> {
        project: [
          manufacturer,
          num_models,
          seats.total_seats
        ]
        order_by: 2 desc
        limit: 1
      }
        `
        )
        .run();
      expect(result.data.value[0].num_models).toBe(1147);
      expect(result.data.value[0].total_seats).toBe(252771);
    });

    it(`model: modeled funnel2 - ${database}`, async () => {
      const result = await model
        .loadQuery(
          `
      query: funnel->{
        project: [
         manufacturer
          num_models
          seats.total_seats
        ]
        order_by: 2 desc
        limit: 1
      }
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
      query: aircraft_models->{
        group_by: manufacturer
        aggregate: f is count(*)
      }->{
        aggregate: f_sum is f.sum()
      }->{
        project: f_sum2 is f_sum+1
      }
    `
        )
        .run();
      expect(result.data.value[0].f_sum2).toBe(60462);
    });
  });
});
