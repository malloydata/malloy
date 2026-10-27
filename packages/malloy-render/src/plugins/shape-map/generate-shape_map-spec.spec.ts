/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The builder reaches ESM-only vega through @/html/utils but never calls it.
jest.mock('vega', () => ({}));

import {
  runChartQuery,
  closeChartTestRuntime,
} from '@/plugins/spec-test-support/harness';
import {shapeMapTooltip} from '@/plugins/shape-map/generate-shape_map-spec';

afterAll(async () => {
  await closeChartTestRuntime();
});

const SOURCE = `source: state_sales is duckdb.sql("""
  SELECT * FROM (VALUES ('California', 1234.5), ('Texas', 99.0)) AS t(state, sales)
""")`;

test('the shape map tooltip titles the state and formats its value', async () => {
  const {root, rootCell} = await runChartQuery(
    SOURCE,
    `
    # shape_map
    run: state_sales -> {
      group_by: state
      aggregate:
        # label="Sales" currency
        total_sales is sales.sum()
      order_by: state
    }
  `
  );
  expect(shapeMapTooltip(root)(rootCell.rows[0])).toEqual({
    title: ['California'],
    entries: [
      {
        label: 'Sales',
        value: '$1,234.50',
        highlight: false,
        entryType: 'list-item',
      },
    ],
  });
}, 60000);
