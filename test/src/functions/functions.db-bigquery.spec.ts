/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as malloy from '@malloydata/malloy';
import {testModel} from '../models/faa_model';
import {testDatabase} from '../test_database';
import {bqCompile, compileQuery} from '../bigquery/bigquery_compile';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

async function runQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).run();
}

const airportModelText = `
source: airports is db.table('malloydata-org.malloytest.airports') extend {
  primary_key: code
  measure: airport_count is count()

  view: by_fac_type is {
    group_by: fac_type
    aggregate: airport_count
  }

  view: by_state is {
    group_by: state
    aggregate: airport_count
  }

  view: by_county is {
    group_by: county
    aggregate: airport_count
  }
}

query: ca_airports is airports->by_fac_type + { where: state ? 'CA' | 'NY'}
`;

describe('BigQuery expression tests', () => {
  const faa = testDatabase.runtime.loadModel(testModel);

  it('first_fragment', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          group_by: carrier is upper(carriers.nickname)
          aggregate: flight_count
        }
      `
    );
    await bqCompile(sql);
  });
});

describe('airport_tests', () => {
  let model: malloy.ModelMaterializer;
  beforeAll(async () => {
    model = testDatabase.runtime.loadModel(airportModelText);
  });

  it('string_expressions', async () => {
    const result = await runQuery(
      model,
      `
      run: airports->{
        group_by: lower_state is lower(state)
        order_by: 1 DESC
        limit: 10
      }
    `
    );
    expect(result.data.value[0]['lower_state']).toBe('wy');
  });
});
