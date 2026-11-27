/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';

import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
}

source: airports is db.table('malloytest.airports')

source: state_facts is db.table('malloytest.state_facts')

source: flights is db.table('malloytest.flights')

source: carriers is db.table('malloytest.carriers')
`;

const expressionModel = testDatabase.runtime.loadModel(modelText);

const funcTestGeneral = async (
  expr: string,
  type: 'group_by' | 'aggregate',
  expected:
    | {error: string; success?: undefined}
    | {success: string | boolean | number | null; error?: undefined}
) => {
  const run = async () => {
    return await expressionModel
      .loadQuery(
        `
    run: aircraft -> { ${type}: f is ${expr} }`
      )
      .run();
  };

  if (expected.success !== undefined) {
    const expectedSuccess =
      typeof expected.success === 'boolean'
        ? testDatabase.dialect.resultBoolean(expected.success)
        : expected.success;
    const result = await run();
    expect(result.data.path(0, 'f').value).toBe(expectedSuccess);
  } else {
    expect(run).rejects.toThrow(expected.error);
  }
};

const funcTest = (expr: string, expexted: string | boolean | number | null) =>
  funcTestGeneral(expr, 'group_by', {success: expexted});

describe('dialect functions', () => {
  describe('trino', () => {
    it('from_unixtime', async () => {
      await funcTest(
        'from_unixtime(1725555835) = @2024-09-05 17:03:55',
        testDatabase.dialect.resultBoolean(true)
      );
    });
  });
});
