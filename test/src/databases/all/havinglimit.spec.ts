/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import {runQuery} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const testModel = runtime.loadModel('');

  describe('limits', () => {
    test('limit only', async () => {
      const {data} = await runQuery(
        testModel,
        `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          limit: 3
        }
        `
      );
      expect(data.length).toBe(3);
    });

    test.when(runtime.supportsNesting)('limit nest one', async () => {
      const {data} = await runQuery(
        testModel,
        `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          limit: 3
          nest: one is {
            group_by: state
            limit: 2
          }
        }
        `
      );
      expect(data.length).toBe(3);
      expect(data[0]).toMatchObject({popular_name: 'Isabella'});
      expect(data[0]).toHaveProperty('one.length', 2);
      expect(data[0]).toHaveProperty('one.0.state', 'AZ');
    });

    test.when(runtime.supportsNesting)('limit nest with having', async () => {
      const {data} = await runQuery(
        testModel,
        `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 3
          nest: one is {
            group_by: state
            limit: 2
          }
        }
        `
      );
      expect(data.length).toBe(3);
      expect(data[0]).toMatchObject({popular_name: 'Sophia'});
      expect(data[0]).toHaveProperty('one.length', 2);
      expect(data[0]).toHaveProperty('one.0.state', 'AK');
    });

    test.when(runtime.supportsNesting)(
      'limit two nests with having',
      async () => {
        const {data} = await runQuery(
          testModel,
          `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          nest: name is {
            group_by: popular_name
            aggregate: c is count()
            having: c % 2 = 1
            limit: 3
          }
          nest: by_state is {
            group_by: state
            limit: 2
          }
        }
        `
        );
        expect(data.length).toBe(1);
        expect(data[0]).toHaveProperty('name.length', 3);
        expect(data[0]).toHaveProperty('name.0.popular_name', 'Sophia');
        expect(data[0]).toHaveProperty('by_state.length', 2);
        expect(data[0]).toHaveProperty('by_state.0.state', 'AK');
      }
    );

    test.when(runtime.supportsNesting)(
      'limit 2 stage second with nest with having',
      async () => {
        const {data} = await runQuery(
          testModel,
          `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          select: *
        } -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 3
          nest: one is {
            group_by: state
            limit: 2
          }
        }
        `
        );
        expect(data.length).toBe(3);
        expect(data[0]).toMatchObject({popular_name: 'Sophia'});
        expect(data[0]).toHaveProperty('one.length', 2);
        expect(data[0]).toHaveProperty('one.0.state', 'AK');
      }
    );

    test.when(runtime.supportsNesting)('limit index 2 stage', async () => {
      const {data} = await runQuery(
        testModel,
        `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          index: *
        } -> {
          group_by: fieldName
          aggregate: cardinality is count(fieldValue)
          limit: 2
          nest: values is {
            group_by: fieldValue
            aggregate: weight is weight.sum()
            limit: 3
          }
        }
        `
      );
      expect(data.length).toBe(2);
      expect(data[0]).toMatchObject({fieldName: 'state'});
      expect(data[0]).toHaveProperty('values.length', 3);
      expect(data[1]).toMatchObject({fieldName: 'popular_name'});
      expect(data[1]).toHaveProperty('values.length', 3);
      expect(data[1]).toHaveProperty('values.0.fieldValue', 'Isabella');
      expect(data[1]).toHaveProperty('values.0.weight', 24);
    });

    test.when(runtime.supportsNesting)(
      'limit select - in pipeline',
      async () => {
        const {data} = await runQuery(
          testModel,
          `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 100
          nest: one is {
            group_by: state
            limit: 2
          }
        } -> {
          select: popular_name
          limit: 2
        }
        `
        );
        expect(data.length).toBe(2);
      }
    );

    test.when(
      runtime.supportsNesting &&
        runtime.dialect.supportsPipelinesInViews &&
        databaseName !== 'trino'
    )('limit select - nested pipeline', async () => {
      const {data} = await runQuery(
        testModel,
        `
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 1
          nest: one is {
            group_by: state
            limit: 20
          } -> {
            select: state
            limit: 2
          }
        }
        `
      );
      expect(data.length).toBe(1);
      expect(data[0]).toHaveProperty('one.length', 2);
    });

    // Test for bug: multi-field order_by with limit should generate single ROW_NUMBER()
    // Previously generated duplicate __row_number__ columns causing BigQuery errors
    test.when(runtime.supportsNesting)(
      'limit nest with multi-field order_by',
      async () => {
        const {data} = await runQuery(
          testModel,
          `
          run: ${databaseName}.table('malloytest.state_facts') -> {
            group_by: popular_name
            aggregate: c is count()
            limit: 3
            nest: by_state is {
              group_by: state
              aggregate:
                state_count is count()
                total_births is births.sum()
              order_by: state_count desc, total_births desc
              limit: 2
            }
          }
          `
        );
        expect(data.length).toBe(3);
        expect(data[0]).toHaveProperty('by_state.length', 2);
      }
    );
  });
});
