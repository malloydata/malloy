/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as malloy from '@malloydata/malloy';

import {testDatabase} from '../test_database';
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

describe('airport_tests', () => {
  let model: malloy.ModelMaterializer;
  beforeAll(async () => {
    model = testDatabase.runtime.loadModel(airportModelText);
  });

  it('half_count', async () => {
    const result = await runQuery(
      model,
      `
      run: airports->{
        aggregate: half is airport_count/2.0
      }
    `
    );
    expect(result.data.value[0]['half']).toBe(9896.5);
  });
});
