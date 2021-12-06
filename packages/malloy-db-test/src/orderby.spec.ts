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
      await runtime.lookupSQLRunner.lookupSQLRunner(databaseName)
    ).runSQL(`WITH test AS(\n${sql}) SELECT 1`);
  } catch (e) {
    console.log(`SQL: didn't compile\n=============\n${sql}`);
    throw e;
  }
  return true;
}

const expressionModels = new Map<string, malloy.ModelMaterializer>();
runtimes.forEach((runtime, databaseName) =>
  expressionModels.set(
    databaseName,
    runtime.loadModel(`
    export define models is ('malloytest.aircraft_models'
    model_count is count()
  )`)
  )
);

expressionModels.forEach((orderByModel, databaseName) => {
  it(`boolean type - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        explore models | reduce
          big is seats >=20
          model_count is count()
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
    expect(result.data.row(0).cell("big").value).toBe(false);
    expect(result.data.row(0).cell("model_count").value).toBe(58500);
  });

  it(`filtered measures in model are aggregates #352 - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        explore models
          j_names is model_count : [manufacturer ~ 'J%']
        | reduce
          j_names
        `
      )
      .run();
    expect(result.data.row(0).cell("j_names").value).toBe(1358);
  });

  it(`reserved words are quoted - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      explore models | reduce
        fetch is count()
      | project
        fetch
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`reserved words are quoted in turtles - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
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
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it.skip("reserved words in structure definitions", async () => {
    const sql = await orderByModel
      .loadQuery(
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
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`aggregate and scalar conditions - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      explore models | reduce
        model_count is count() : [manufacturer: ~'A%']
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it(`modeled having simple - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
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
    expect(result.data.row(0).cell("model_count").value).toBe(102);
  });

  it(`modeled having complex - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
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
    expect(result.data.row(0).cell("model_count").value).toBe(102);
  });

  it(`turtle references joined element - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
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
      .getSQL();
    await validateCompilation(databaseName, sql);
  });
});
