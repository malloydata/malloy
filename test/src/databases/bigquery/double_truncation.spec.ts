/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
describe('BigQuery double truncation', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test('check for double truncation', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = `
        run: bigquery.table('malloydata-org.malloytest.flights') -> {
          group_by: takeoff_week is dep_time.week
        }
      `;
      const result = await runtime.loadQuery(src).run();
      // Check for either TIMESTAMP_TRUNC or DATETIME_TRUNC (civil time path)
      const truncs = (
        result.sql.match(/(TIMESTAMP_TRUNC|DATETIME_TRUNC)/gi) || []
      ).length;
      expect(truncs).toBe(1);
    }
  });
});
