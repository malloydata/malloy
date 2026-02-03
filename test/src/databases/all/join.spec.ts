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

/* eslint-disable no-console */

import {RuntimeList, allDatabases} from '../../runtimes';
import {TestSelect} from '../../test-select';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

function modelText(connectionName: string) {
  return `
  source: aircraft_models is ${connectionName}.table('malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    measure: model_count is count()
    view: manufacturer_models is {
      group_by: manufacturer
      aggregate: num_models is count()
    }
    view: manufacturer_seats is {
      group_by: manufacturer
      aggregate: total_seats is seats.sum()
    }
  }

  source: aircraft is ${connectionName}.table('malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
  }

  source: funnel is aircraft_models->manufacturer_models extend {
    join_one: seats is aircraft_models->manufacturer_seats
        with manufacturer
  }
`;
}

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const joinModel = wrapTestModel(runtime, modelText(databaseName));
  const testModel = wrapTestModel(runtime, '');

  it('model source refine join', async () => {
    await expect(`
      source: a2 is aircraft extend {
        join_one: aircraft_models with aircraft_model_code
      }
      run: a2 -> {
        aggregate:
          aircraft_count
          aircraft_models.model_count
      }
    `).toMatchResult(joinModel, {model_count: 1416});
  });

  it('model source refine in query join', async () => {
    await expect(`
      run: aircraft extend {
        join_one: aircraft_models with aircraft_model_code
      } -> {
        aggregate:
          aircraft_count
          aircraft_models.model_count
      }
    `).toMatchResult(joinModel, {model_count: 1416});
  });

  it('model: join fact table query', async () => {
    await expect(`
      run: aircraft_models extend {
        join_one: am_facts is
          aircraft_models->{
            group_by: m is manufacturer
            aggregate: num_models is count()
          } with manufacturer
      } -> {
        select:
          manufacturer
          am_facts.num_models
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {num_models: 1147});
  });

  it('model: source based on query', async () => {
    await expect(`
      run: aircraft_models
        -> {
          group_by: m is manufacturer
          aggregate: num_models is count()
        } -> {
          select:
          m
          num_models
          order_by: 2 desc
          limit: 1
        }
    `).toMatchResult(joinModel, {num_models: 1147});
  });

  it('model: funnel - merge two queries', async () => {
    await expect(`
      run: aircraft_models->{
        group_by: m is manufacturer
        aggregate: num_models is count()
        } extend {
          join_one: seats_join is
            aircraft_models->{
              group_by: m is manufacturer
              aggregate: total_seats is seats.sum()
            } with m
        } -> {
          select:
            m
            num_models
            seats_join.total_seats
          order_by: 2 desc
          limit: 1
        }
    `).toMatchResult(joinModel, {
      num_models: 1147,
      total_seats: 252771,
    });
  });

  it('model: modeled funnel', async () => {
    await expect(`
      run: aircraft_models-> manufacturer_models extend {
        join_one: seats is aircraft_models->manufacturer_seats with manufacturer
      } -> {
        select:
          manufacturer,
          num_models,
          seats.total_seats
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {
      num_models: 1147,
      total_seats: 252771,
    });
  });

  it('model: modeled funnel2', async () => {
    await expect(`
      run: funnel->{
        select:
        manufacturer
          num_models
          seats.total_seats
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {
      num_models: 1147,
      total_seats: 252771,
    });
  });

  it('model: double_pipe', async () => {
    await expect(`
      run: aircraft_models->{
        group_by: manufacturer
        aggregate: f is count()
      }->{
        aggregate: f_sum is f.sum()
      }->{
        select: f_sum2 is f_sum+1
      }
  `).toMatchResult(joinModel, {f_sum2: 60462});
  });

  test.when(runtime.supportsNesting && runtime.dialect.supportsLeftJoinUnnest)(
    'model: unnest is left join',
    async () => {
      await expect(`
        // produce a table with 4 rows that has a nested element
        query: a_states is ${databaseName}.table('malloytest.state_facts')-> {
        where: state ? ~ 'A%'
          group_by: state
          nest: somthing is {group_by: state}
        }

        // join the 4 rows and reference the
        //  nested column. should return all the rows.
        //  If the unnest is an inner join, we'll get back just 4 rows.
        run: ${databaseName}.table('malloytest.state_facts') extend {
          join_one: a_states is a_states with state
        }
        -> {
          group_by: state
          aggregate: c is count()
          nest: a is  {
            group_by: a_states.somthing.state
          }
          limit: 5
        }
      `).toMatchRows(joinModel, [{}, {}, {}, {}, {}]);
    }
  );

  it('activates parent join when fields in leaf join are referenced', async () => {
    await expect(`
      source: flights is ${databaseName}.table('malloytest.flights') extend {
        join_one: aircraft is ${databaseName}.table('malloytest.aircraft')
          on tail_num = aircraft.tail_num
        join_one: aircraft_models is ${databaseName}.table('malloytest.aircraft_models')
          on aircraft.aircraft_model_code = aircraft_models.aircraft_model_code
      }

      run: flights -> {
        group_by: aircraft_models.seats
        aggregate: flight_count is count()
        limit: 5
      }
    `).toMatchRows(testModel, [{}, {}, {}, {}, {}]);
  });

  // I don't know what join issue 440 was, there was a change of repos and that
  // is no longer recorded anywhere. I suspect it was the indirect reference to
  // the leaf join field. In a world where the join tree is built from fieldUsage
  // that automatically works, but what is a problem is inferring the join tree
  // from the ordering of usages. Inverting the "on" comparison in this test
  // caused it to fail when the previous one passed.
  it('join issue440', async () => {
    await expect(`
      source: aircraft is ${databaseName}.table('malloytest.aircraft')
      source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models')

      source: flights is ${databaseName}.table('malloytest.flights') extend {
        join_one: aircraft on aircraft.tail_num = tail_num
        join_one: aircraft_models on aircraft_models.aircraft_model_code = aircraft.aircraft_model_code
      }

      run: flights-> {
        group_by: testtwo is aircraft_models.seats
        limit: 1
      }
    `).toMatchResult(testModel, {});
  });

  it('join issue1092', async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        extend: {join_one: sf is ${databaseName}.table('malloytest.state_facts') on sf.state = state}
        aggregate: x is sf.births.sum() { where:  state = 'CA' }
      }
    `).toMatchResult(testModel, {});
  });

  it('always join in query', async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        join_cross: x is ${databaseName}.table('malloytest.state_facts') on true
        select: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 51 * 51});
  });

  it('not always join in extend', async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        extend: {
          join_cross: x is ${databaseName}.table('malloytest.state_facts') on true
        }
        select: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 51});
  });

  it('always inner join has side effects (in group_by)', async () => {
    await expect(`
      ##! experimental.join_types
      run: ${databaseName}.table('malloytest.state_facts') -> {
        join_cross: x is ${databaseName}.table('malloytest.state_facts') inner on false
        group_by: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 0});
  });

  it.when(runtime.dialect.nestedArrays)(
    'finds join dependency in non basic atomic fields',
    async () => {
      await expect(`
      run: ${databaseName}.sql("SELECT 1 as n")
        extend { dimension: a1 is [[1]], a2 is [[2]] }
        -> { select: pick_a1 is pick a1.each when true else a2.each }
      `).toMatchResult(testModel, {pick_a1: [1]});
    }
  );

  test('join through join', async () => {
    const ts = new TestSelect(runtime.dialect);
    const usr = ts.generate({id: 1, email: 'email'});
    const res = ts.generate({id: 1, user_id: 1});
    const msg = ts.generate({id: 1, msg_email: 'email'});
    await expect(`
      source: usr is ${databaseName}.sql("""${usr}""")
      source: res is ${databaseName}.sql("""${res}""") extend {
        join_one: usr is usr on usr.id = user_id
        dimension: usr_email is usr.email
      }
      source: msg is ${databaseName}.sql("""${msg}""") extend {
        join_many: res is res on msg_email = res.usr_email
      }
      run: msg -> {
        select: *, res.usr_email
      }`).malloyResultMatches(runtime, {usr_email: 'email'});
  });
});
