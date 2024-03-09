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
import {databasesFromEnvironmentOr, onlyIf} from '../../util';
import '../../util/db-jest-matchers';

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

describe('join expression tests', () => {
  runtimes.runtimeMap.forEach((runtime, database) => {
    const joinModelText = modelText(database);
    const joinModel = runtime.loadModel(joinModelText);
    it(`model source refine join - ${database}`, async () => {
      await expect(`
        source: a2 is aircraft extend {
          join_one: aircraft_models with aircraft_model_code
        }
        run: a2 -> {
          aggregate:
            aircraft_count
            aircraft_models.model_count
        }
      `).malloyResultMatches(joinModel, {model_count: 1416});
    });

    it(`model source refine in query join - ${database}`, async () => {
      await expect(`
        run: aircraft extend {
          join_one: aircraft_models with aircraft_model_code
        } -> {
          aggregate:
            aircraft_count
            aircraft_models.model_count
        }
      `).malloyResultMatches(joinModel, {model_count: 1416});
    });

    it(`model: join fact table query - ${database}`, async () => {
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
      `).malloyResultMatches(joinModel, {num_models: 1147});
    });

    it(`model: source based on query - ${database}`, async () => {
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
      `).malloyResultMatches(joinModel, {num_models: 1147});
    });

    it(`model: funnel - merge two queries - ${database}`, async () => {
      await expect(`
        run: aircraft_models->{
          group_by: m is manufacturer
          aggregate: num_models is count()
          } extend {
            join_one: seats is
              aircraft_models->{
                group_by: m is manufacturer
                aggregate: total_seats is seats.sum()
              } with m
          } -> {
            select:
              m
              num_models
              seats.total_seats
            order_by: 2 desc
            limit: 1
          }
      `).malloyResultMatches(joinModel, {
        num_models: 1147,
        total_seats: 252771,
      });
    });

    it(`model: modeled funnel - ${database}`, async () => {
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
      `).malloyResultMatches(joinModel, {
        num_models: 1147,
        total_seats: 252771,
      });
    });

    it(`model: modeled funnel2 - ${database}`, async () => {
      await expect(`
        run: funnel->{
          select:
          manufacturer
            num_models
            seats.total_seats
          order_by: 2 desc
          limit: 1
        }
      `).malloyResultMatches(joinModel, {
        num_models: 1147,
        total_seats: 252771,
      });
    });

    it(`model: double_pipe - ${database}`, async () => {
      await expect(`
        run: aircraft_models->{
          group_by: manufacturer
          aggregate: f is count()
        }->{
          aggregate: f_sum is f.sum()
        }->{
          select: f_sum2 is f_sum+1
        }
    `).malloyResultMatches(joinModel, {f_sum2: 60462});
    });

    test(
      `model: unnest is left join - ${database}`,
      onlyIf(runtime.supportsNesting, async () => {
        await expect(`
          // produce a table with 4 rows that has a nested element
          query: a_states is ${database}.table('malloytest.state_facts')-> {
          where: state ? ~ 'A%'
            group_by: state
            nest: somthing is {group_by: state}
          }

          // join the 4 rows and reference the
          //  nested column. should return all the rows.
          //  If the unnest is an inner join, we'll get back just 4 rows.
          run: ${database}.table('malloytest.state_facts') extend {
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
        `).malloyResultMatches(joinModel, [{}, {}, {}, {}, {}]);
      })
    );

    // not sure how to solve this one yet, just check for > 4 rows
    it(`All joins at the same level - ${database}`, async () => {
      await expect(`
        source: flights is ${database}.table('malloytest.flights') extend {
          join_one: aircraft is ${database}.table('malloytest.aircraft')
            on tail_num = aircraft.tail_num
          join_one: aircraft_models is ${database}.table('malloytest.aircraft_models')
            on aircraft.aircraft_model_code = aircraft_models.aircraft_model_code
        }

        run: flights -> {
          group_by: aircraft_models.seats
          aggregate: flight_count is count()
          limit: 5
        }
      `).malloyResultMatches(joinModel, [{}, {}, {}, {}, {}]);
    });

    it(`join issue440 - ${database}`, async () => {
      await expect(`
        source: aircraft_models is ${database}.table('malloytest.aircraft_models')

        source: aircraft is ${database}.table('malloytest.aircraft')

        source: flights is ${database}.table('malloytest.flights') extend {
          join_one: aircraft on aircraft.tail_num = tail_num
          join_one: aircraft_models on aircraft_models.aircraft_model_code = aircraft.aircraft_model_code
        }

        run: flights-> {
          group_by: testingtwo is aircraft_models.model
          limit: 5
        }
      `).malloyResultMatches(runtime, [{}, {}, {}, {}, {}]);
    });

    it(`join issue1092 - ${database}`, async () => {
      await expect(`
        run: ${database}.table('malloytest.state_facts') -> {
          extend: {join_one: sf is ${database}.table('malloytest.state_facts') on sf.state = state}
          aggregate: x is sf.births.sum() { where:  state = 'CA' }
        }
      `).malloyResultMatches(runtime, [{}]);
    });
  });
});
