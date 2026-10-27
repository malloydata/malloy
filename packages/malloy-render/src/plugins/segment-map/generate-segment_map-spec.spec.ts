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
import {segmentMapTooltip} from '@/plugins/segment-map/generate-segment_map-spec';

afterAll(async () => {
  await closeChartTestRuntime();
});

const SOURCE = `source: routes is duckdb.sql("""
  SELECT * FROM (VALUES (40.64, -73.78, 33.94, -118.41, 'JFK-LAX'))
    AS t(origin_lat, origin_lon, dest_lat, dest_lon, route)
""")`;

describe('segment map tooltip', () => {
  test('a text fifth column is the title', async () => {
    const {root, rootCell} = await runChartQuery(
      SOURCE,
      `
      # segment_map
      run: routes -> { group_by: origin_lat, origin_lon, dest_lat, dest_lon, route }
    `
    );
    expect(segmentMapTooltip(root)(rootCell.rows[0])).toEqual({
      title: ['JFK-LAX'],
      entries: [],
    });
  }, 60000);

  test('without one, each coordinate is a labeled line', async () => {
    const {root, rootCell} = await runChartQuery(
      SOURCE,
      `
      # segment_map
      run: routes -> {
        group_by:
          # label="From lat"
          origin_lat
          origin_lon, dest_lat, dest_lon
      }
    `
    );
    const tip = segmentMapTooltip(root)(rootCell.rows[0]);
    expect(tip.title).toEqual([]);
    expect(tip.entries.map(e => [e.label, e.value])).toEqual([
      ['From lat', '40.64'],
      ['origin_lon', '-73.78'],
      ['dest_lat', '33.94'],
      ['dest_lon', '-118.41'],
    ]);
  }, 60000);
});
