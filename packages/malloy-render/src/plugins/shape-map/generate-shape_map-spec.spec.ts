/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as lite from 'vega-lite';
import {
  runChartQuery,
  closeChartTestRuntime,
} from '@/plugins/spec-test-support/harness';
import {
  generateShapeMapSpec,
  shapeMapTooltip,
} from '@/plugins/shape-map/generate-shape_map-spec';

afterAll(async () => {
  await closeChartTestRuntime();
});

const SOURCE = `source: state_sales is duckdb.sql("""
  SELECT * FROM (VALUES ('California', 1234.5), ('Texas', 99.0)) AS t(state, sales)
""")`;

const QUERY = `
  # shape_map
  run: state_sales -> {
    group_by: state
    aggregate:
      # label="Sales" currency
      total_sales is sales.sum()
    order_by: state
  }
`;

test('the shape map tooltip titles the state and formats its value', async () => {
  const {root, rootCell} = await runChartQuery(SOURCE, QUERY);
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

test("the legend shows the value's label, and the theme's mapColor ends its gradient", async () => {
  const {root} = await runChartQuery(SOURCE, QUERY);
  const compiled = lite.compile(
    generateShapeMapSpec(root, {mapColor: '#8B0000'})
  ).spec;
  expect(compiled.legends?.map(l => l.title)).toEqual(['Sales']);
  expect(compiled.scales?.find(s => s.name === 'color')).toMatchObject({
    range: ['#f5f5f5', '#8B0000'],
  });
}, 60000);
