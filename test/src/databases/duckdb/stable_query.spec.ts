/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '../../util/db-jest-matchers';
import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import {API} from '@malloydata/malloy';
import type * as Malloy from '@malloydata/malloy-interfaces';

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const [describe, databases] = describeIfDatabaseAvailable(['duckdb']);

function modelText(databaseName: string): string {
  return `
source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
  view: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;
}

const runtimes = new RuntimeList(databases);
describe.each(runtimes.runtimeList)(
  'Stable Query exhaustive feature tests - %s',
  (databaseName, runtime) => {
    const connection = API.util.wrapLegacyConnection(runtime.connection);
    const fetchers = {
      urls: {
        readURL(url: URL) {
          if (url.toString() === 'file://aircraft.malloy/') {
            return Promise.resolve(modelText(databaseName));
          }
          throw new Error('File missing');
        },
      },
      connections: {
        lookupConnection(name: string) {
          if (name === databaseName) return Promise.resolve(connection);
          throw new Error('Connection missing');
        },
      },
    };

    const needs: Malloy.CompilerNeeds = {};
    beforeAll(async () => {
      const model = await API.asynchronous.compileModel(
        {
          model_url: 'file://aircraft.malloy/',
        },
        fetchers
      );
      needs.translations = model.translations;
    });

    test('query arrow', async () => {
      const result = await API.asynchronous.runQuery(
        {
          model_url: 'file://aircraft.malloy/',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'aircraft_models'},
              view: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {kind: 'field_reference', name: 'seats'},
                    },
                  },
                  {kind: 'limit', limit: 1},
                ],
              },
            },
          },
          compiler_needs: needs,
        },
        fetchers
      );
      expect(result.logs).toBeUndefined();
      expect(result).toMatchObject({result: {data: {}}});
      expect(result.result?.data).toEqual({
        kind: 'array_cell',
        array_value: [
          {
            kind: 'record_cell',
            record_value: [
              {
                kind: 'number_cell',
                number_value: 0,
              },
            ],
          },
        ],
      });
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
