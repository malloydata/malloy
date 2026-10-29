/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
describe('Wildcard BigQuery Tables', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test('test valid wildcard table name without using _TABLE_SUFFIX', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          primary_key: id
          measure: aircraft_count is count()
        }

        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
        )
        .run();
      expect(result.data.value[0]['aircraft_count']).toBe(9);
    }
  });

  test('test wildcard table name and _TABLE_SUFFIX as a filter', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _TABLE_SUFFIX = '01'
        }

        run: aircraft -> {
          aggregate: aircraft_count
        }
`
        )
        .run();
      expect(result.data.value[0]['aircraft_count']).toBe(5);
    }
  });

  test('test join between wildcard tables without using _TABLE_SUFFIX', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          primary_key: id
        }

        source: state_facts is bigquery.table('malloydata-org.malloytest.state_facts') extend {
          join_many: aircraft on state = aircraft.state
        }
        run: state_facts -> {
          group_by: aircraft.state
          aggregate: aircraft_count is aircraft.count()
          order_by: 1
        }
`
        )
        .run();
      expect(result.data.value).toStrictEqual([
        {state: 'IA', aircraft_count: 1},
        {state: 'KS', aircraft_count: 1},
        {state: 'LA', aircraft_count: 1},
        {state: 'MO', aircraft_count: 1},
        {state: 'NH', aircraft_count: 1},
        {state: 'OK', aircraft_count: 1},
        {state: 'OR', aircraft_count: 2},
        {state: 'TX', aircraft_count: 1},
        {state: null, aircraft_count: 43},
      ]);
    }
  });

  test('test join with wildcard tables and _TABLE_SUFFIX as source a filter', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          primary_key: id
          where: _TABLE_SUFFIX = '02'
        }

        source: state_facts is bigquery.table('malloydata-org.malloytest.state_facts') extend {
          join_many: aircraft on state = aircraft.state
        }
        run: state_facts -> {
          group_by: aircraft.state
          aggregate: aircraft_count is aircraft.count()
          order_by: 1
        }
`
        )
        .run();
      expect(result.data.value).toStrictEqual([
        {state: 'KS', aircraft_count: 1},
        {state: 'LA', aircraft_count: 1},
        {state: 'OK', aircraft_count: 1},
        {state: 'OR', aircraft_count: 1},
        {state: null, aircraft_count: 47},
      ]);
    }
  });

  test('test join with wildcard tables and _TABLE_SUFFIX as a filter and generated_uuid', async () => {
    // issue # 1147
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          join_many: state_facts is bigquery.table('malloydata-org.malloytest.state_facts')
            on state_facts.state = state
        }

        run: aircraft -> {
          group_by: state_facts.state
          aggregate: aircraft_count is count()
          where: _TABLE_SUFFIX = '02'
          order_by: 1 desc
          limit: 1
        }
`
        )
        .run();
      expect(result.data.path(0, 'state').value).toBe('OR');
    }
  });

  test('test a join with wildcard tables and _TABLE_SUFFIX column is used as a group-by key', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          primary_key: id
          where: _TABLE_SUFFIX = '02'
        }

        source: state_facts is bigquery.table('malloydata-org.malloytest.state_facts') extend {
          join_many: aircraft on state = aircraft.state
        }
        run: state_facts -> {
          group_by: aircraft._TABLE_SUFFIX
          aggregate: aircraft_count is aircraft.count()
          order_by: 1
        }
`
        )
        .run();
      expect(result.data.value).toStrictEqual([
        {_TABLE_SUFFIX: '02', aircraft_count: 4},
        {_TABLE_SUFFIX: null, aircraft_count: 47},
      ]);
    }
  });

  test('test a join with wildcard tables and _TABLE_SUFFIX column is used as a group-by key and a filter', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('\`malloydata-org.malloytest.wildcard_aircraft_*\`') extend {
          primary_key: id
          where: _TABLE_SUFFIX = '02'
        }

        source: state_facts is bigquery.table('malloydata-org.malloytest.state_facts') extend {
          join_many: aircraft on state = aircraft.state
        }
        run: state_facts -> {
          group_by: aircraft._TABLE_SUFFIX
          aggregate: aircraft_count is aircraft.count()
          where: aircraft._TABLE_SUFFIX = '01'
          order_by: 1
        }
`
        )
        .run();
      expect(result.data.value).toStrictEqual([]);
    }
  });
});
