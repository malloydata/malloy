/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
describe.skip('Wildcard BigQuery Tables', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test('test ITP-hourly table name using _PARTITIONTIME', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_hourly_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONTIME = @2023-03-06 17:00:00 to @2023-03-06 19:00:00
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

  test('test ITP-daily table name using _PARTITIONTIME', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_daily_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONTIME = @2023-03-06 00:00:00
        }

        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
        )
        .run();
      expect(result.data.value[0]['aircraft_count']).toBe(5);

      const empty_result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_daily_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONTIME = @2023-03-06 00:00:01
        }

        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
        )
        .run();
      expect(empty_result.data.value[0]['aircraft_count']).toBe(0);
    }
  });

  test('test ITP-monthly table name using _PARTITIONTIME', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_monthly_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONTIME = @2023-03-01 00:00:00
        }

        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
        )
        .run();
      expect(result.data.value[0]['aircraft_count']).toBe(5);

      const empty_result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_monthly_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONTIME = @2023-03-01 00:00:01
        }

        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
        )
        .run();
      expect(empty_result.data.value[0]['aircraft_count']).toBe(0);
    }
  });

  test('test ITP-hourly table name using _PARTITIONTIME as a group-by key', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_hourly_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONTIME = @2023-03-06 17:00:00 to @2023-03-06 19:00:00
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
        {state: null, aircraft_count: 43},
        {state: 'IA', aircraft_count: 1},
        {state: 'KS', aircraft_count: 1},
        {state: 'LA', aircraft_count: 1},
        {state: 'MO', aircraft_count: 1},
        {state: 'NH', aircraft_count: 1},
        {state: 'OK', aircraft_count: 1},
        {state: 'OR', aircraft_count: 2},
        {state: 'TX', aircraft_count: 1},
      ]);
    }
  });

  test('test ITP-hourly table name using _PARTITIONTIME as a group-by key and a filter', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
          source: aircraft is bigquery.table('malloydata-org.malloytest.itp_hourly_aircraft') extend {
            primary_key: id
            measure: aircraft_count is count()
            where: _PARTITIONTIME = @2023-03-06 17:00:00 to @2023-03-06 19:00:00
          }
          source: state_facts is bigquery.table('malloydata-org.malloytest.state_facts') extend {
            join_many: aircraft on state = aircraft.state
          }
          run: state_facts -> {
            group_by: aircraft.state
            aggregate: aircraft_count is aircraft.count()
            where: aircraft._PARTITIONTIME = @2023-03-06 18:00:00
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
      ]);
    }
  });

  test('test ITP-daily table name using _PARTITIONDATE', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const result = await runtime
        .loadQuery(
          `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_daily_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONDATE = @2023-03-06
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

  test('test ITP-hourly/monthly table name using _PARTITIONDATE', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      await expect(
        runtime
          .loadQuery(
            `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_hourly_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONDATE = @2023-03-06
        }
        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
          )
          .run()
      ).rejects.toThrow('_PARTITIONDATE');
      await expect(
        runtime
          .loadQuery(
            `
        source: aircraft is bigquery.table('malloydata-org.malloytest.itp_monthly_aircraft') extend {
          primary_key: id
          measure: aircraft_count is count()
          where: _PARTITIONDATE = @2023-03-06
        }
        run: aircraft -> {
          aggregate: aircraft_count
        }
      `
          )
          .run()
      ).rejects.toThrow('_PARTITIONDATE');
    }
  });
});
