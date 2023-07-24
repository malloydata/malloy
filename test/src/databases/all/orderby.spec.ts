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

import * as malloy from '@malloydata/malloy';
import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

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
    ).runSQL(`WITH test AS(\n${sql}) SELECT '[{"foo":1}]' as results`);
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
    source: models is table('malloytest.aircraft_models'){
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
    expect(result.data.row(0).cell('big').value).toBe(false);
    expect(result.data.row(0).cell('model_count').value).toBe(58451);
  });

  it(`boolean in pipeline - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        query: models->{
          group_by:
            manufacturer,
            big is seats >=21
          aggregate: model_count is count()
        }->{
          group_by: big
          aggregate: model_count is model_count.sum()
        }
        `
      )
      .run();
    expect(result.data.row(0).cell('big').value).toBe(false);
    expect(result.data.row(0).cell('model_count').value).toBe(58500);
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
    expect(result.data.row(0).cell('j_names').value).toBe(1358);
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
          group_by: \`select\` is UPPER(manufacturer)
          aggregate: fetch is count()
        }
      } -> {
        project:
          withxz is lower(withx.select)
          fetch is withx.fetch
      }
      `
      )
      .getSQL();
    await validateCompilation(databaseName, sql);
  });

  it.skip('reserved words in structure definitions', async () => {
    const sql = await orderByModel
      .loadQuery(
        `
      query: models->{
        nest: withx is {
          group_by: is \`select\` is UPPER(manufacturer)
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
        aggregate: model_count is count(){? manufacturer ? ~'A%' }
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
        source: popular_names is from(models->{
          having: model_count > 100
          group_by: manufacturer
          aggregate: model_count
        })

        query: popular_names->{
          order_by: 2
          project: manufacturer, model_count
        }
        `
      )
      .run();
    expect(result.data.row(0).cell('model_count').value).toBe(102);
  });

  it(`modeled having complex - ${databaseName}`, async () => {
    const result = await orderByModel
      .loadQuery(
        `
        source: popular_names is from(models->{
          having: model_count > 100
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
         project: manufacturer, model_count
        }
        `
      )
      .run();
    expect(result.data.row(0).cell('model_count').value).toBe(102);
  });

  it(`turtle references joined element - ${databaseName}`, async () => {
    const sql = await orderByModel
      .loadQuery(
        `
    source: a is table('malloytest.aircraft'){
      primary_key: tail_num
      measure: aircraft_count is count(*)
    }

    source: f is table('malloytest.flights'){
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
