/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

function sourceCodeWithFilter(filter: string) {
  return `
  source: aircraft_models is bigquery.table('malloydata-org.malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    where: ${filter}
  }

  source: aircraft is bigquery.table('malloydata-org.malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
    join_one: aircraft_models with aircraft_model_code
  }

  run: aircraft -> {
    group_by: aircraft_models.aircraft_model_code
  }
`;
}

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
describe('Joined filters', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test('work with comma', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = sourceCodeWithFilter('1 = 1, 2 = 2');
      const result = await runtime.loadQuery(src).run();
      expect(result.sql).toContain('1=1');
      expect(result.sql).toContain('2=2');
    }
  });

  test('work with and', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = sourceCodeWithFilter('1 = 1 and 2 = 2');
      const result = await runtime.loadQuery(src).run();
      expect(result.sql).toContain('1=1');
      expect(result.sql).toContain('2=2');
    }
  });
});
