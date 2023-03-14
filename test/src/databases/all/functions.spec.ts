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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import * as malloy from '@malloydata/malloy';
import {RuntimeList, allDatabases} from '../../runtimes';
import '../../util/is-sql-eq';
import {databasesFromEnvironmentOr, mkSqlEqWith} from '../../util';

// TODO all dbs
const runtimes = new RuntimeList(databasesFromEnvironmentOr(['duckdb_wasm']));

const expressionModelText = `
explore: aircraft_models is table('malloytest.aircraft_models'){
  primary_key: aircraft_model_code
}

explore: aircraft is table('malloytest.aircraft'){
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
}
`;

const expressionModels = new Map<string, malloy.ModelMaterializer>();
runtimes.runtimeMap.forEach((runtime, databaseName) =>
  expressionModels.set(databaseName, runtime.loadModel(expressionModelText))
);

expressionModels.forEach((expressionModel, databaseName) => {
  const funcTestGeneral = async (
    expr: string,
    expected: string | boolean | number,
    type: 'group_by' | 'aggregate'
  ) => {
    const result = await expressionModel
      .loadQuery(
        `
      import "malloy://bigquery_functions"
      query: aircraft -> { ${type}: f is ${expr} }`
      )
      .run();
    console.log(result.sql);
    expect(result.data.path(0, 'f').value).toBe(expected);
  };

  const funcTest = (expr: string, expexted: string | boolean | number) =>
    funcTestGeneral(expr, expexted, 'group_by');

  const funcTestAgg = (expr: string, expexted: string | boolean | number) =>
    funcTestGeneral(expr, expexted, 'aggregate');

  // it(`functions work - ${databaseName}`, async () => {
  //   const result = await expressionModel
  //     .loadQuery(`
  //     import "malloy://functions"
  //     query: aircraft -> { group_by: f is cheers() }`)
  //     .run();
  //   // console.log(result.data.toObject());
  //   expect(result.data.path(0, "f").value).toBe("Hooray, functions work!");
  // });

  // it(`functions work 2 - ${databaseName}`, async () => {
  //   const result = await expressionModel
  //     .loadQuery(`
  //     import "malloy://functions"
  //     query: aircraft -> { group_by: f is plus(2, 2) }`)
  //     .run();
  //   expect(result.data.path(0, "f").value).toBe(4);
  // });

  it(`concat works - ${databaseName}`, async () => {
    await funcTest("concat('foo', 'bar')", 'foobar');
    // TODO better handle case where concat is called with no arguments...
  });

  it(`round works - ${databaseName}`, async () => {
    await funcTest('round(1.2)', 1);
  });

  it(`round works with precision - ${databaseName}`, async () => {
    await funcTest('round(12.2, -1)', 10);
  });

  it(`round works with precision [error, precision must be int] - ${databaseName}`, async () => {
    await funcTest('round(12.2, -1.5)', 10);
  });

  it(`stddev works - ${databaseName}`, async () => {
    await funcTestAgg('round(stddev(seats))', 39);
    // TODO better handle case where concat is called with no arguments...
  });

  // TODO update this test to check for error -- also improve the error
  // for cases like this when the data type matches but not the expression type
  it(`stddev works ? - ${databaseName}`, async () => {
    await funcTestAgg('round(stddev(count()))', 39);
  });

  it(`stddev works on join field - ${databaseName}`, async () => {
    await funcTestAgg('round(aircraft_models.seats.stddev())', 39);
  });

  it(`custom_avg- ${databaseName}`, async () => {
    await funcTestAgg('aircraft_models.seats.custom_avg()', 10);
  });

  it(`avg - ${databaseName}`, async () => {
    await funcTestAgg('aircraft_models.seats.avg()', 10);
  });

  it(`custom_avg works on join field - ${databaseName}`, async () => {
    await funcTestAgg(
      'aircraft_models.seats.custom_avg() = aircraft_models.seats.avg()',
      true
    );
  });

  it(`custom_avg no symmetric, filter - ${databaseName}`, async () => {
    await funcTestAgg(
      'custom_avg(aircraft_models.seats) { where: aircraft_models.seats > 3 }',
      10
    );
  });

  it(`custom_avg with filter - ${databaseName}`, async () => {
    await funcTestAgg(
      'aircraft_models.seats.custom_avg() { where: 1 = 1 }',
      10
    );
  });

  it(`silly with filter - ${databaseName}`, async () => {
    await funcTestAgg('silly(aircraft_models.seats, count())', 10);
  });

  it(`silly symmetric with filter and agg - ${databaseName}`, async () => {
    await funcTestAgg(
      'aircraft_models.silly(aircraft_models.seats, count())',
      10
    );
  });

  it(`silly symmetric with filter - ${databaseName}`, async () => {
    await funcTestAgg(
      `aircraft_models.silly(aircraft_models.seats, 1) {
        where: aircraft_models.seats > 3
      }`,
      10
    );
  });

  it(`regexp match - ${databaseName}`, async () => {
    await funcTestAgg("regexp_extract('I have a dog', r'd[aeiou]g')", 'dog');
  });

  // it(`num_args works - ${databaseName}`, async () => {
  //   const result = await expressionModel
  //     .loadQuery(`
  //     import "malloy://functions"
  //     query: aircraft -> { group_by: f is num_args('foo', 'bar') }`)
  //     .run();
  //   console.log(result.sql);
  //   expect(result.data.path(0, "f").value).toBe(2);
  // });

  // it(`get_dialect works - ${databaseName}`, async () => {
  //   const result = await expressionModel
  //     .loadQuery(`
  //     import "malloy://functions"
  //     query: aircraft -> { group_by: f is get_dialect() }`)
  //     .run();
  //   console.log(result.sql);
  //   expect(result.data.path(0, "f").value).toBe("duckdb");
  // });
});

afterAll(async () => {
  await runtimes.closeAll();
});
