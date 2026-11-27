/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {TestSelect} from '../test_tools/test_select';
import {testDatabase} from '../test_database';

describe('Postgres tests', () => {
  afterAll(() => testDatabase.shutdown());

  describe('all-aggregates query with joins and nested views', () => {
    // Reproduces a bug where an all-aggregates query on a source with
    // joins and nested views throws on Postgres. Postgres simulates
    // nesting via JSON with a finalize stage, which may expose a
    // translator/compiler schema mismatch for all-aggregate results.
    it('runs all-aggregates view on source with joins and nests', async () => {
      const ts = new TestSelect(testDatabase.dialect);
      const itemsSQL = ts.generate(
        {id: 1, name: 'widget', price: ts.mk_float(100.0)},
        {id: 2, name: 'gadget', price: ts.mk_float(200.0)}
      );
      const ordersSQL = ts.generate(
        {id: 1, item_id: 1, qty: 10},
        {id: 2, item_id: 2, qty: 5},
        {id: 3, item_id: 1, qty: 3}
      );
      const model = wrapTestModel(
        testDatabase,
        `
        source: items is db.sql("""${itemsSQL}""") extend {
          primary_key: id
          measure: item_count is count()
        }

        source: orders is db.sql("""${ordersSQL}""") extend {
          primary_key: id
          join_one: items with item_id

          measure:
            order_count is count()
            total_qty is qty.sum()

          view: by_item is {
            group_by: items.name
            aggregate: order_count, total_qty
          }

          view: kpis is {
            aggregate: order_count, total_qty
          }

          view: dashboard is {
            nest: kpis
            nest: by_item
          }

          view: explore_totals is {
            aggregate: order_count, total_qty
          }
        }
      `
      );
      await expect('run: orders -> explore_totals').toMatchResult(model, {
        order_count: 3,
        total_qty: 18,
      });
    });

    it('runs dashboard with nested all-aggregates view', async () => {
      const ts = new TestSelect(testDatabase.dialect);
      const itemsSQL = ts.generate(
        {id: 1, name: 'widget', price: ts.mk_float(100.0)},
        {id: 2, name: 'gadget', price: ts.mk_float(200.0)}
      );
      const ordersSQL = ts.generate(
        {id: 1, item_id: 1, qty: 10},
        {id: 2, item_id: 2, qty: 5},
        {id: 3, item_id: 1, qty: 3}
      );
      const model = wrapTestModel(
        testDatabase,
        `
        source: items is db.sql("""${itemsSQL}""") extend {
          primary_key: id
          measure: item_count is count()
        }

        source: orders is db.sql("""${ordersSQL}""") extend {
          primary_key: id
          join_one: items with item_id

          measure:
            order_count is count()
            total_qty is qty.sum()

          view: by_item is {
            group_by: items.name
            aggregate: order_count, total_qty
          }

          view: kpis is {
            aggregate: order_count, total_qty
          }

          view: dashboard is {
            nest: kpis
            nest: by_item
          }
        }
      `
      );
      // Also test getPreparedResult then run on dashboard (nests all-aggregates kpis)
      const runnable = model.model.loadQuery('run: orders -> dashboard');
      const preparedResult = await runnable.getPreparedResult();
      expect(preparedResult).toBeDefined();
      const result = await runnable.run();
      expect(result.data.value).toBeDefined();
      expect(result.data.value.length).toBeGreaterThan(0);
    });

    it('getPreparedResult then run on all-aggregates view', async () => {
      const ts = new TestSelect(testDatabase.dialect);
      const itemsSQL = ts.generate(
        {id: 1, name: 'widget', price: ts.mk_float(100.0)},
        {id: 2, name: 'gadget', price: ts.mk_float(200.0)}
      );
      const ordersSQL = ts.generate(
        {id: 1, item_id: 1, qty: 10},
        {id: 2, item_id: 2, qty: 5},
        {id: 3, item_id: 1, qty: 3}
      );
      const model = wrapTestModel(
        testDatabase,
        `
        source: items is db.sql("""${itemsSQL}""") extend {
          primary_key: id
          measure: item_count is count()
        }

        source: orders is db.sql("""${ordersSQL}""") extend {
          primary_key: id
          join_one: items with item_id

          measure:
            order_count is count()
            total_qty is qty.sum()

          view: by_item is {
            group_by: items.name
            aggregate: order_count, total_qty
          }

          view: kpis is {
            aggregate: order_count, total_qty
          }

          view: dashboard is {
            nest: kpis
            nest: by_item
          }

          view: explore_totals is {
            aggregate: order_count, total_qty
          }
        }
      `
      );
      // Mimic MCP server pattern: getPreparedResult() then run()
      const runnable = model.model.loadQuery('run: orders -> explore_totals');
      const preparedResult = await runnable.getPreparedResult();
      expect(preparedResult).toBeDefined();
      const result = await runnable.run();
      expect(result.data.value[0]['order_count']).toBe(3);
      expect(result.data.value[0]['total_qty']).toBe(18);
    });
  });
});
