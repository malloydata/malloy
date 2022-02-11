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

import * as malloy from "@malloydata/malloy";
import { RuntimeList } from "./runtimes";

const runtimes = new RuntimeList([
  "bigquery", //
  "postgres", //
]);

afterAll(async () => {
  await runtimes.closeAll();
});

async function validateCompilation(
  databaseName: string,
  sql: string
): Promise<boolean> {
  try {
    const runtime = runtimes.runtimeMap.get(databaseName);
    if (runtime === undefined) {
      throw new Error(`Unknown database ${databaseName}`);
    }
    await (
      await runtime.connections.lookupConnection(databaseName)
    ).runSQL(`WITH test AS(\n${sql}) SELECT 1`);
  } catch (e) {
    console.log(`SQL: didn't compile\n=============\n${sql}`);
    throw e;
  }
  return true;
}

const expressionModels = new Map<string, malloy.ModelMaterializer>();
runtimes.runtimeMap.forEach((runtime, databaseName) =>
  expressionModels.set(
    databaseName,
    runtime.loadModel(`
    explore: models is table('malloytest.aircraft_models'){
      measure: model_count is count()
    }
  `)
  )
);

expressionModels.forEach((orderByModel, databaseName) => {
  it(`boolean type - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        query: models-> {
          group_by: big is seats >=20
          aggregate: model_count is count()
        }
        `
      )
      .run();
    expect(result.data.row(0).cell("big").value).toBe(false);
    expect(result.data.row(0).cell("model_count").value).toBe(58451);
  });

  it(`boolean in pipeline - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        query: models->{
          group_by: [
            manufacturer,
            big is seats >=21
          ]
          aggregate: model_count is count()
        }->{
          group_by: big
          aggregate: model_count is model_count.sum()
        }
        `
      )
      .run();
    expect(result.data.row(0).cell("big").value).toBe(false);
    expect(result.data.row(0).cell("model_count").value).toBe(58500);
  });

  it(`filtered measures in model are aggregates #352 - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        query: models->{
          aggregate: j_names is model_count {where: manufacturer ~ 'J%'}
        }
        -> {
          group_by: j_names
        }
        `
      )
      .run();
    expect(result.data.row(0).cell("j_names").value).toBe(1358);
  });

  it(`reserved words are quoted - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      query: models->{
        aggregate: fetch is count()
      }->{
        group_by: fetch
      }
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`reserved words are quoted in turtles - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      query: models->{
        nest: withx is {
          group_by: select is UPPER(manufacturer)
          aggregate: fetch is count()
        }
      } -> {
        project: [
          withxz is lower(withx.select)
          fetch is withx.fetch
        ]
      }
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it.skip("reserved words in structure definitions", async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      query: models->{
        nest: withx is {
          group_by: is select is UPPER(manufacturer)
          aggregate: fetch is count()
        }
      } -> {
        project: withxis lower(withx.select)
        project: fetch is with.fetch
      }
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`aggregate and scalar conditions - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      query: models->{
        aggregate: model_count is count(){? manufacturer: ~'A%' }
      }
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  // I'm not sure I have the syntax right here...
  it(`modeled having simple - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        explore: popular_names is from(models->{
          where: model_count > 100
          group_by: manufacturer
          aggregate: model_count
        })

        query: popular_names->{
          order_by: 2
          project: [manufacturer, model_count]
        }
        `
      )
      .run();
    expect(result.data.row(0).cell("model_count").value).toBe(102);
  });

  it(`modeled having complex - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        explore: popular_names is from(models->{
          where: model_count > 100
          group_by: manufacturer
          aggregate: model_count
          nest: l is {
            top: 5
            group_by: manufacturer
            aggregate: model_count
          }
        })

        query: popular_names->{
         order_by: 2
         project: [manufacturer, model_count]
        }
        `
      )
      .run();
    expect(result.data.row(0).cell("model_count").value).toBe(102);
  });

  it(`turtle references joined element - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
    explore: a is table('malloytest.aircraft'){
      primary_key: tail_num
      measure: aircraft_count is count(*)
    }

    explore: f is table('malloytest.flights'){
      primary_key: id2
      join_one: a with tail_num

      measure: flight_count is count()
      query: foo is {
        group_by: carrier
        aggregate: flight_count
        aggregate: a.aircraft_count
      }
    }
    query: f->foo
  `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });
});
