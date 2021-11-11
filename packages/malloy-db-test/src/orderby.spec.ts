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

import { rows } from "./runtimes";
import * as malloy from "@malloy-lang/malloy";
import { getRuntimes } from "./runtimes";

const runtimes = getRuntimes();

async function validateCompilation(
  databaseName: string,
  sql: string
): Promise<boolean> {
  try {
    const runtime = runtimes.get(databaseName);
    if (runtime === undefined) {
      throw new Error(`Unknown database ${databaseName}`);
    }
    await (
      await runtime.getRunner().getSQLRunner(databaseName)
    ).runSQL(`WITH test AS(\n${sql}) SELECT 1`);
  } catch (e) {
    console.log(`SQL: didn't compile\n=============\n${sql}`);
    throw e;
  }
  return true;
}

const expressionModels = new Map<string, malloy.ModelRuntimeRequest>();
runtimes.forEach((runtime, databaseName) =>
  expressionModels.set(
    databaseName,
    runtime.makeModel(`
    export define models is ('malloytest.aircraft_models'
    model_count is count()
  )`)
  )
);

expressionModels.forEach((orderByModel, databaseName) => {
  it(`boolean type - ${databaseName}`, async () => {
    const result = await orderByModel
      .makeQuery(
        `
        explore models | reduce
          big is seats >=20
          model_count is count()
        `
      )
      .run();
    expect(rows(result)[0].big).toBe(false);
    expect(rows(result)[0].model_count).toBe(58451);
  });

  it(`boolean in pipeline - ${databaseName}`, async () => {
    const result = await orderByModel
      .makeQuery(
        `
        explore models | reduce
          manufacturer
          big is seats >=21
          model_count is count()
        | reduce
          big
          model_count is model_count.sum()
        `
      )
      .run();
    expect(rows(result)[0].big).toBe(false);
    expect(rows(result)[0].model_count).toBe(58500);
  });

  it(`filtered measures in model are aggregates #352 - ${databaseName}`, async () => {
    const result = await orderByModel
      .makeQuery(
        `
        explore models
          j_names is model_count : [manufacturer ~ 'J%']
        | reduce
          j_names
        `
      )
      .run();
    expect(rows(result)[0].j_names).toBe(1358);
  });

  it(`reserved words are quoted - ${databaseName}`, async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          fetch is count()
        | project
          fetch
        `
        )
        .getSQL()
        .build()
    ).getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`reserved words are quoted in turtles - ${databaseName}`, async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          withx is (reduce
             select is UPPER(manufacturer)
             fetch is count()
          )
        | project
          withx is lower(withx.select)
          fetch is withx.fetch
        `
        )
        .getSQL()
        .build()
    ).getSQL();
    await validateCompilation(databaseName, sql);
  });

  it.skip("reserved words in structure definitions", async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          with is (reduce
             select is UPPER(manufacturer)
             fetch is count()
          )
        | project
          withxis lower(withx.select)
          fetch is with.fetch
        `
        )
        .getSQL()
        .build()
    ).getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`aggregate and scalar conditions - ${databaseName}`, async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
        explore models | reduce
          model_count is count() : [manufacturer: ~'A%']
        `
        )
        .getSQL()
        .build()
    ).getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`modeled having simple - ${databaseName}`, async () => {
    const result = await orderByModel
      .makeQuery(
        `
        define popular_names is (models
          | reduce : [model_count > 100]
            manufacturer
            model_count
        );
        popular_names | project order by 2
         manufacturer
         model_count
        `
      )
      .run();
    expect(rows(result)[0].model_count).toBe(102);
  });

  it(`modeled having complex - ${databaseName}`, async () => {
    const result = await orderByModel
      .makeQuery(
        `
        define popular_names is (models
          | reduce : [model_count > 100]
            manufacturer
            model_count
            l is (reduce top 5
              manufacturer
              model_count
            )
        );
        popular_names | project order by 2
         manufacturer
         model_count
        `
      )
      .run();
    expect(rows(result)[0].model_count).toBe(102);
  });

  it(`turtle references joined element - ${databaseName}`, async () => {
    const sql = (
      await orderByModel
        .makeQuery(
          `
      define a is ('malloytest.aircraft'
        primary key tail_num
        aircraft_count is count(*)
      );

      define f is ('malloytest.flights'
        primary key id2
        flight_count is count()
        foo is (reduce
          carrier
          flight_count
          a.aircraft_count
        )
        joins
          a on tail_num
      );
      explore f | foo
    `
        )
        .getSQL()
        .build()
    ).getSQL();
    await validateCompilation(databaseName, sql);
  });
});
