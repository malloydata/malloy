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

import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel, runQuery} from '@malloydata/malloy/test';

import {RuntimeList} from '../../runtimes';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);

const runtimes = new RuntimeList(databases);
describe.each(runtimes.runtimeList)(
  'Used to be hand-written queries tests',
  (databaseName, runtime) => {
    const runtimes = new RuntimeList(['duckdb']);

    afterAll(async () => {
      await runtimes.closeAll();
    });

    const makeModel = (databaseName: string) => `
      source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
        measure: model_count is count()
        measure: total_seats is seats.sum()
        measure: boeing_seats is seats.sum() { where: manufacturer = 'BOEING' }
        measure: percent_boeing is (boeing_seats / total_seats) * 100
        measure: percent_boeing_floor is floor(percent_boeing)
        primary_key: aircraft_model_code
      }

      source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
        measure: aircraft_count is count()

        view: hand_turtle is { aggregate: aircraft_count }

        view: hand_turtle_pipeline is {
          aggregate: aircraft_count
        } -> {
          group_by: aircraft_count
        }

        join_one: aircraft_models
          on aircraft_model_code = aircraft_models.aircraft_model_code

        primary_key: tail_num
      }
    `;

    // BigQuery tests only on the Hand Coded models.
    const testModel = wrapTestModel(runtime, makeModel(databaseName));

    it(`hand query hand model - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: total_seats is aircraft_models.seats.sum() {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      }
    `).toMatchResult(testModel, {total_seats: 6244});
    });

    it(`hand turtle - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: aircraft_count
      }
    `).toMatchResult(testModel, {aircraft_count: 3599});
    });

    it(`hand turtle malloy - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> hand_turtle
    `).toMatchResult(testModel, {aircraft_count: 3599});
    });

    it(`default sort order - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        limit: 10
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
    });

    it(`default sort order by dir - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        order_by: 2
        limit: 10
      }
    `).toMatchResult(testModel, {aircraft_count: 1});
    });

    it(`hand turtle2 - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        nest: my_turtle is {
          group_by: county
          aggregate: aircraft_count
        }
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
    });

    it(`hand total - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        aggregate: total_aircraft is all(aircraft_count)
      }
    `).toMatchResult(testModel, {total_aircraft: 3599});
    });

    it(`hand turtle3 - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        nest: hand_turtle
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
    });

    it(`hand turtle total - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        nest: my_turtle is {
          group_by: county
          aggregate: aircraft_count
          aggregate: total_aircraft is all(aircraft_count)
        }
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
    });

    it(`hand: declared pipeline as main query - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: aircraft_count
      } -> {
        group_by: aircraft_count
      }
    `).toMatchResult(testModel, {aircraft_count: 3599});
    });

    it(`hand: turtle is pipeline - ${databaseName}`, async () => {
      const result = await runQuery(
        testModel.model,
        `
      run: aircraft -> {
        aggregate: aircraft_count
        nest: pipe is {
          group_by: state, county
          aggregate: aircraft_count
        } -> {
          where: county ~ '2%'
          group_by: state
          aggregate: total_aircraft is aircraft_count.sum()
        }
      }
    `
      );
      expect(result.data[0]).toHavePath({'pipe.total_aircraft': 61});
    });

    // Hand model basic calculations for sum, filtered sum, without a join.
    it(`hand: lots of kinds of sums - ${databaseName}`, async () => {
      await expect(`
      run: aircraft->{
        aggregate:
          aircraft_models.total_seats,
          total_seats2 is sum(aircraft_models.seats),
          total_seats3 is aircraft_models.sum(aircraft_models.seats),
          aircraft_models.boeing_seats,
          boeing_seats2 is aircraft_models.sum(aircraft_models.seats) { where: aircraft_models.manufacturer ? 'BOEING'},
          boeing_seats3 is aircraft_models.boeing_seats { where: aircraft_models.manufacturer ? ~'B%'}
      }
    `).toMatchResult(testModel, {
        total_seats: 18294,
        total_seats2: 31209,
        total_seats3: 18294,
        boeing_seats: 6244,
        boeing_seats2: 6244,
        boeing_seats3: 6244,
      });
    });

    it(`hand: bad root name for pathed sum - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: total_seats3 is aircraft_models.sum(aircraft_models.seats)
      }
    `).toMatchResult(testModel, {total_seats3: 18294});
    });

    // WORKs: (hand coded model):
    // Model based version of sums.
    it(`hand: expression fixups. - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate:
          aircraft_models.total_seats,
          aircraft_models.boeing_seats
      }
    `).toMatchResult(testModel, {total_seats: 18294, boeing_seats: 6244});
    });

    it(`model: filtered measures - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: boeing_seats is aircraft_models.total_seats {
          where: aircraft_models.manufacturer ? 'BOEING'
        }
      }
    `).toMatchResult(testModel, {boeing_seats: 6244});
    });

    // does the filter force a join?
    it(`model: do filters force dependant joins? - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: boeing_aircraft is count() {
          where:aircraft_models.manufacturer ? 'BOEING'
        }
      }
    `).toMatchResult(testModel, {boeing_aircraft: 69});
    });

    // Works: Generate query using named alias.
    it(`hand: filtered measures - ${databaseName}`, async () => {
      await expect(`
      run: aircraft -> {
        aggregate: boeing_seats is aircraft_models.seats.sum() {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      }
    `).toMatchResult(testModel, {boeing_seats: 6244});
    });

    // Join tests

    const joinTestModel = wrapTestModel(
      runtime,
      makeModel(databaseName) +
        `
      source: model_aircraft is aircraft_models extend {
        join_many: aircraft on aircraft_model_code = aircraft.aircraft_model_code
      }
    `
    );

    it(`hand join ON - ${databaseName}`, async () => {
      await expect(`
      run: model_aircraft -> {
        group_by: aircraft.state
        aggregate: aircraft.aircraft_count
        aggregate: model_count
      }
    `).toMatchResult(joinTestModel, {model_count: 59104});
    });

    it(`hand join symmetric agg - ${databaseName}`, async () => {
      await expect(`
      run: model_aircraft -> {
        aggregate: total_seats
        aggregate: aircraft.aircraft_count
      }
    `).toMatchResult(joinTestModel, {
        total_seats: 452415,
        aircraft_count: 62644,
      });
    });
  }
);
